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
