-- ==============================================================================
-- PATIENT BOOKING REGISTER (HIMS FRONT-DESK)
-- Migration 000001: Initial Core Schema, RLS, Roles, and Auth Triggers
-- Timezone Anchored: Asia/Karachi (UTC+5)
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set default timezone for this session
SET timezone = 'Asia/Karachi';

-- ------------------------------------------------------------------------------
-- 1. ROLES & PERMISSIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name TEXT NOT NULL CHECK (role_name IN ('admin', 'operator', 'receptionist')),
    permission_key TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    UNIQUE(role_name, permission_key)
);

-- ------------------------------------------------------------------------------
-- 2. USER PROFILES TABLE (Extends Supabase auth.users or standalone auth)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE, -- Foreign key to auth.users if Supabase Auth is linked
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'receptionist')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    lockout_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    password_hash TEXT, -- For custom auth fallback / internal verification
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

-- Index for fast user auth queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- ------------------------------------------------------------------------------
-- 3. CLINIC SETTINGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_name TEXT NOT NULL UNIQUE,
    value_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now())
);

-- ------------------------------------------------------------------------------
-- 4. DOCTORS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_doctors_active ON public.doctors(is_active, sort_order);

-- ------------------------------------------------------------------------------
-- 5. SHIFTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL, -- e.g. "08:00"
    end_time TEXT NOT NULL,   -- e.g. "22:00"
    slot_duration_minutes INTEGER NOT NULL DEFAULT 9,
    days_of_week TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shifts_doctor ON public.shifts(doctor_id, is_active);

-- ------------------------------------------------------------------------------
-- 6. LOOKUP ITEMS TABLE (Sources, Purposes, Called-As, Cities, Areas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lookup_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL CHECK (category IN ('source', 'purpose', 'called_as', 'city', 'area')),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.lookup_items(id) ON DELETE CASCADE, -- For dependent city -> area
    color TEXT,
    icon TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lookup_category ON public.lookup_items(category, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_lookup_parent ON public.lookup_items(parent_id);

-- ------------------------------------------------------------------------------
-- 7. PATIENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_mrn TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    cnic TEXT, -- 13 digits Pakistani CNIC
    phone_code TEXT NOT NULL DEFAULT '+92',
    phone_prefix TEXT NOT NULL DEFAULT '300',
    phone_number TEXT NOT NULL, -- 7 digits
    full_phone TEXT NOT NULL,   -- Normalized, e.g. "+923001234567"
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    age INTEGER,
    dob DATE,
    city TEXT,
    area TEXT,
    address TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_patients_full_phone ON public.patients(full_phone);
CREATE INDEX IF NOT EXISTS idx_patients_cnic ON public.patients(cnic);
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON public.patients(patient_mrn);

-- ------------------------------------------------------------------------------
-- 8. TOKEN COUNTERS TABLE (Atomic daily sequence per doctor, shift, date, type)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_counters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    booking_date DATE NOT NULL,
    reservation_type TEXT NOT NULL CHECK (reservation_type IN ('Appointment', 'Walk-in')),
    current_token_no INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    UNIQUE(doctor_id, shift_id, booking_date, reservation_type)
);

CREATE INDEX IF NOT EXISTS idx_token_counters_lookup ON public.token_counters(doctor_id, shift_id, booking_date, reservation_type);

-- ------------------------------------------------------------------------------
-- 9. BOOKINGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_date DATE NOT NULL,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id),
    shift_id UUID NOT NULL REFERENCES public.shifts(id),
    patient_id UUID NOT NULL REFERENCES public.patients(id),
    slot_index INTEGER NOT NULL,
    slot_time TEXT NOT NULL, -- "08:00"
    slot_time_formatted TEXT NOT NULL, -- "8:00 a.m."
    token_number INTEGER NOT NULL,
    token_code TEXT NOT NULL, -- e.g. "A-001" or "W-001"
    purpose TEXT NOT NULL DEFAULT 'Consultation',
    reservation_type TEXT NOT NULL DEFAULT 'Appointment' CHECK (reservation_type IN ('Appointment', 'Walk-in')),
    source TEXT NOT NULL DEFAULT 'Self',
    called_as TEXT NOT NULL DEFAULT 'Hospital Patient',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checked_in', 'in_process', 'completed', 'absent', 'follow_up', 'cancelled', 'rescheduled')),
    check_in_time TIMESTAMPTZ,
    in_process_time TIMESTAMPTZ,
    completed_time TIMESTAMPTZ,
    absent_time TIMESTAMPTZ,
    remarks TEXT,
    created_by UUID, -- references public.user_profiles(id)
    reprinted_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

-- Unique constraints to guarantee zero double bookings and zero token collisions
-- 1. Active slot uniqueness: No two active bookings can claim the same slot on the same shift & date
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_slot 
ON public.bookings(doctor_id, shift_id, booking_date, slot_index) 
WHERE deleted_at IS NULL AND status != 'cancelled';

-- 2. Unique token constraint: No duplicate tokens for same doctor, shift, date, and reservation type
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_daily_token 
ON public.bookings(doctor_id, shift_id, booking_date, token_code) 
WHERE deleted_at IS NULL;

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_bookings_shift_date ON public.bookings(booking_date, doctor_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_bookings_patient ON public.bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_source ON public.bookings(source);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON public.bookings(created_by);

-- ------------------------------------------------------------------------------
-- 10. WAITING LIST TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waiting_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_date DATE NOT NULL,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id),
    shift_id UUID NOT NULL REFERENCES public.shifts(id),
    patient_id UUID REFERENCES public.patients(id),
    patient_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    cnic TEXT,
    city TEXT,
    purpose TEXT NOT NULL DEFAULT 'Consultation',
    source TEXT NOT NULL DEFAULT 'Self',
    called_as TEXT NOT NULL DEFAULT 'Hospital Patient',
    priority INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'converted', 'cancelled')),
    converted_booking_id UUID REFERENCES public.bookings(id),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_waiting_list_shift_date ON public.waiting_list(booking_date, doctor_id, shift_id, status);

-- ------------------------------------------------------------------------------
-- 11. AUDIT LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    username TEXT NOT NULL,
    user_role TEXT,
    action_type TEXT NOT NULL, -- 'login', 'failed_login', 'booking_create', 'booking_edit', 'status_change', 'token_reprint', 'booking_delete', 'user_edit'
    entity_type TEXT NOT NULL, -- 'booking', 'user', 'patient', 'setting', 'shift'
    entity_id TEXT,
    details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- ------------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.roles_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookup_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: get current authenticated user profile
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS public.user_profiles AS $$
DECLARE
    profile public.user_profiles;
BEGIN
    SELECT * INTO profile 
    FROM public.user_profiles 
    WHERE auth_user_id = auth.uid() OR id = auth.uid();
    RETURN profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: get current role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
DECLARE
    role_name TEXT;
BEGIN
    SELECT role INTO role_name 
    FROM public.user_profiles 
    WHERE auth_user_id = auth.uid() OR id = auth.uid();
    RETURN COALESCE(role_name, 'anonymous');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies:
-- Allow service_role key full bypass on everything
-- Allow authenticated users based on role

-- CLINIC SETTINGS, DOCTORS, SHIFTS, LOOKUP ITEMS:
-- All authenticated roles can read; only admin can insert/update/delete
CREATE POLICY "Public Read Doctors" ON public.doctors FOR SELECT USING (true);
CREATE POLICY "Admin Write Doctors" ON public.doctors FOR ALL USING (public.current_user_role() = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Public Read Shifts" ON public.shifts FOR SELECT USING (true);
CREATE POLICY "Admin Write Shifts" ON public.shifts FOR ALL USING (public.current_user_role() = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Public Read Lookup Items" ON public.lookup_items FOR SELECT USING (true);
CREATE POLICY "Admin Write Lookup Items" ON public.lookup_items FOR ALL USING (public.current_user_role() = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Public Read Clinic Settings" ON public.clinic_settings FOR SELECT USING (true);
CREATE POLICY "Admin Write Clinic Settings" ON public.clinic_settings FOR ALL USING (public.current_user_role() = 'admin' OR auth.role() = 'service_role');

-- USER PROFILES:
-- Users can read their own profile; Admin can read and update all
CREATE POLICY "User View Own Profile" ON public.user_profiles FOR SELECT USING (
    id = auth.uid() OR auth_user_id = auth.uid() OR public.current_user_role() = 'admin' OR auth.role() = 'service_role'
);
CREATE POLICY "Admin Manage Profiles" ON public.user_profiles FOR ALL USING (
    public.current_user_role() = 'admin' OR auth.role() = 'service_role'
);

-- PATIENTS:
-- All 3 roles can read & create; only Receptionist & Admin can edit; Admin can delete
CREATE POLICY "View Patients" ON public.patients FOR SELECT USING (true);
CREATE POLICY "Create Patients" ON public.patients FOR INSERT WITH CHECK (
    public.current_user_role() IN ('admin', 'receptionist', 'operator') OR auth.role() = 'service_role'
);
CREATE POLICY "Update Patients" ON public.patients FOR UPDATE USING (
    public.current_user_role() IN ('admin', 'receptionist', 'operator') OR auth.role() = 'service_role'
);

-- BOOKINGS:
-- All 3 roles can read active bookings
CREATE POLICY "View Bookings" ON public.bookings FOR SELECT USING (true);
-- Operator can only create Appointment bookings
CREATE POLICY "Operator Create Bookings" ON public.bookings FOR INSERT WITH CHECK (
    (public.current_user_role() = 'operator' AND reservation_type = 'Appointment') OR
    public.current_user_role() IN ('admin', 'receptionist') OR
    auth.role() = 'service_role'
);
-- Operator can edit appointments; Receptionist can update status, check in; Admin can edit all
CREATE POLICY "Update Bookings" ON public.bookings FOR UPDATE USING (
    public.current_user_role() IN ('admin', 'receptionist', 'operator') OR auth.role() = 'service_role'
);
-- Only Admin can soft-delete bookings
CREATE POLICY "Admin Delete Bookings" ON public.bookings FOR DELETE USING (
    public.current_user_role() = 'admin' OR auth.role() = 'service_role'
);

-- WAITING LIST:
CREATE POLICY "View Waiting List" ON public.waiting_list FOR SELECT USING (true);
CREATE POLICY "Manage Waiting List" ON public.waiting_list FOR ALL USING (
    public.current_user_role() IN ('admin', 'receptionist', 'operator') OR auth.role() = 'service_role'
);

-- AUDIT LOGS:
CREATE POLICY "Admin View Audit Logs" ON public.audit_logs FOR SELECT USING (
    public.current_user_role() = 'admin' OR auth.role() = 'service_role'
);
CREATE POLICY "Insert Audit Logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- TOKEN COUNTERS:
CREATE POLICY "View Token Counters" ON public.token_counters FOR SELECT USING (true);
CREATE POLICY "Manage Token Counters" ON public.token_counters FOR ALL USING (
    public.current_user_role() IN ('admin', 'receptionist', 'operator') OR auth.role() = 'service_role'
);
-- ==============================================================================
-- PATIENT BOOKING REGISTER (HIMS FRONT-DESK)
-- Migration 000002: Atomic Token RPC & Double-Booking Protection
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper function to generate formatted MRN
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_patient_mrn()
RETURNS TEXT AS $$
DECLARE
    seq_val BIGINT;
    new_mrn TEXT;
BEGIN
    SELECT nextval('public.patient_mrn_seq') INTO seq_val;
    new_mrn := 'MRN-' || LPAD(seq_val::TEXT, 6, '0');
    RETURN new_mrn;
EXCEPTION WHEN undefined_table THEN
    CREATE SEQUENCE IF NOT EXISTS public.patient_mrn_seq START WITH 10001;
    SELECT nextval('public.patient_mrn_seq') INTO seq_val;
    new_mrn := 'MRN-' || LPAD(seq_val::TEXT, 6, '0');
    RETURN new_mrn;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. Master Atomic Booking RPC Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
    p_doctor_id UUID,
    p_shift_id UUID,
    p_booking_date DATE,
    p_slot_index INTEGER,
    p_slot_time TEXT,
    p_slot_time_formatted TEXT,
    p_reservation_type TEXT, -- 'Appointment' or 'Walk-in'
    p_purpose TEXT,
    p_source TEXT,
    p_called_as TEXT,
    p_first_name TEXT,
    p_last_name TEXT DEFAULT NULL,
    p_cnic TEXT DEFAULT NULL,
    p_phone_code TEXT DEFAULT '+92',
    p_phone_prefix TEXT DEFAULT '300',
    p_phone_number TEXT DEFAULT '',
    p_city TEXT DEFAULT NULL,
    p_area TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_age INTEGER DEFAULT NULL,
    p_dob DATE DEFAULT NULL,
    p_remarks TEXT DEFAULT NULL,
    p_waiting_list_id UUID DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_username TEXT DEFAULT 'system',
    p_existing_patient_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_patient_id UUID;
    v_patient_mrn TEXT;
    v_full_phone TEXT;
    v_token_no INTEGER;
    v_token_prefix TEXT;
    v_token_code TEXT;
    v_final_slot_index INTEGER;
    v_final_slot_time TEXT;
    v_final_slot_time_formatted TEXT;
    v_booking_id UUID;
    v_booking_record RECORD;
    v_slot_conflict UUID;
BEGIN
    -- Normalize phone number
    v_full_phone := COALESCE(p_phone_code, '+92') || COALESCE(p_phone_prefix, '') || COALESCE(p_phone_number, '');

    -- 1. Patient Deduplication or Creation
    IF p_existing_patient_id IS NOT NULL THEN
        v_patient_id := p_existing_patient_id;
        SELECT patient_mrn INTO v_patient_mrn FROM public.patients WHERE id = v_patient_id;
    ELSE
        -- Check duplicate by CNIC (if provided) or phone
        IF p_cnic IS NOT NULL AND length(trim(p_cnic)) = 13 THEN
            SELECT id, patient_mrn INTO v_patient_id, v_patient_mrn 
            FROM public.patients 
            WHERE cnic = trim(p_cnic) AND deleted_at IS NULL 
            LIMIT 1;
        END IF;

        IF v_patient_id IS NULL AND v_full_phone IS NOT NULL AND length(trim(v_full_phone)) >= 10 THEN
            SELECT id, patient_mrn INTO v_patient_id, v_patient_mrn 
            FROM public.patients 
            WHERE full_phone = trim(v_full_phone) AND deleted_at IS NULL 
            LIMIT 1;
        END IF;

        -- Create new patient record if not found
        IF v_patient_id IS NULL THEN
            v_patient_mrn := public.generate_patient_mrn();
            INSERT INTO public.patients (
                patient_mrn, first_name, last_name, cnic, phone_code,
                phone_prefix, phone_number, full_phone, age, dob,
                city, area, address, created_by
            ) VALUES (
                v_patient_mrn, trim(p_first_name), trim(p_last_name),
                NULLIF(trim(p_cnic), ''), p_phone_code, p_phone_prefix,
                trim(p_phone_number), v_full_phone, p_age, p_dob,
                p_city, p_area, p_address, p_created_by
            ) RETURNING id INTO v_patient_id;
        END IF;
    END IF;

    -- 2. Slot Validation and Double-Booking Prevention
    v_final_slot_index := p_slot_index;
    v_final_slot_time := p_slot_time;
    v_final_slot_time_formatted := p_slot_time_formatted;

    IF v_final_slot_index IS NOT NULL AND v_final_slot_index > 0 THEN
        -- Verify no active booking already occupies this slot
        SELECT id INTO v_slot_conflict
        FROM public.bookings
        WHERE doctor_id = p_doctor_id
          AND shift_id = p_shift_id
          AND booking_date = p_booking_date
          AND slot_index = v_final_slot_index
          AND deleted_at IS NULL
          AND status != 'cancelled'
        FOR UPDATE;

        IF v_slot_conflict IS NOT NULL THEN
            RAISE EXCEPTION 'Slot just booked by another user';
        END IF;
    ELSE
        -- Walk-in without specific slot: Pick next free slot index or next overflow index
        SELECT COALESCE(MAX(slot_index), 0) + 1 INTO v_final_slot_index
        FROM public.bookings
        WHERE doctor_id = p_doctor_id
          AND shift_id = p_shift_id
          AND booking_date = p_booking_date
          AND deleted_at IS NULL;

        IF v_final_slot_time IS NULL OR v_final_slot_time = '' THEN
            v_final_slot_time := to_char(timezone('Asia/Karachi'::text, now()), 'HH24:MI');
            v_final_slot_time_formatted := to_char(timezone('Asia/Karachi'::text, now()), 'HH12:MI a.m.');
        END IF;
    END IF;

    -- 3. Atomic Daily Token Increment (Row locked per doctor, shift, date, type)
    v_token_prefix := CASE WHEN p_reservation_type = 'Walk-in' THEN 'W' ELSE 'A' END;

    INSERT INTO public.token_counters (
        doctor_id, shift_id, booking_date, reservation_type, current_token_no
    ) VALUES (
        p_doctor_id, p_shift_id, p_booking_date, p_reservation_type, 1
    )
    ON CONFLICT (doctor_id, shift_id, booking_date, reservation_type)
    DO UPDATE SET 
        current_token_no = public.token_counters.current_token_no + 1,
        updated_at = timezone('Asia/Karachi'::text, now())
    RETURNING current_token_no INTO v_token_no;

    -- Format 3-digit sequential token code: e.g. A-001 or W-001
    v_token_code := v_token_prefix || '-' || LPAD(v_token_no::TEXT, 3, '0');

    -- 4. Insert Booking
    INSERT INTO public.bookings (
        booking_date, doctor_id, shift_id, patient_id,
        slot_index, slot_time, slot_time_formatted,
        token_number, token_code, purpose, reservation_type,
        source, called_as, status, remarks, created_by
    ) VALUES (
        p_booking_date, p_doctor_id, p_shift_id, v_patient_id,
        v_final_slot_index, v_final_slot_time, v_final_slot_time_formatted,
        v_token_no, v_token_code, COALESCE(p_purpose, 'Consultation'),
        COALESCE(p_reservation_type, 'Appointment'), COALESCE(p_source, 'Self'),
        COALESCE(p_called_as, 'Hospital Patient'), 'pending', p_remarks, p_created_by
    ) RETURNING id INTO v_booking_id;

    -- 5. If from waiting list, convert it
    IF p_waiting_list_id IS NOT NULL THEN
        UPDATE public.waiting_list
        SET status = 'converted',
            converted_booking_id = v_booking_id,
            updated_at = timezone('Asia/Karachi'::text, now())
        WHERE id = p_waiting_list_id;
    END IF;

    -- 6. Insert Audit Log
    INSERT INTO public.audit_logs (
        user_id, username, action_type, entity_type, entity_id, details_json
    ) VALUES (
        p_created_by, COALESCE(p_username, 'system'), 'booking_create', 'booking', v_booking_id::TEXT,
        jsonb_build_object(
            'token_code', v_token_code,
            'slot_index', v_final_slot_index,
            'slot_time', v_final_slot_time_formatted,
            'patient_mrn', v_patient_mrn,
            'patient_name', trim(p_first_name) || ' ' || COALESCE(trim(p_last_name), ''),
            'reservation_type', p_reservation_type,
            'source', p_source,
            'doctor_id', p_doctor_id,
            'shift_id', p_shift_id,
            'booking_date', p_booking_date
        )
    );

    -- 7. Return complete booking payload
    SELECT 
        b.id, b.booking_date, b.slot_index, b.slot_time, b.slot_time_formatted,
        b.token_number, b.token_code, b.purpose, b.reservation_type, b.source,
        b.called_as, b.status, b.remarks, b.created_at, b.check_in_time,
        p.id as patient_id, p.patient_mrn, p.first_name, p.last_name,
        p.full_phone, p.cnic, p.age, p.dob, p.city, p.area, p.address,
        d.name as doctor_name, s.name as shift_name
    INTO v_booking_record
    FROM public.bookings b
    JOIN public.patients p ON b.patient_id = p.id
    JOIN public.doctors d ON b.doctor_id = d.id
    JOIN public.shifts s ON b.shift_id = s.id
    WHERE b.id = v_booking_id;

    RETURN to_jsonb(v_booking_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 3. Token Reprint RPC (Keeps same token and records audit log)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reprint_token(
    p_booking_id UUID,
    p_user_id UUID,
    p_username TEXT,
    p_format TEXT DEFAULT '80mm'
)
RETURNS JSONB AS $$
DECLARE
    v_record RECORD;
BEGIN
    UPDATE public.bookings
    SET reprinted_count = reprinted_count + 1,
        updated_at = timezone('Asia/Karachi'::text, now())
    WHERE id = p_booking_id;

    SELECT 
        b.id, b.booking_date, b.slot_index, b.slot_time, b.slot_time_formatted,
        b.token_number, b.token_code, b.purpose, b.reservation_type, b.source,
        b.called_as, b.status, b.reprinted_count,
        p.id as patient_id, p.patient_mrn, p.first_name, p.last_name,
        p.full_phone, p.cnic, p.age, p.city, p.area,
        d.name as doctor_name, s.name as shift_name
    INTO v_record
    FROM public.bookings b
    JOIN public.patients p ON b.patient_id = p.id
    JOIN public.doctors d ON b.doctor_id = d.id
    JOIN public.shifts s ON b.shift_id = s.id
    WHERE b.id = p_booking_id;

    -- Audit log
    INSERT INTO public.audit_logs (
        user_id, username, action_type, entity_type, entity_id, details_json
    ) VALUES (
        p_user_id, COALESCE(p_username, 'receptionist'), 'token_reprint', 'booking', p_booking_id::TEXT,
        jsonb_build_object(
            'token_code', v_record.token_code,
            'format', p_format,
            'reprinted_count', v_record.reprinted_count,
            'patient_name', v_record.first_name || ' ' || COALESCE(v_record.last_name, '')
        )
    );

    RETURN to_jsonb(v_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 4. Status Update RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_booking_status(
    p_booking_id UUID,
    p_status TEXT, -- 'checked_in', 'in_process', 'completed', 'absent', 'follow_up', 'cancelled'
    p_user_id UUID,
    p_username TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_now TIMESTAMPTZ := timezone('Asia/Karachi'::text, now());
    v_booking RECORD;
BEGIN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    IF v_booking.id IS NULL THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    UPDATE public.bookings
    SET status = p_status,
        check_in_time = CASE WHEN p_status = 'checked_in' AND check_in_time IS NULL THEN v_now ELSE check_in_time END,
        in_process_time = CASE WHEN p_status = 'in_process' AND in_process_time IS NULL THEN v_now ELSE in_process_time END,
        completed_time = CASE WHEN p_status = 'completed' AND completed_time IS NULL THEN v_now ELSE completed_time END,
        absent_time = CASE WHEN p_status = 'absent' AND absent_time IS NULL THEN v_now ELSE absent_time END,
        remarks = CASE WHEN p_reason IS NOT NULL THEN COALESCE(remarks || ' | ', '') || p_reason ELSE remarks END,
        updated_at = v_now
    WHERE id = p_booking_id;

    -- Audit entry
    INSERT INTO public.audit_logs (
        user_id, username, action_type, entity_type, entity_id, details_json
    ) VALUES (
        p_user_id, COALESCE(p_username, 'user'), 'status_change', 'booking', p_booking_id::TEXT,
        jsonb_build_object(
            'old_status', v_booking.status,
            'new_status', p_status,
            'token_code', v_booking.token_code,
            'reason', p_reason
        )
    );

    SELECT b.*, p.first_name, p.last_name, p.full_phone, d.name as doctor_name
    INTO v_booking
    FROM public.bookings b
    JOIN public.patients p ON b.patient_id = p.id
    JOIN public.doctors d ON b.doctor_id = d.id
    WHERE b.id = p_booking_id;

    RETURN to_jsonb(v_booking);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ==============================================================================
-- PATIENT BOOKING REGISTER (HIMS FRONT-DESK)
-- Migration 000003: High-Performance Database Aggregation Functions for Reports
-- All calculations executed inside PostgreSQL in Asia/Karachi timezone
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Daily Stat Cards RPC (Real-time header statistics)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_stat_cards(
    p_date DATE,
    p_doctor_id UUID,
    p_shift_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_total_slots INTEGER := 94; -- default fallback
    v_slot_duration INTEGER := 9;
    v_shift_start TEXT;
    v_shift_end TEXT;
    v_start_min INTEGER;
    v_end_min INTEGER;
    v_total_bookings INTEGER := 0;
    v_checked_in INTEGER := 0;
    v_in_process INTEGER := 0;
    v_pending INTEGER := 0;
    v_absent INTEGER := 0;
    v_completed INTEGER := 0;
    v_follow_up INTEGER := 0;
    v_remaining_fu INTEGER := 0;
    v_sources_json JSONB := '{}'::jsonb;
    v_result JSONB;
BEGIN
    -- Calculate actual total slots from shift timings
    SELECT start_time, end_time, slot_duration_minutes 
    INTO v_shift_start, v_shift_end, v_slot_duration
    FROM public.shifts 
    WHERE id = p_shift_id;

    IF v_shift_start IS NOT NULL AND v_shift_end IS NOT NULL THEN
        v_start_min := split_part(v_shift_start, ':', 1)::INTEGER * 60 + split_part(v_shift_start, ':', 2)::INTEGER;
        v_end_min := split_part(v_shift_end, ':', 1)::INTEGER * 60 + split_part(v_shift_end, ':', 2)::INTEGER;
        IF v_end_min > v_start_min AND v_slot_duration > 0 THEN
            v_total_slots := FLOOR((v_end_min - v_start_min)::FLOAT / v_slot_duration);
        END IF;
    END IF;

    -- Aggregate counts from active bookings
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'checked_in'),
        COUNT(*) FILTER (WHERE status = 'in_process'),
        COUNT(*) FILTER (WHERE status = 'pending'),
        COUNT(*) FILTER (WHERE status = 'absent'),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'follow_up' OR purpose ILIKE '%follow%'),
        COUNT(*) FILTER (WHERE (purpose ILIKE '%follow%' OR status = 'follow_up') AND status = 'pending')
    INTO 
        v_total_bookings, v_checked_in, v_in_process, v_pending,
        v_absent, v_completed, v_follow_up, v_remaining_fu
    FROM public.bookings
    WHERE booking_date = p_date
      AND doctor_id = p_doctor_id
      AND shift_id = p_shift_id
      AND deleted_at IS NULL
      AND status != 'cancelled';

    -- Aggregate counts per source
    SELECT jsonb_object_agg(source_name, count_val)
    INTO v_sources_json
    FROM (
        SELECT COALESCE(b.source, 'Other') AS source_name, COUNT(*) AS count_val
        FROM public.bookings b
        WHERE b.booking_date = p_date
          AND b.doctor_id = p_doctor_id
          AND b.shift_id = p_shift_id
          AND b.deleted_at IS NULL
          AND b.status != 'cancelled'
        GROUP BY b.source
    ) s;

    v_result := jsonb_build_object(
        'totalBookings', v_total_bookings,
        'totalSlots', v_total_slots,
        'bookedSlots', v_total_bookings,
        'bookedPercentage', CASE WHEN v_total_slots > 0 THEN ROUND((v_total_bookings::NUMERIC / v_total_slots * 100), 1) ELSE 0 END,
        'availableSlots', GREATEST(0, v_total_slots - v_total_bookings),
        'availablePercentage', CASE WHEN v_total_slots > 0 THEN ROUND((GREATEST(0, v_total_slots - v_total_bookings)::NUMERIC / v_total_slots * 100), 1) ELSE 0 END,
        'checkInCount', v_checked_in,
        'checkInPercentage', CASE WHEN v_total_bookings > 0 THEN ROUND((v_checked_in::NUMERIC / v_total_bookings * 100), 1) ELSE 0 END,
        'inProcessCount', v_in_process,
        'inProcessPercentage', CASE WHEN v_total_bookings > 0 THEN ROUND((v_in_process::NUMERIC / v_total_bookings * 100), 1) ELSE 0 END,
        'pendingCount', v_pending,
        'pendingPercentage', CASE WHEN v_total_bookings > 0 THEN ROUND((v_pending::NUMERIC / v_total_bookings * 100), 1) ELSE 0 END,
        'absentCount', v_absent,
        'absentPercentage', CASE WHEN v_total_bookings > 0 THEN ROUND((v_absent::NUMERIC / v_total_bookings * 100), 1) ELSE 0 END,
        'completedCount', v_completed,
        'followUpCount', v_follow_up,
        'followUpPercentage', CASE WHEN v_total_bookings > 0 THEN ROUND((v_follow_up::NUMERIC / v_total_bookings * 100), 1) ELSE 0 END,
        'remainingFollowUpCount', v_remaining_fu,
        'remainingFollowUpPercentage', CASE WHEN v_follow_up > 0 THEN ROUND((v_remaining_fu::NUMERIC / v_follow_up * 100), 1) ELSE 100.0 END,
        'sourcesCount', COALESCE(v_sources_json, '{}'::jsonb)
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- 2. Report 1: Overview Dashboard
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_overview(
    p_start_date DATE,
    p_end_date DATE,
    p_doctor_id UUID DEFAULT NULL,
    p_shift_id UUID DEFAULT NULL,
    p_source TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total INTEGER := 0;
    v_checked_in INTEGER := 0;
    v_absent INTEGER := 0;
    v_completed INTEGER := 0;
    v_days_count INTEGER;
    v_trend JSONB;
BEGIN
    v_days_count := GREATEST(1, (p_end_date - p_start_date + 1));

    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'checked_in'),
        COUNT(*) FILTER (WHERE status = 'absent'),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total, v_checked_in, v_absent, v_completed
    FROM public.bookings
    WHERE booking_date BETWEEN p_start_date AND p_end_date
      AND (p_doctor_id IS NULL OR doctor_id = p_doctor_id)
      AND (p_shift_id IS NULL OR shift_id = p_shift_id)
      AND (p_source IS NULL OR source = p_source)
      AND deleted_at IS NULL
      AND status != 'cancelled';

    -- Daily trend for trendline
    SELECT jsonb_agg(d_row) INTO v_trend
    FROM (
        SELECT 
            b.booking_date::TEXT as date,
            COUNT(*) as bookings,
            COUNT(*) FILTER (WHERE b.status = 'checked_in' OR b.status = 'completed') as checked_in,
            COUNT(*) FILTER (WHERE b.status = 'absent') as absent
        FROM public.bookings b
        WHERE b.booking_date BETWEEN p_start_date AND p_end_date
          AND (p_doctor_id IS NULL OR b.doctor_id = p_doctor_id)
          AND (p_shift_id IS NULL OR b.shift_id = p_shift_id)
          AND (p_source IS NULL OR b.source = p_source)
          AND b.deleted_at IS NULL
          AND b.status != 'cancelled'
        GROUP BY b.booking_date
        ORDER BY b.booking_date ASC
    ) d_row;

    RETURN jsonb_build_object(
        'totalBookings', v_total,
        'checkedIn', v_checked_in,
        'absent', v_absent,
        'completed', v_completed,
        'absentRate', CASE WHEN v_total > 0 THEN ROUND((v_absent::NUMERIC / v_total * 100), 1) ELSE 0 END,
        'avgPerDay', ROUND((v_total::NUMERIC / v_days_count), 1),
        'dailyTrend', COALESCE(v_trend, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- 3. Report 2: Bookings By Source & Conversion
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_bookings_by_source(
    p_start_date DATE,
    p_end_date DATE,
    p_doctor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total INTEGER;
    v_sources JSONB;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM public.bookings
    WHERE booking_date BETWEEN p_start_date AND p_end_date
      AND (p_doctor_id IS NULL OR doctor_id = p_doctor_id)
      AND deleted_at IS NULL
      AND status != 'cancelled';

    SELECT jsonb_agg(s_row) INTO v_sources
    FROM (
        SELECT 
            source,
            COUNT(*) as count,
            CASE WHEN v_total > 0 THEN ROUND((COUNT(*)::NUMERIC / v_total * 100), 1) ELSE 0 END as percentage,
            COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'absent') as absent,
            CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'checked_in' OR status = 'completed')::NUMERIC / COUNT(*) * 100), 1) ELSE 0 END as conversion_rate
        FROM public.bookings
        WHERE booking_date BETWEEN p_start_date AND p_end_date
          AND (p_doctor_id IS NULL OR doctor_id = p_doctor_id)
          AND deleted_at IS NULL
          AND status != 'cancelled'
        GROUP BY source
        ORDER BY count DESC
    ) s_row;

    RETURN jsonb_build_object(
        'totalBookings', v_total,
        'sources', COALESCE(v_sources, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- 4. Report 3: Daily, Weekly, Monthly Trends
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_booking_trends(
    p_start_date DATE,
    p_end_date DATE,
    p_doctor_id UUID DEFAULT NULL,
    p_group_by TEXT DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS JSONB AS $$
DECLARE
    v_data JSONB;
BEGIN
    SELECT jsonb_agg(t_row) INTO v_data
    FROM (
        SELECT 
            CASE 
                WHEN p_group_by = 'week' THEN to_char(date_trunc('week', booking_date), 'YYYY-"W"IW')
                WHEN p_group_by = 'month' THEN to_char(date_trunc('month', booking_date), 'YYYY-MM')
                ELSE booking_date::TEXT 
            END as period,
            COUNT(*) as total_bookings,
            COUNT(*) FILTER (WHERE reservation_type = 'Appointment') as appointments,
            COUNT(*) FILTER (WHERE reservation_type = 'Walk-in') as walk_ins,
            COUNT(*) FILTER (WHERE status = 'checked_in' OR status = 'completed') as attended,
            COUNT(*) FILTER (WHERE status = 'absent') as absent
        FROM public.bookings
        WHERE booking_date BETWEEN p_start_date AND p_end_date
          AND (p_doctor_id IS NULL OR doctor_id = p_doctor_id)
          AND deleted_at IS NULL
          AND status != 'cancelled'
        GROUP BY period
        ORDER BY period ASC
    ) t_row;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- 5. Report 4: Peak Hours & Heatmap
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_peak_hours(
    p_start_date DATE,
    p_end_date DATE,
    p_doctor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_hourly JSONB;
    v_weekday JSONB;
BEGIN
    SELECT jsonb_agg(h_row) INTO v_hourly
    FROM (
        SELECT 
            split_part(slot_time, ':', 1)::INTEGER as hour_num,
            to_char(to_timestamp(split_part(slot_time, ':', 1), 'HH24'), 'HH12 a.m.') as hour_label,
            COUNT(*) as bookings_count
        FROM public.bookings
        WHERE booking_date BETWEEN p_start_date AND p_end_date
          AND (p_doctor_id IS NULL OR doctor_id = p_doctor_id)
          AND slot_time IS NOT NULL AND slot_time != ''
          AND deleted_at IS NULL
          AND status != 'cancelled'
        GROUP BY hour_num, hour_label
        ORDER BY hour_num ASC
    ) h_row;

    SELECT jsonb_agg(w_row) INTO v_weekday
    FROM (
        SELECT 
            to_char(booking_date, 'Day') as weekday_name,
            extract(dow FROM booking_date)::INTEGER as weekday_num,
            COUNT(*) as bookings_count
        FROM public.bookings
        WHERE booking_date BETWEEN p_start_date AND p_end_date
          AND (p_doctor_id IS NULL OR doctor_id = p_doctor_id)
          AND deleted_at IS NULL
          AND status != 'cancelled'
        GROUP BY weekday_name, weekday_num
        ORDER BY weekday_num ASC
    ) w_row;

    RETURN jsonb_build_object(
        'hourlyDistribution', COALESCE(v_hourly, '[]'::jsonb),
        'weekdayDistribution', COALESCE(v_weekday, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- 6. Report 5: User & Operator Performance
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_user_performance(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_users JSONB;
BEGIN
    SELECT jsonb_agg(u_row) INTO v_users
    FROM (
        SELECT 
            u.id as user_id,
            u.username,
            u.full_name,
            u.role,
            COUNT(b.id) as bookings_created,
            COUNT(b.id) FILTER (WHERE b.reservation_type = 'Appointment') as appointments_created,
            COUNT(b.id) FILTER (WHERE b.reservation_type = 'Walk-in') as walkins_created,
            COUNT(b.id) FILTER (WHERE b.status = 'checked_in' OR b.status = 'completed') as attended_count,
            COUNT(b.id) FILTER (WHERE b.status = 'absent') as absent_count
        FROM public.user_profiles u
        LEFT JOIN public.bookings b ON b.created_by = u.id 
            AND b.booking_date BETWEEN p_start_date AND p_end_date
            AND b.deleted_at IS NULL 
            AND b.status != 'cancelled'
        WHERE u.deleted_at IS NULL
        GROUP BY u.id, u.username, u.full_name, u.role
        ORDER BY bookings_created DESC
    ) u_row;

    RETURN COALESCE(v_users, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- 7. Report 6: Doctor & Shift Slot Utilisation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_doctor_shift_utilisation(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_days_count INTEGER := GREATEST(1, (p_end_date - p_start_date + 1));
    v_data JSONB;
BEGIN
    SELECT jsonb_agg(d_row) INTO v_data
    FROM (
        SELECT 
            d.id as doctor_id,
            d.name as doctor_name,
            s.id as shift_id,
            s.name as shift_name,
            s.slot_duration_minutes,
            COUNT(b.id) as total_booked,
            COUNT(b.id) FILTER (WHERE b.reservation_type = 'Appointment') as appointments_count,
            COUNT(b.id) FILTER (WHERE b.reservation_type = 'Walk-in') as walkins_count,
            COUNT(b.id) FILTER (WHERE b.status = 'checked_in' OR b.status = 'completed') as completed_count,
            COUNT(b.id) FILTER (WHERE b.status = 'absent') as absent_count
        FROM public.doctors d
        JOIN public.shifts s ON s.doctor_id = d.id AND s.deleted_at IS NULL
        LEFT JOIN public.bookings b ON b.doctor_id = d.id 
            AND b.shift_id = s.id 
            AND b.booking_date BETWEEN p_start_date AND p_end_date
            AND b.deleted_at IS NULL 
            AND b.status != 'cancelled'
        WHERE d.deleted_at IS NULL
        GROUP BY d.id, d.name, s.id, s.name, s.slot_duration_minutes
        ORDER BY total_booked DESC
    ) d_row;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- 8. Report 7: Tokens Issued & Reprints
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_tokens_summary(
    p_start_date DATE,
    p_end_date DATE,
    p_doctor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total_issued INTEGER;
    v_appointments INTEGER;
    v_walkins INTEGER;
    v_reprints INTEGER;
    v_cancelled INTEGER;
    v_daily JSONB;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE reservation_type = 'Appointment'),
        COUNT(*) FILTER (WHERE reservation_type = 'Walk-in'),
        COALESCE(SUM(reprinted_count), 0),
        COUNT(*) FILTER (WHERE status = 'cancelled')
    INTO v_total_issued, v_appointments, v_walkins, v_reprints, v_cancelled
    FROM public.bookings
    WHERE booking_date BETWEEN p_start_date AND p_end_date
      AND (p_doctor_id IS NULL OR doctor_id = p_doctor_id)
      AND deleted_at IS NULL;

    SELECT jsonb_agg(day_row) INTO v_daily
    FROM (
        SELECT 
            booking_date::TEXT as date,
            COUNT(*) as total_tokens,
            COUNT(*) FILTER (WHERE reservation_type = 'Appointment') as appointment_tokens,
            COUNT(*) FILTER (WHERE reservation_type = 'Walk-in') as walkin_tokens,
            COALESCE(SUM(reprinted_count), 0) as reprint_count,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_tokens
        FROM public.bookings
        WHERE booking_date BETWEEN p_start_date AND p_end_date
          AND (p_doctor_id IS NULL OR doctor_id = p_doctor_id)
          AND deleted_at IS NULL
        GROUP BY booking_date
        ORDER BY booking_date ASC
    ) day_row;

    RETURN jsonb_build_object(
        'totalTokensIssued', v_total_issued,
        'appointmentTokens', v_appointments,
        'walkinTokens', v_walkins,
        'totalReprints', v_reprints,
        'cancelledTokens', v_cancelled,
        'dailyTokens', COALESCE(v_daily, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- 9. Report 8: Absent & Follow-Up Patient List
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_absent_and_followup(
    p_start_date DATE,
    p_end_date DATE,
    p_doctor_id UUID DEFAULT NULL,
    p_filter_type TEXT DEFAULT 'all' -- 'all', 'absent', 'follow_up'
)
RETURNS JSONB AS $$
DECLARE
    v_records JSONB;
BEGIN
    SELECT jsonb_agg(r_row) INTO v_records
    FROM (
        SELECT 
            b.id as booking_id,
            b.booking_date::TEXT as booking_date,
            b.token_code,
            b.slot_time_formatted,
            b.status,
            b.purpose,
            b.source,
            b.remarks,
            p.id as patient_id,
            p.patient_mrn,
            p.first_name,
            p.last_name,
            p.full_phone,
            p.city,
            p.area,
            d.name as doctor_name
        FROM public.bookings b
        JOIN public.patients p ON b.patient_id = p.id
        JOIN public.doctors d ON b.doctor_id = d.id
        WHERE b.booking_date BETWEEN p_start_date AND p_end_date
          AND (p_doctor_id IS NULL OR b.doctor_id = p_doctor_id)
          AND b.deleted_at IS NULL
          AND (
              (p_filter_type = 'absent' AND b.status = 'absent') OR
              (p_filter_type = 'follow_up' AND (b.status = 'follow_up' OR b.purpose ILIKE '%follow%')) OR
              (p_filter_type = 'all' AND (b.status = 'absent' OR b.status = 'follow_up' OR b.purpose ILIKE '%follow%'))
          )
        ORDER BY b.booking_date DESC, b.slot_index ASC
    ) r_row;

    RETURN COALESCE(v_records, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;
-- ==============================================================================
-- PATIENT BOOKING REGISTER (HIMS FRONT-DESK)
-- Migration 000004: Supabase Realtime Publication & Direct User Auth RPC
-- ==============================================================================

SET timezone = 'Asia/Karachi';

-- ------------------------------------------------------------------------------
-- 1. ENABLE SUPABASE REALTIME ON OPERATIONAL TABLES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.waiting_list;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Enable REPLICA IDENTITY FULL so realtime events deliver complete row records
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.waiting_list REPLICA IDENTITY FULL;
ALTER TABLE public.patients REPLICA IDENTITY FULL;
ALTER TABLE public.user_profiles REPLICA IDENTITY FULL;

-- ------------------------------------------------------------------------------
-- 2. USER AUTHENTICATION RPC (Authenticates staff securely via pgcrypto crypt)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.login_user(
    p_username_or_email TEXT,
    p_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user public.user_profiles%ROWTYPE;
BEGIN
    -- Locate active user by username or email (case insensitive)
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE (LOWER(username) = LOWER(TRIM(p_username_or_email))
       OR LOWER(email) = LOWER(TRIM(p_username_or_email)))
      AND deleted_at IS NULL
    LIMIT 1;

    -- User not found
    IF v_user.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid username or password'
        );
    END IF;

    -- Disabled account check
    IF v_user.status = 'disabled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This user account is currently disabled by Administrator.'
        );
    END IF;

    -- Lockout check
    IF v_user.lockout_until IS NOT NULL AND v_user.lockout_until > timezone('Asia/Karachi'::text, now()) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Account is temporarily locked due to repeated failed attempts. Please try again later.'
        );
    END IF;

    -- Verify password hash using pgcrypto crypt
    IF v_user.password_hash IS NOT NULL AND v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
        UPDATE public.user_profiles
        SET failed_attempts = failed_attempts + 1,
            lockout_until = CASE 
                WHEN failed_attempts + 1 >= 5 THEN timezone('Asia/Karachi'::text, now()) + INTERVAL '5 minutes'
                ELSE NULL 
            END,
            updated_at = timezone('Asia/Karachi'::text, now())
        WHERE id = v_user.id;

        -- Record failed login in audit trail
        INSERT INTO public.audit_logs (
            user_id, username, user_role, action_type, entity_type, entity_id, details_json
        ) VALUES (
            v_user.id, v_user.username, v_user.role, 'failed_login', 'user', v_user.id::TEXT,
            jsonb_build_object('reason', 'incorrect_password')
        );

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid username or password'
        );
    END IF;

    -- Successful Login: Reset failed attempts, update last login time
    UPDATE public.user_profiles
    SET failed_attempts = 0,
        lockout_until = NULL,
        last_login_at = timezone('Asia/Karachi'::text, now()),
        updated_at = timezone('Asia/Karachi'::text, now())
    WHERE id = v_user.id;

    -- Record successful login in audit trail
    INSERT INTO public.audit_logs (
        user_id, username, user_role, action_type, entity_type, entity_id, details_json
    ) VALUES (
        v_user.id, v_user.username, v_user.role, 'login', 'user', v_user.id::TEXT,
        jsonb_build_object('client', 'web', 'login_time', timezone('Asia/Karachi'::text, now()))
    );

    -- Return authenticated profile
    RETURN jsonb_build_object(
        'success', true,
        'user', jsonb_build_object(
            'id', v_user.id,
            'username', v_user.username,
            'full_name', v_user.full_name,
            'email', v_user.email,
            'role', v_user.role,
            'status', v_user.status,
            'must_change_password', v_user.must_change_password,
            'created_at', v_user.created_at,
            'updated_at', v_user.updated_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to all clients
GRANT EXECUTE ON FUNCTION public.login_user(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. PASSWORD CHANGE RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_user_password(
    p_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB AS $$
BEGIN
    UPDATE public.user_profiles
    SET password_hash = crypt(p_new_password, gen_salt('bf')),
        must_change_password = false,
        updated_at = timezone('Asia/Karachi'::text, now())
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.change_user_password(UUID, TEXT) TO authenticated, service_role;
-- ==============================================================================
-- PATIENT BOOKING REGISTER (HIMS FRONT-DESK)
-- Seed Data: Sample Doctors, Shifts, Sources, Lookups, Users, and 30 Days of Bookings
-- ==============================================================================

SET timezone = 'Asia/Karachi';

-- ------------------------------------------------------------------------------
-- 1. CLINIC SETTINGS
-- ------------------------------------------------------------------------------
INSERT INTO public.clinic_settings (key_name, value_json)
VALUES (
    'clinic_info',
    jsonb_build_object(
        'name', 'Bariatric Surgery Clinic',
        'tagline', 'Advanced Bariatric, Laparoscopic & Metabolic Surgery Center',
        'phone', '+92-91-5840000',
        'address', 'Khyber Medical Centre, Dabgari Gardens, Peshawar',
        'website', 'www.bariatricsurgery.com.pk',
        'emergency_phone', '+92-300-5900000'
    )
)
ON CONFLICT (key_name) DO UPDATE 
SET value_json = EXCLUDED.value_json;

INSERT INTO public.clinic_settings (key_name, value_json)
VALUES (
    'security_config',
    jsonb_build_object(
        'idle_timeout_minutes', 15,
        'max_failed_attempts', 5,
        'lockout_minutes', 5,
        'force_password_change_first_login', true
    )
)
ON CONFLICT (key_name) DO UPDATE 
SET value_json = EXCLUDED.value_json;

-- ------------------------------------------------------------------------------
-- 2. ROLES & PERMISSIONS
-- ------------------------------------------------------------------------------
INSERT INTO public.roles_permissions (role_name, permission_key, description)
VALUES 
    -- Admin Permissions (Everything)
    ('admin', 'users.manage', 'Create, update, disable, and reset passwords for system users'),
    ('admin', 'settings.manage', 'Configure doctors, shifts, slot duration, and lookup categories'),
    ('admin', 'reports.view', 'Access all 8 analytical dashboards and database reports'),
    ('admin', 'reports.export', 'Export reports to CSV, Excel, and PDF'),
    ('admin', 'bookings.delete', 'Soft-delete and restore patient bookings'),
    ('admin', 'audit.view', 'Inspect security and operational audit trail'),
    ('admin', 'bookings.create', 'Create appointments and walk-in bookings'),
    ('admin', 'bookings.edit', 'Modify existing booking and patient details'),
    ('admin', 'bookings.checkin', 'Mark patients as checked in'),
    ('admin', 'bookings.status_update', 'Advance patient through in-process and completed'),
    ('admin', 'tokens.print', 'Generate and reprint thermal/A5 token slips'),
    ('admin', 'waiting_list.manage', 'Queue patients and convert to confirmed slots'),

    -- Operator Permissions (Call Center / Social Leads Only)
    ('operator', 'bookings.create', 'Create appointment bookings from phone and digital ads'),
    ('operator', 'bookings.edit', 'Reschedule and update appointment notes'),
    ('operator', 'patients.search', 'Lookup and register new patient records'),
    ('operator', 'waiting_list.manage', 'Add prospective patients to the shift waiting list'),

    -- Receptionist Permissions (Front-Desk Execution)
    ('receptionist', 'bookings.create', 'Create appointment bookings and walk-ins'),
    ('receptionist', 'bookings.edit', 'Update patient contact details and visit purpose'),
    ('receptionist', 'bookings.checkin', 'Perform patient check-in at front desk counter'),
    ('receptionist', 'bookings.status_update', 'Mark absent, in-process, or completed'),
    ('receptionist', 'tokens.print', 'Print and reprint official queue token slips'),
    ('receptionist', 'waiting_list.manage', 'Convert waiting patients to free intervals'),
    ('receptionist', 'analytics.daily_cards', 'View live daily counter metrics')
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. INITIAL USERS (Admin, Operator, Receptionist)
-- Default bcrypt hashes:
-- 'admin123' -> $2a$10$W9qCqS/gR8uMsmhGzZp... or pgcrypto crypt('admin123', gen_salt('bf'))
-- ------------------------------------------------------------------------------
INSERT INTO public.user_profiles (id, username, full_name, email, role, status, must_change_password, password_hash)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin', 'System Administrator', 'admin@bariatricclinic.com', 'admin', 'active', false, crypt('admin123', gen_salt('bf'))),
    ('22222222-2222-2222-2222-222222222222', 'operator', 'Lead Operator Ali', 'ali.operator@bariatricclinic.com', 'operator', 'active', false, crypt('operator123', gen_salt('bf'))),
    ('33333333-3333-3333-3333-333333333333', 'receptionist', 'Front Desk Sara', 'sara.reception@bariatricclinic.com', 'receptionist', 'active', false, crypt('reception123', gen_salt('bf')))
ON CONFLICT (username) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. DOCTORS & SHIFTS
-- ------------------------------------------------------------------------------
INSERT INTO public.doctors (id, name, specialty, phone, is_active, sort_order)
VALUES
    ('d1111111-1111-1111-1111-111111111111', 'Dr Zarin Khan', 'Consultant Laparoscopic & Bariatric Surgeon', '+923005901111', true, 1),
    ('d2222222-2222-2222-2222-222222222222', 'Dr Tariq Shah', 'Consultant Laparoscopic & General Surgeon', '+923005902222', true, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shifts (id, doctor_id, name, start_time, end_time, slot_duration_minutes, is_active, sort_order)
VALUES
    ('s1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Default Shift', '08:00', '22:00', 9, true, 1),
    ('s2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'Morning Shift', '09:00', '14:00', 10, true, 2),
    ('s3333333-3333-3333-3333-333333333333', 'd2222222-2222-2222-2222-222222222222', 'Evening Clinical Shift', '15:00', '21:00', 12, true, 1)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. LOOKUP ITEMS (Sources, Purposes, Called-As, Cities, Areas)
-- ------------------------------------------------------------------------------
-- Sources
INSERT INTO public.lookup_items (category, name, color, icon, sort_order)
VALUES
    ('source', 'Self', '#3B82F6', 'user', 1),
    ('source', 'Facebook', '#1877F2', 'facebook', 2),
    ('source', 'TikTok', '#000000', 'video', 3),
    ('source', 'Instagram', '#E1306C', 'camera', 4),
    ('source', 'YouTube', '#FF0000', 'youtube', 5),
    ('source', 'Website', '#10B981', 'globe', 6),
    ('source', 'WhatsApp', '#25D366', 'message-circle', 7),
    ('source', 'Referral', '#8B5CF6', 'users', 8),
    ('source', 'Phone call', '#EC4899', 'phone', 9)
ON CONFLICT DO NOTHING;

-- Purposes
INSERT INTO public.lookup_items (category, name, color, icon, sort_order)
VALUES
    ('purpose', 'Consultation', '#EF4444', 'target', 1),
    ('purpose', 'Follow Up', '#3B82F6', 'refresh-cw', 2),
    ('purpose', 'Procedure', '#10B981', 'activity', 3),
    ('purpose', 'Emergency', '#DC2626', 'alert-circle', 4),
    ('purpose', 'Report Review', '#F59E0B', 'file-text', 5)
ON CONFLICT DO NOTHING;

-- Called As
INSERT INTO public.lookup_items (category, name, color, icon, sort_order)
VALUES
    ('called_as', 'Hospital Patient', '#0284C7', 'user-check', 1),
    ('called_as', 'VIP', '#F59E0B', 'star', 2),
    ('called_as', 'Staff Member', '#10B981', 'award', 3),
    ('called_as', 'Relative', '#8B5CF6', 'heart', 4)
ON CONFLICT DO NOTHING;

-- Cities
INSERT INTO public.lookup_items (id, category, name, sort_order)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'city', 'Peshawar', 1),
    ('c0000000-0000-0000-0000-000000000002', 'city', 'Islamabad', 2),
    ('c0000000-0000-0000-0000-000000000003', 'city', 'Rawalpindi', 3),
    ('c0000000-0000-0000-0000-000000000004', 'city', 'Lahore', 4),
    ('c0000000-0000-0000-0000-000000000005', 'city', 'Karachi', 5),
    ('c0000000-0000-0000-0000-000000000006', 'city', 'Mardan', 6),
    ('c0000000-0000-0000-0000-000000000007', 'city', 'Swat', 7),
    ('c0000000-0000-0000-0000-000000000008', 'city', 'Kohat', 8),
    ('c0000000-0000-0000-0000-000000000009', 'city', 'Nowshera', 9),
    ('c0000000-0000-0000-0000-000000000010', 'city', 'Charsadda', 10),
    ('c0000000-0000-0000-0000-000000000011', 'city', 'Abbottabad', 11),
    ('c0000000-0000-0000-0000-000000000012', 'city', 'Other', 12)
ON CONFLICT (id) DO NOTHING;

-- Dependent Areas for Peshawar
INSERT INTO public.lookup_items (category, name, parent_id, sort_order)
VALUES
    ('area', 'Hayatabad Phase 1', 'c0000000-0000-0000-0000-000000000001', 1),
    ('area', 'Hayatabad Phase 2', 'c0000000-0000-0000-0000-000000000001', 2),
    ('area', 'Hayatabad Phase 3', 'c0000000-0000-0000-0000-000000000001', 3),
    ('area', 'Hayatabad Phase 4', 'c0000000-0000-0000-0000-000000000001', 4),
    ('area', 'Hayatabad Phase 5', 'c0000000-0000-0000-0000-000000000001', 5),
    ('area', 'University Town', 'c0000000-0000-0000-0000-000000000001', 6),
    ('area', 'DHA Peshawar', 'c0000000-0000-0000-0000-000000000001', 7),
    ('area', 'Saddar', 'c0000000-0000-0000-0000-000000000001', 8),
    ('area', 'Kohat Road Peshawar', 'c0000000-0000-0000-0000-000000000001', 9),
    ('area', 'Warsak Road', 'c0000000-0000-0000-0000-000000000001', 10),
    ('area', 'Ring Road', 'c0000000-0000-0000-0000-000000000001', 11)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. REALISTIC SAMPLE PATIENTS AND 30 DAYS OF BOOKINGS
-- Ensures every report, chart, and stat card is immediately functional
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_doc_id UUID := 'd1111111-1111-1111-1111-111111111111';
    v_shift_id UUID := 's1111111-1111-1111-1111-111111111111';
    v_admin_id UUID := '11111111-1111-1111-1111-111111111111';
    v_oper_id UUID := '22222222-2222-2222-2222-222222222222';
    v_recep_id UUID := '33333333-3333-3333-3333-333333333333';
    
    v_date DATE;
    v_day_offset INTEGER;
    v_slot_idx INTEGER;
    v_slot_minutes INTEGER;
    v_h24 INTEGER;
    v_min INTEGER;
    v_slot_time TEXT;
    v_slot_formatted TEXT;
    v_token_no INTEGER;
    v_res_type TEXT;
    v_source TEXT;
    v_purpose TEXT;
    v_status TEXT;
    v_creator UUID;
    v_patient_id UUID;
    v_mrn TEXT;
    
    first_names TEXT[] := ARRAY['Ahmed', 'Fatima', 'Usman', 'Ayesha', 'Bilal', 'Zainab', 'Tariq', 'Maryam', 'Hamza', 'Sana', 'Kashif', 'Hina', 'Rashid', 'Farah', 'Imran', 'Nazia', 'Junaid', 'Sadia', 'Waleed', 'Bushra'];
    last_names TEXT[] := ARRAY['Khan', 'Afridi', 'Ahmad', 'Shah', 'Qureshi', 'Malik', 'Rehman', 'Jan', 'Yousafzai', 'Shinwari', 'Mohmand', 'Bangash', 'Durrani', 'Bibi', 'Sultana'];
    sources TEXT[] := ARRAY['Self', 'Facebook', 'TikTok', 'Instagram', 'YouTube', 'Website', 'WhatsApp', 'Referral', 'Phone call'];
    purposes TEXT[] := ARRAY['Consultation', 'Follow Up', 'Procedure', 'Report Review'];
    areas TEXT[] := ARRAY['Hayatabad Phase 1', 'Hayatabad Phase 2', 'University Town', 'Kohat Road Peshawar', 'Saddar', 'Warsak Road', 'Ring Road'];
    
    v_daily_count INTEGER;
BEGIN
    -- Seed realistic bookings for the past 30 days up to today
    FOR v_day_offset IN 0..29 LOOP
        v_date := CURRENT_DATE - v_day_offset;
        
        -- Daily token counters start fresh at 0
        v_token_no := 0;
        
        -- Between 20 and 55 bookings per day for realistic clinical volume
        v_daily_count := 25 + (v_day_offset * 7) % 25;
        
        FOR v_slot_idx IN 1..v_daily_count LOOP
            v_token_no := v_token_no + 1;
            
            -- Slot times starting at 8:00 AM in 9-minute intervals
            v_slot_minutes := 8 * 60 + (v_slot_idx - 1) * 9;
            v_h24 := v_slot_minutes / 60;
            v_min := v_slot_minutes % 60;
            v_slot_time := to_char(v_h24, 'FM00') || ':' || to_char(v_min, 'FM00');
            
            v_slot_formatted := to_char(CASE WHEN v_h24 = 0 OR v_h24 = 12 THEN 12 ELSE v_h24 % 12 END, 'FM99') || ':' || 
                               to_char(v_min, 'FM00') || ' ' || 
                               CASE WHEN v_h24 >= 12 THEN 'p.m.' ELSE 'a.m.' END;
                               
            v_res_type := CASE WHEN v_slot_idx % 4 = 0 THEN 'Walk-in' ELSE 'Appointment' END;
            v_source := sources[1 + (v_slot_idx * 3 + v_day_offset) % array_length(sources, 1)];
            v_purpose := purposes[1 + (v_slot_idx * 2) % array_length(purposes, 1)];
            
            -- Past dates have realistic completion / absent distribution
            IF v_day_offset = 0 THEN
                -- Today: mixture of checked_in, pending, in_process
                IF v_slot_idx <= 12 THEN
                    v_status := 'checked_in';
                ELSIF v_slot_idx <= 15 THEN
                    v_status := 'in_process';
                ELSIF v_slot_idx % 10 = 0 THEN
                    v_status := 'absent';
                ELSE
                    v_status := 'pending';
                END IF;
            ELSE
                -- Past days: completed, absent, follow_up
                IF v_slot_idx % 12 = 0 THEN
                    v_status := 'absent';
                ELSIF v_purpose = 'Follow Up' THEN
                    v_status := 'follow_up';
                ELSE
                    v_status := 'completed';
                END IF;
            END IF;
            
            -- Rotate creator across Admin, Operator, Receptionist
            IF v_slot_idx % 3 = 1 THEN
                v_creator := v_oper_id;
            ELSIF v_slot_idx % 3 = 2 THEN
                v_creator := v_recep_id;
            ELSE
                v_creator := v_admin_id;
            END IF;
            
            -- Create patient
            v_mrn := 'MRN-' || LPAD((10000 + v_day_offset * 100 + v_slot_idx)::TEXT, 6, '0');
            INSERT INTO public.patients (
                patient_mrn, first_name, last_name, cnic, phone_code,
                phone_prefix, phone_number, full_phone, age, city, area
            ) VALUES (
                v_mrn,
                first_names[1 + (v_slot_idx + v_day_offset) % array_length(first_names, 1)],
                last_names[1 + (v_slot_idx * 2 + v_day_offset) % array_length(last_names, 1)],
                '17301' || LPAD((10000000 + v_slot_idx * 137 + v_day_offset * 99)::TEXT, 8, '0'),
                '+92',
                '3' || LPAD(((v_slot_idx * 7) % 49)::TEXT, 2, '0'),
                LPAD((1000000 + v_slot_idx * 179 + v_day_offset * 231)::TEXT, 7, '0'),
                '+923' || LPAD(((v_slot_idx * 7) % 49)::TEXT, 2, '0') || LPAD((1000000 + v_slot_idx * 179 + v_day_offset * 231)::TEXT, 7, '0'),
                20 + ((v_slot_idx * 3 + v_day_offset) % 55),
                'Peshawar',
                areas[1 + (v_slot_idx + v_day_offset) % array_length(areas, 1)]
            )
            RETURNING id INTO v_patient_id;
            
            -- Insert booking
            INSERT INTO public.bookings (
                booking_date, doctor_id, shift_id, patient_id,
                slot_index, slot_time, slot_time_formatted,
                token_number, token_code, purpose, reservation_type,
                source, called_as, status, created_by,
                check_in_time, completed_time
            ) VALUES (
                v_date, v_doc_id, v_shift_id, v_patient_id,
                v_slot_idx, v_slot_time, v_slot_formatted,
                v_token_no,
                CASE WHEN v_res_type = 'Walk-in' THEN 'W-' ELSE 'A-' END || LPAD(v_token_no::TEXT, 3, '0'),
                v_purpose, v_res_type,
                v_source, 'Hospital Patient', v_status, v_creator,
                CASE WHEN v_status IN ('checked_in', 'in_process', 'completed') THEN (v_date + TIME '08:30:00') ELSE NULL END,
                CASE WHEN v_status = 'completed' THEN (v_date + TIME '09:00:00') ELSE NULL END
            );
        END LOOP;
        
        -- Set token counter for that day
        INSERT INTO public.token_counters (doctor_id, shift_id, booking_date, reservation_type, current_token_no)
        VALUES 
            (v_doc_id, v_shift_id, v_date, 'Appointment', v_token_no),
            (v_doc_id, v_shift_id, v_date, 'Walk-in', GREATEST(1, v_token_no / 4))
        ON CONFLICT (doctor_id, shift_id, booking_date, reservation_type) DO NOTHING;
    END LOOP;
END $$;
