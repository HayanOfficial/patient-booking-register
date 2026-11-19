const fs = require('fs');
const path = require('path');

const setupSql = `-- ==============================================================================
-- BARIATRIC SURGERY CLINIC - DR ZARIN KHAN
-- Complete Database Setup: Schema, RLS, Realtime, Functions & Seeds
-- Run this ONCE in your new Supabase Project SQL Editor
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
SET timezone = 'Asia/Karachi';

-- ------------------------------------------------------------------------------
-- 1. ROLES & PERMISSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name TEXT NOT NULL CHECK (role_name IN ('admin', 'operator', 'receptionist', 'counselor')),
    permission_key TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    UNIQUE(role_name, permission_key)
);

-- ------------------------------------------------------------------------------
-- 2. USER PROFILES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'receptionist', 'counselor')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    lockout_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    password_hash TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- ------------------------------------------------------------------------------
-- 3. CLINIC SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_name TEXT NOT NULL UNIQUE,
    value_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now())
);

-- ------------------------------------------------------------------------------
-- 4. DOCTORS & SHIFTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    slot_duration_minutes INTEGER NOT NULL DEFAULT 9,
    days_of_week TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    max_walkins INTEGER DEFAULT 10,
    holidays DATE[] DEFAULT ARRAY[]::DATE[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shifts_doctor ON public.shifts(doctor_id, is_active);

-- ------------------------------------------------------------------------------
-- 5. LOOKUP ITEMS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lookup_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL CHECK (category IN ('source', 'purpose', 'called_as', 'city', 'area')),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.lookup_items(id) ON DELETE CASCADE,
    color TEXT,
    icon TEXT,
    requires_counseling BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lookup_category ON public.lookup_items(category, is_active, sort_order);

-- ------------------------------------------------------------------------------
-- 6. PATIENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_mrn TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    cnic TEXT,
    phone_code TEXT NOT NULL DEFAULT '+92',
    phone_prefix TEXT NOT NULL DEFAULT '300',
    phone_number TEXT NOT NULL,
    full_phone TEXT NOT NULL,
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
-- 7. DAILY TOKEN COUNTERS (Single Numeric Sequence per doctor, shift, date)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_token_counters (
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    booking_date DATE NOT NULL,
    current_token_no INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    PRIMARY KEY (doctor_id, shift_id, booking_date)
);

-- ------------------------------------------------------------------------------
-- 8. BOOKINGS (token_number and token_code are NULLABLE by default!)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_date DATE NOT NULL,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id),
    shift_id UUID NOT NULL REFERENCES public.shifts(id),
    patient_id UUID NOT NULL REFERENCES public.patients(id),
    slot_index INTEGER NOT NULL,
    slot_time TEXT NOT NULL,
    slot_time_formatted TEXT NOT NULL,
    token_number INTEGER, -- NULL until reception check-in!
    token_code TEXT,      -- NULL until reception check-in!
    purpose TEXT NOT NULL DEFAULT 'Consultation',
    reservation_type TEXT NOT NULL DEFAULT 'Appointment' CHECK (reservation_type IN ('Appointment', 'Walk-in')),
    source TEXT NOT NULL DEFAULT 'Self',
    called_as TEXT NOT NULL DEFAULT 'Hospital Patient',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checked_in', 'in_process', 'completed', 'absent', 'follow_up', 'cancelled', 'rescheduled')),
    check_in_time TIMESTAMPTZ,
    checked_in_at TIMESTAMPTZ,
    in_process_time TIMESTAMPTZ,
    completed_time TIMESTAMPTZ,
    absent_time TIMESTAMPTZ,
    remarks TEXT,
    created_by UUID,
    reprinted_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bookings_date_doc ON public.bookings(booking_date, doctor_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_bookings_patient ON public.bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_token 
ON public.bookings(doctor_id, shift_id, booking_date, token_number) 
WHERE token_number IS NOT NULL AND deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- 9. WAITING LIST
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waiting_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_date DATE NOT NULL,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id),
    shift_id UUID NOT NULL REFERENCES public.shifts(id),
    patient_id UUID NOT NULL REFERENCES public.patients(id),
    requested_time_range TEXT,
    purpose TEXT NOT NULL DEFAULT 'Consultation',
    source TEXT NOT NULL DEFAULT 'Self',
    called_as TEXT NOT NULL DEFAULT 'Hospital Patient',
    priority_level TEXT NOT NULL DEFAULT 'Normal' CHECK (priority_level IN ('Low', 'Normal', 'High', 'Emergency')),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'converted', 'cancelled', 'expired')),
    is_converted BOOLEAN NOT NULL DEFAULT false,
    converted_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 10. COUNSELING MODULE TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.procedures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  category        TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi', now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi', now()),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_procedures_active
  ON public.procedures (is_active, sort_order)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.counseling_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting','in_counseling','done','voided')),
  counselor_id    UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  show_prices_on_slip BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi', now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi', now()),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cs_booking  ON public.counseling_sessions (booking_id);
CREATE INDEX IF NOT EXISTS idx_cs_status   ON public.counseling_sessions (status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.counseling_procedures (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                UUID NOT NULL REFERENCES public.counseling_sessions(id) ON DELETE CASCADE,
  procedure_id              UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
  procedure_name_snapshot   TEXT NOT NULL,
  procedure_category_snapshot TEXT,
  quoted_price              NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quoted_price >= 0),
  sort_order                INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi', now()),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi', now())
);

CREATE INDEX IF NOT EXISTS idx_cp_session ON public.counseling_procedures (session_id);

-- ------------------------------------------------------------------------------
-- 11. AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    username TEXT,
    user_role TEXT,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details_json JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id);

-- ------------------------------------------------------------------------------
-- 12. STORED PROCEDURES & CORE RPCS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_patient_mrn()
RETURNS TEXT AS $$
DECLARE
    v_year TEXT := to_char(now(), 'YY');
    v_seq INT;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(patient_mrn FROM 7)::INT), 0) + 1 INTO v_seq
    FROM public.patients
    WHERE patient_mrn LIKE 'MR' || v_year || '%';
    RETURN 'MR' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.login_user(
    p_username_or_email TEXT,
    p_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user public.user_profiles%ROWTYPE;
    v_now TIMESTAMPTZ := timezone('Asia/Karachi'::text, now());
BEGIN
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE (LOWER(username) = LOWER(TRIM(p_username_or_email)) 
           OR LOWER(email) = LOWER(TRIM(p_username_or_email)))
      AND deleted_at IS NULL;

    IF v_user.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid username or password');
    END IF;

    IF v_user.status = 'disabled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This account has been disabled. Contact your administrator.');
    END IF;

    IF v_user.lockout_until IS NOT NULL AND v_user.lockout_until > v_now THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account temporarily locked due to multiple failed logins. Please wait.');
    END IF;

    IF v_user.password_hash IS NOT NULL AND v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
        UPDATE public.user_profiles
        SET failed_attempts = failed_attempts + 1,
            lockout_until = CASE WHEN failed_attempts + 1 >= 5 THEN v_now + INTERVAL '5 minutes' ELSE NULL END,
            updated_at = v_now
        WHERE id = v_user.id;
        RETURN jsonb_build_object('success', false, 'error', 'Invalid username or password');
    END IF;

    UPDATE public.user_profiles
    SET failed_attempts = 0,
        lockout_until = NULL,
        last_login_at = v_now,
        updated_at = v_now
    WHERE id = v_user.id;

    RETURN jsonb_build_object(
        'success', true,
        'user', jsonb_build_object(
            'id', v_user.id,
            'username', v_user.username,
            'full_name', v_user.full_name,
            'email', v_user.email,
            'role', v_user.role,
            'must_change_password', v_user.must_change_password
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.login_user(TEXT, TEXT) TO anon, authenticated, service_role;

-- Runtime Doctor CRUD
CREATE OR REPLACE FUNCTION public.save_doctor_runtime(p_admin_id UUID, p_doctor JSONB)
RETURNS JSONB AS $$
DECLARE
    v_admin public.user_profiles%ROWTYPE;
    v_doc_id UUID;
    v_name TEXT := TRIM((p_doctor->>'name')::TEXT);
    v_specialty TEXT := TRIM((p_doctor->>'specialty')::TEXT);
    v_phone TEXT := NULLIF(TRIM((p_doctor->>'phone')::TEXT), '');
    v_avatar_url TEXT := NULLIF(TRIM((p_doctor->>'avatar_url')::TEXT), '');
    v_is_active BOOLEAN := COALESCE((p_doctor->>'is_active')::BOOLEAN, true);
    v_sort_order INTEGER := COALESCE((p_doctor->>'sort_order')::INTEGER, 1);
    v_result public.doctors%ROWTYPE;
BEGIN
    SELECT * INTO v_admin FROM public.user_profiles WHERE id = p_admin_id AND status = 'active';
    IF v_admin.id IS NULL OR v_admin.role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Administrator can manage doctors.');
    END IF;
    IF v_name IS NULL OR length(v_name) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Doctor name is required.');
    END IF;
    IF p_doctor->>'id' IS NOT NULL AND (p_doctor->>'id') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_doc_id := (p_doctor->>'id')::UUID;
    END IF;
    IF v_doc_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.doctors WHERE id = v_doc_id) THEN
        UPDATE public.doctors
        SET name = v_name, specialty = v_specialty, phone = v_phone, avatar_url = v_avatar_url,
            is_active = v_is_active, sort_order = v_sort_order, deleted_at = NULL,
            updated_at = timezone('Asia/Karachi'::text, now())
        WHERE id = v_doc_id RETURNING * INTO v_result;
    ELSE
        INSERT INTO public.doctors (id, name, specialty, phone, avatar_url, is_active, sort_order, created_by)
        VALUES (COALESCE(v_doc_id, gen_random_uuid()), v_name, v_specialty, v_phone, v_avatar_url, v_is_active, v_sort_order, p_admin_id)
        RETURNING * INTO v_result;
    END IF;
    RETURN jsonb_build_object('success', true, 'doctor', row_to_json(v_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_doctor_runtime(UUID, JSONB) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_doctor_runtime(p_admin_id UUID, p_doctor_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_admin public.user_profiles%ROWTYPE;
BEGIN
    SELECT * INTO v_admin FROM public.user_profiles WHERE id = p_admin_id AND status = 'active';
    IF v_admin.id IS NULL OR v_admin.role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Administrator can delete doctors.');
    END IF;
    UPDATE public.doctors SET deleted_at = timezone('Asia/Karachi'::text, now()), is_active = false WHERE id = p_doctor_id;
    UPDATE public.shifts SET deleted_at = timezone('Asia/Karachi'::text, now()), is_active = false WHERE doctor_id = p_doctor_id;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_doctor_runtime(UUID, UUID) TO anon, authenticated, service_role;

-- Runtime Shift CRUD
CREATE OR REPLACE FUNCTION public.save_shift_runtime(p_admin_id UUID, p_shift JSONB)
RETURNS JSONB AS $$
DECLARE
    v_admin public.user_profiles%ROWTYPE;
    v_shift_id UUID;
    v_doc_id UUID := (p_shift->>'doctor_id')::UUID;
    v_name TEXT := TRIM((p_shift->>'name')::TEXT);
    v_start_time TEXT := TRIM((p_shift->>'start_time')::TEXT);
    v_end_time TEXT := TRIM((p_shift->>'end_time')::TEXT);
    v_slot_duration INTEGER := COALESCE((p_shift->>'slot_duration_minutes')::INTEGER, 9);
    v_max_walkins INTEGER := COALESCE((p_shift->>'max_walkins')::INTEGER, 10);
    v_is_active BOOLEAN := COALESCE((p_shift->>'is_active')::BOOLEAN, true);
    v_sort_order INTEGER := COALESCE((p_shift->>'sort_order')::INTEGER, 1);
    v_result public.shifts%ROWTYPE;
BEGIN
    SELECT * INTO v_admin FROM public.user_profiles WHERE id = p_admin_id AND status = 'active';
    IF v_admin.id IS NULL OR v_admin.role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Administrator can manage shifts.');
    END IF;
    IF v_name IS NULL OR length(v_name) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Shift name is required.');
    END IF;
    IF p_shift->>'id' IS NOT NULL AND (p_shift->>'id') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_shift_id := (p_shift->>'id')::UUID;
    END IF;
    IF v_shift_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.shifts WHERE id = v_shift_id) THEN
        UPDATE public.shifts
        SET doctor_id = v_doc_id, name = v_name, start_time = v_start_time, end_time = v_end_time,
            slot_duration_minutes = v_slot_duration, max_walkins = v_max_walkins,
            is_active = v_is_active, sort_order = v_sort_order, deleted_at = NULL,
            updated_at = timezone('Asia/Karachi'::text, now())
        WHERE id = v_shift_id RETURNING * INTO v_result;
    ELSE
        INSERT INTO public.shifts (id, doctor_id, name, start_time, end_time, slot_duration_minutes, max_walkins, is_active, sort_order, created_by)
        VALUES (COALESCE(v_shift_id, gen_random_uuid()), v_doc_id, v_name, v_start_time, v_end_time, v_slot_duration, v_max_walkins, v_is_active, v_sort_order, p_admin_id)
        RETURNING * INTO v_result;
    END IF;
    RETURN jsonb_build_object('success', true, 'shift', row_to_json(v_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_shift_runtime(UUID, JSONB) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_shift_runtime(p_admin_id UUID, p_shift_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_admin public.user_profiles%ROWTYPE;
BEGIN
    SELECT * INTO v_admin FROM public.user_profiles WHERE id = p_admin_id AND status = 'active';
    IF v_admin.id IS NULL OR v_admin.role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Administrator can delete shifts.');
    END IF;
    UPDATE public.shifts SET deleted_at = timezone('Asia/Karachi'::text, now()), is_active = false WHERE id = p_shift_id;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_shift_runtime(UUID, UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_future_bookings(p_doctor_id UUID DEFAULT NULL, p_shift_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE v_count INTEGER := 0;
BEGIN
    IF p_doctor_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.bookings
        WHERE doctor_id = p_doctor_id AND booking_date >= CURRENT_DATE AND status IN ('pending', 'checked_in') AND deleted_at IS NULL;
    ELSIF p_shift_id IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.bookings
        WHERE shift_id = p_shift_id AND booking_date >= CURRENT_DATE AND status IN ('pending', 'checked_in') AND deleted_at IS NULL;
    END IF;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.check_future_bookings(UUID, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 13. ATOMIC BOOKING CREATION (Tokens are NULL at booking time!)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
    p_doctor_id UUID,
    p_shift_id UUID,
    p_booking_date DATE,
    p_slot_index INTEGER,
    p_slot_time TEXT,
    p_slot_time_formatted TEXT,
    p_reservation_type TEXT,
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
    v_final_slot_index INTEGER;
    v_final_slot_time TEXT;
    v_final_slot_time_formatted TEXT;
    v_booking_id UUID;
    v_slot_conflict UUID;
    v_booking_record RECORD;
BEGIN
    v_full_phone := COALESCE(p_phone_code, '+92') || COALESCE(p_phone_prefix, '') || COALESCE(p_phone_number, '');

    IF p_existing_patient_id IS NOT NULL THEN
        v_patient_id := p_existing_patient_id;
        SELECT patient_mrn INTO v_patient_mrn FROM public.patients WHERE id = v_patient_id;
    ELSE
        IF p_cnic IS NOT NULL AND length(trim(p_cnic)) = 13 THEN
            SELECT id, patient_mrn INTO v_patient_id, v_patient_mrn 
            FROM public.patients WHERE cnic = trim(p_cnic) AND deleted_at IS NULL LIMIT 1;
        END IF;

        IF v_patient_id IS NULL AND v_full_phone IS NOT NULL AND length(trim(v_full_phone)) >= 10 THEN
            SELECT id, patient_mrn INTO v_patient_id, v_patient_mrn 
            FROM public.patients WHERE full_phone = trim(v_full_phone) AND deleted_at IS NULL LIMIT 1;
        END IF;

        IF v_patient_id IS NULL THEN
            v_patient_mrn := public.generate_patient_mrn();
            INSERT INTO public.patients (
                patient_mrn, first_name, last_name, cnic, phone_code,
                phone_prefix, phone_number, full_phone, age, dob,
                city, area, address, created_by
            ) VALUES (
                v_patient_mrn, p_first_name, p_last_name, p_cnic, p_phone_code,
                p_phone_prefix, p_phone_number, v_full_phone, p_age, p_dob,
                p_city, p_area, p_address, p_created_by
            ) RETURNING id INTO v_patient_id;
        END IF;
    END IF;

    IF p_reservation_type = 'Appointment' THEN
        SELECT id INTO v_slot_conflict FROM public.bookings
        WHERE doctor_id = p_doctor_id AND shift_id = p_shift_id AND booking_date = p_booking_date
          AND slot_index = p_slot_index AND deleted_at IS NULL FOR UPDATE;

        IF v_slot_conflict IS NOT NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Slot ' || p_slot_time_formatted || ' has just been reserved by another user. Please select another slot.');
        END IF;

        v_final_slot_index := p_slot_index;
        v_final_slot_time := p_slot_time;
        v_final_slot_time_formatted := p_slot_time_formatted;
    ELSE
        SELECT COALESCE(MAX(slot_index), 0) + 1 INTO v_final_slot_index
        FROM public.bookings
        WHERE doctor_id = p_doctor_id AND shift_id = p_shift_id AND booking_date = p_booking_date AND deleted_at IS NULL;
        v_final_slot_time := p_slot_time;
        v_final_slot_time_formatted := p_slot_time_formatted;
    END IF;

    -- Token is NULL at booking time; issued strictly at reception check-in!
    INSERT INTO public.bookings (
        booking_date, doctor_id, shift_id, patient_id,
        slot_index, slot_time, slot_time_formatted,
        token_number, token_code, purpose, reservation_type,
        source, called_as, remarks, status, created_by
    ) VALUES (
        p_booking_date, p_doctor_id, p_shift_id, v_patient_id,
        v_final_slot_index, v_final_slot_time, v_final_slot_time_formatted,
        NULL, NULL, p_purpose, p_reservation_type,
        p_source, p_called_as, p_remarks, 'pending', p_created_by
    ) RETURNING id INTO v_booking_id;

    IF p_waiting_list_id IS NOT NULL THEN
        UPDATE public.waiting_list SET is_converted = true, converted_booking_id = v_booking_id, updated_at = timezone('Asia/Karachi'::text, now()) WHERE id = p_waiting_list_id;
    END IF;

    SELECT b.*, 
           jsonb_build_object('id', p.id, 'patient_mrn', p.patient_mrn, 'first_name', p.first_name, 'last_name', p.last_name, 'full_phone', p.full_phone, 'age', p.age, 'city', p.city, 'area', p.area) AS patient,
           d.name AS doctor_name, s.name AS shift_name
    INTO v_booking_record
    FROM public.bookings b
    JOIN public.patients p ON b.patient_id = p.id
    JOIN public.doctors d ON b.doctor_id = d.id
    JOIN public.shifts s ON b.shift_id = s.id
    WHERE b.id = v_booking_id;

    RETURN jsonb_build_object('success', true, 'booking', row_to_json(v_booking_record));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 14. ATOMIC CHECK-IN & COUNTER RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkin_booking(
    p_booking_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user public.user_profiles%ROWTYPE;
    v_booking public.bookings%ROWTYPE;
    v_next_token INTEGER;
    v_now TIMESTAMPTZ := timezone('Asia/Karachi'::text, now());
BEGIN
    SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id AND status = 'active';
    IF v_user.id IS NULL OR v_user.role NOT IN ('receptionist', 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Receptionist or Administrator required.');
    END IF;

    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id AND deleted_at IS NULL FOR UPDATE;
    IF v_booking.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking record not found.');
    END IF;

    IF v_booking.status = 'checked_in' AND v_booking.token_number IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'already_checked_in', true, 'token_number', v_booking.token_number, 'token_code', v_booking.token_code, 'checked_in_at', v_booking.checked_in_at, 'booking', row_to_json(v_booking));
    END IF;

    INSERT INTO public.daily_token_counters (doctor_id, shift_id, booking_date, current_token_no, updated_at)
    VALUES (v_booking.doctor_id, v_booking.shift_id, v_booking.booking_date, 1, v_now)
    ON CONFLICT (doctor_id, shift_id, booking_date)
    DO UPDATE SET current_token_no = public.daily_token_counters.current_token_no + 1, updated_at = v_now
    RETURNING current_token_no INTO v_next_token;

    UPDATE public.bookings
    SET token_number = v_next_token, token_code = v_next_token::TEXT,
        status = 'checked_in', check_in_time = v_now, checked_in_at = v_now, updated_at = v_now
    WHERE id = v_booking.id RETURNING * INTO v_booking;

    RETURN jsonb_build_object('success', true, 'already_checked_in', false, 'token_number', v_next_token, 'token_code', v_next_token::TEXT, 'checked_in_at', v_now, 'booking', row_to_json(v_booking));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.checkin_booking(UUID, UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.undo_checkin_booking(p_booking_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user public.user_profiles%ROWTYPE;
    v_booking public.bookings%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id AND status = 'active';
    IF v_user.id IS NULL OR v_user.role NOT IN ('receptionist', 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
    END IF;
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id AND deleted_at IS NULL;
    IF v_booking.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking record not found.');
    END IF;
    UPDATE public.bookings SET status = 'pending', updated_at = timezone('Asia/Karachi'::text, now()) WHERE id = v_booking.id;
    RETURN jsonb_build_object('success', true, 'voided_token', v_booking.token_number);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.undo_checkin_booking(UUID, UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reprint_token(p_booking_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user public.user_profiles%ROWTYPE;
    v_booking public.bookings%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id AND status = 'active';
    IF v_user.id IS NULL OR v_user.role NOT IN ('receptionist', 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
    END IF;
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id AND deleted_at IS NULL;
    IF v_booking.id IS NULL OR v_booking.token_number IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No token issued for this booking yet.');
    END IF;
    UPDATE public.bookings SET reprinted_count = COALESCE(reprinted_count, 0) + 1, updated_at = timezone('Asia/Karachi'::text, now()) WHERE id = v_booking.id;
    RETURN jsonb_build_object('success', true, 'token_number', v_booking.token_number);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reprint_token(UUID, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 15. COUNSELING MODULE RPCS & TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.counseling_checkin(p_booking_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user       public.user_profiles%ROWTYPE;
  v_booking    public.bookings%ROWTYPE;
  v_session    public.counseling_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id AND status = 'active';
  IF v_user.id IS NULL OR v_user.role NOT IN ('admin','counselor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Counselor or Admin required.');
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found.');
  END IF;
  SELECT * INTO v_session FROM public.counseling_sessions WHERE booking_id = p_booking_id;
  IF v_session.id IS NULL THEN
    INSERT INTO public.counseling_sessions (booking_id, status, counselor_id, started_at, created_by)
    VALUES (p_booking_id, 'in_counseling', p_user_id, timezone('Asia/Karachi', now()), p_user_id)
    RETURNING * INTO v_session;
  ELSIF v_session.status = 'in_counseling' THEN
    RETURN jsonb_build_object('success', true, 'already_started', true, 'session', row_to_json(v_session));
  ELSIF v_session.status = 'done' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Counseling already completed for this patient.');
  ELSE
    UPDATE public.counseling_sessions SET status = 'in_counseling', counselor_id = p_user_id, started_at = timezone('Asia/Karachi', now()), updated_at = timezone('Asia/Karachi', now()) WHERE id = v_session.id RETURNING * INTO v_session;
  END IF;
  RETURN jsonb_build_object('success', true, 'already_started', false, 'session', row_to_json(v_session));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.counseling_checkin(UUID, UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_counseling(
  p_booking_id UUID,
  p_user_id    UUID,
  p_items      JSONB,
  p_notes      TEXT DEFAULT NULL,
  p_complete   BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_user    public.user_profiles%ROWTYPE;
  v_session public.counseling_sessions%ROWTYPE;
  v_item    JSONB;
  v_new_status TEXT;
  v_total   NUMERIC(12,2) := 0;
BEGIN
  SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id AND status = 'active';
  IF v_user.id IS NULL OR v_user.role NOT IN ('admin','counselor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;
  SELECT * INTO v_session FROM public.counseling_sessions WHERE booking_id = p_booking_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No counseling session found.');
  END IF;
  IF v_session.status = 'done' AND v_user.role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Counseling already completed.');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    IF (v_item->>'quoted_price')::NUMERIC < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Price cannot be negative.');
    END IF;
    IF (v_item->>'procedure_name_snapshot') IS NULL OR TRIM(v_item->>'procedure_name_snapshot') = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Procedure name is required.');
    END IF;
    v_total := v_total + COALESCE((v_item->>'quoted_price')::NUMERIC, 0);
  END LOOP;

  DELETE FROM public.counseling_procedures WHERE session_id = v_session.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO public.counseling_procedures (
      session_id, procedure_id, procedure_name_snapshot,
      procedure_category_snapshot, quoted_price, sort_order
    ) VALUES (
      v_session.id,
      CASE WHEN (v_item->>'procedure_id') IS NOT NULL THEN (v_item->>'procedure_id')::UUID ELSE NULL END,
      TRIM(v_item->>'procedure_name_snapshot'),
      v_item->>'procedure_category_snapshot',
      COALESCE((v_item->>'quoted_price')::NUMERIC, 0),
      COALESCE((v_item->>'sort_order')::INTEGER, 0)
    );
  END LOOP;

  v_new_status := CASE WHEN p_complete THEN 'done' ELSE v_session.status END;
  UPDATE public.counseling_sessions
  SET notes = COALESCE(p_notes, notes), status = v_new_status,
      completed_at = CASE WHEN p_complete AND completed_at IS NULL THEN timezone('Asia/Karachi', now()) ELSE completed_at END,
      updated_at = timezone('Asia/Karachi', now())
  WHERE id = v_session.id RETURNING * INTO v_session;

  RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session), 'total', v_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_counseling(UUID, UUID, JSONB, TEXT, BOOLEAN) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.undo_counseling_checkin(p_booking_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user    public.user_profiles%ROWTYPE;
  v_session public.counseling_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id AND status = 'active';
  IF v_user.id IS NULL OR v_user.role NOT IN ('admin','counselor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;
  SELECT * INTO v_session FROM public.counseling_sessions WHERE booking_id = p_booking_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No counseling session found.');
  END IF;
  UPDATE public.counseling_sessions SET status = 'waiting', counselor_id = NULL, started_at = NULL, updated_at = timezone('Asia/Karachi', now()) WHERE id = v_session.id;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.undo_counseling_checkin(UUID, UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_counseling_queue(p_date DATE DEFAULT CURRENT_DATE, p_doctor_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE v_user public.user_profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.user_profiles WHERE id = auth.uid() AND status = 'active';
  IF v_user.id IS NULL OR v_user.role NOT IN ('admin','counselor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;
  RETURN (
    SELECT jsonb_agg(row_to_json(r) ORDER BY b.token_number NULLS LAST, cs.created_at)
    FROM public.counseling_sessions cs
    JOIN public.bookings b ON b.id = cs.booking_id
    JOIN public.patients p ON p.id = b.patient_id
    JOIN public.doctors  d ON d.id = b.doctor_id
    LEFT JOIN public.user_profiles counselor ON counselor.id = cs.counselor_id
    CROSS JOIN LATERAL (
      SELECT
        cs.id AS session_id, cs.status AS counseling_status, cs.started_at, cs.completed_at, cs.notes,
        counselor.full_name AS counselor_name, b.id AS booking_id, b.booking_date, b.token_number,
        b.purpose, b.reservation_type, b.source, b.called_as, b.check_in_time, b.checked_in_at,
        b.doctor_id, d.name AS doctor_name, p.id AS patient_id, p.patient_mrn, p.first_name,
        p.last_name, p.age, p.full_phone, p.city, p.area
    ) r
    WHERE b.booking_date = p_date AND cs.deleted_at IS NULL AND (p_doctor_id IS NULL OR b.doctor_id = p_doctor_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_counseling_queue(DATE, UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_counseling_session_detail(p_session_id UUID)
RETURNS JSONB AS $$
DECLARE v_user public.user_profiles%ROWTYPE; v_session public.counseling_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.user_profiles WHERE id = auth.uid() AND status = 'active';
  IF v_user.id IS NULL OR v_user.role NOT IN ('admin','counselor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Prices are confidential.');
  END IF;
  SELECT * INTO v_session FROM public.counseling_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found.');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'session', row_to_json(v_session),
    'procedures', (SELECT COALESCE(jsonb_agg(row_to_json(cp) ORDER BY cp.sort_order), '[]'::jsonb) FROM public.counseling_procedures cp WHERE cp.session_id = p_session_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_counseling_session_detail(UUID) TO anon, authenticated, service_role;

-- Counseling trigger on check-in
CREATE OR REPLACE FUNCTION public.trg_auto_create_counseling_session()
RETURNS TRIGGER AS $$
DECLARE v_requires BOOLEAN;
BEGIN
  IF NEW.status = 'checked_in' AND (OLD.status IS NULL OR OLD.status <> 'checked_in') THEN
    SELECT COALESCE(requires_counseling, false) INTO v_requires
    FROM public.lookup_items WHERE category = 'purpose' AND LOWER(name) = LOWER(NEW.purpose) AND is_active = true LIMIT 1;
    IF v_requires THEN
      INSERT INTO public.counseling_sessions (booking_id, status, created_by)
      VALUES (NEW.id, 'waiting', NEW.created_by)
      ON CONFLICT (booking_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_auto_create_counseling_session
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_create_counseling_session();

CREATE OR REPLACE VIEW public.v_booking_counseling_status AS
SELECT b.id AS booking_id, cs.id AS session_id, cs.status AS counseling_status, cs.started_at, cs.completed_at
FROM public.bookings b
LEFT JOIN public.counseling_sessions cs ON cs.booking_id = b.id AND cs.deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- 16. REALTIME REPLICATION
-- ------------------------------------------------------------------------------
ALTER TABLE public.doctors REPLICA IDENTITY FULL;
ALTER TABLE public.shifts REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.daily_token_counters REPLICA IDENTITY FULL;
ALTER TABLE public.waiting_list REPLICA IDENTITY FULL;
ALTER TABLE public.patients REPLICA IDENTITY FULL;
ALTER TABLE public.user_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.procedures REPLICA IDENTITY FULL;
ALTER TABLE public.counseling_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.counseling_procedures REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.doctors; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_token_counters; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.waiting_list; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.patients; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.procedures; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.counseling_sessions; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.counseling_procedures; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ------------------------------------------------------------------------------
-- 17. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookup_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_token_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counseling_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counseling_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow Select Doctors" ON public.doctors FOR SELECT USING (true);
CREATE POLICY "Allow Select Shifts" ON public.shifts FOR SELECT USING (true);
CREATE POLICY "Allow Select Lookups" ON public.lookup_items FOR SELECT USING (true);
CREATE POLICY "Allow Select Patients" ON public.patients FOR SELECT USING (true);
CREATE POLICY "Allow Select Token Counters" ON public.daily_token_counters FOR SELECT USING (true);
CREATE POLICY "Allow Select Bookings" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Allow Select Waiting List" ON public.waiting_list FOR SELECT USING (true);
CREATE POLICY "Allow Select Procedures" ON public.procedures FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Allow Select Counseling Sessions" ON public.counseling_sessions FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Allow Select Counseling Procedures" ON public.counseling_procedures FOR SELECT USING (true);

-- ------------------------------------------------------------------------------
-- 18. INITIAL SEED DATA (Clean: Bariatric Surgery Clinic, Dr Zarin Khan)
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
ON CONFLICT (key_name) DO UPDATE SET value_json = EXCLUDED.value_json;

-- Staff Accounts
INSERT INTO public.user_profiles (id, username, full_name, email, role, status, must_change_password, password_hash)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin', 'System Administrator', 'admin@bariatricclinic.com', 'admin', 'active', false, crypt('admin123', gen_salt('bf'))),
    ('22222222-2222-2222-2222-222222222222', 'operator', 'Lead Operator Ali', 'ali.operator@bariatricclinic.com', 'operator', 'active', false, crypt('operator123', gen_salt('bf'))),
    ('33333333-3333-3333-3333-333333333333', 'receptionist', 'Front Desk Sara', 'sara.reception@bariatricclinic.com', 'receptionist', 'active', false, crypt('reception123', gen_salt('bf'))),
    ('44444444-4444-4444-4444-444444444444', 'counselor', 'Lead Counselor Sana', 'counselor@bariatricclinic.com', 'counselor', 'active', false, crypt('counselor123', gen_salt('bf')))
ON CONFLICT (username) DO NOTHING;

-- Doctor: Dr Zarin Khan
INSERT INTO public.doctors (id, name, specialty, phone, is_active, sort_order)
VALUES
    ('d1111111-1111-1111-1111-111111111111', 'Dr Zarin Khan', 'Consultant Laparoscopic & Bariatric Surgeon', '+923005901111', true, 1),
    ('d2222222-2222-2222-2222-222222222222', 'Dr Tariq Shah', 'Consultant Laparoscopic & General Surgeon', '+923005902222', true, 2)
ON CONFLICT (id) DO NOTHING;

-- Shifts
INSERT INTO public.shifts (id, doctor_id, name, start_time, end_time, slot_duration_minutes, is_active, sort_order)
VALUES
    ('s1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Default Shift', '08:00', '22:00', 9, true, 1),
    ('s2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'Morning Shift', '09:00', '14:00', 10, true, 2),
    ('s3333333-3333-3333-3333-333333333333', 'd2222222-2222-2222-2222-222222222222', 'Evening Shift', '15:00', '21:00', 12, true, 1)
ON CONFLICT (id) DO NOTHING;

-- Lookup Items
INSERT INTO public.lookup_items (category, name, color, icon, sort_order, requires_counseling) VALUES
    ('source', 'Self', '#3B82F6', 'user', 1, false),
    ('source', 'Facebook', '#1877F2', 'facebook', 2, false),
    ('source', 'TikTok', '#000000', 'video', 3, false),
    ('source', 'Instagram', '#E1306C', 'camera', 4, false),
    ('source', 'YouTube', '#FF0000', 'youtube', 5, false),
    ('source', 'Website', '#10B981', 'globe', 6, false),
    ('source', 'WhatsApp', '#25D366', 'message-circle', 7, false),
    ('source', 'Referral', '#8B5CF6', 'users', 8, false),
    ('source', 'Phone call', '#EC4899', 'phone', 9, false),
    ('purpose', 'Consultation', '#2563EB', 'stethoscope', 1, true),
    ('purpose', 'Follow-up', '#059669', 'repeat', 2, false),
    ('purpose', 'Post-Op Check', '#D97706', 'activity', 3, false),
    ('purpose', 'Report Review', '#7C3AED', 'file-text', 4, false),
    ('called_as', 'Hospital Patient', '#3B82F6', 'user', 1, false),
    ('called_as', 'VIP', '#EF4444', 'star', 2, false),
    ('called_as', 'Staff Relative', '#10B981', 'heart', 3, false),
    ('city', 'Peshawar', NULL, 'map-pin', 1, false),
    ('city', 'Islamabad', NULL, 'map-pin', 2, false),
    ('city', 'Rawalpindi', NULL, 'map-pin', 3, false),
    ('city', 'Mardan', NULL, 'map-pin', 4, false),
    ('city', 'Swat', NULL, 'map-pin', 5, false)
ON CONFLICT DO NOTHING;

-- 97 Surgical Procedures
INSERT INTO public.procedures (name, category, is_active, sort_order) VALUES
  ('Laparoscopic cholecystectomy', 'Gallbladder & biliary', true, 1),
  ('Laparoscopic or open cholecystectomy', 'Gallbladder & biliary', true, 2),
  ('Common bile duct (CBD) exploration', 'Gallbladder & biliary', true, 3),
  ('Laparoscopy-assisted ERCP', 'Gallbladder & biliary', true, 4),
  ('One-anastomosis gastric bypass (OAGB)', 'Bariatric', true, 5),
  ('OAGB reversal', 'Bariatric', true, 6),
  ('Roux-en-Y gastric bypass (RYGB)', 'Bariatric', true, 7),
  ('Sleeve gastrectomy', 'Bariatric', true, 8),
  ('Revisional bariatric surgery', 'Bariatric', true, 9),
  ('Diagnostic laparoscopy, including proceed and revision entries', 'Diagnostic & abdominal', true, 10),
  ('Diagnostic laparoscopy with mesh exploration', 'Diagnostic & abdominal', true, 11),
  ('Diagnostic laparoscopy with mesh removal', 'Diagnostic & abdominal', true, 12),
  ('Examination under anaesthesia (EUA)', 'Diagnostic & abdominal', true, 13),
  ('Laparotomy', 'Diagnostic & abdominal', true, 14),
  ('Exploratory laparotomy', 'Diagnostic & abdominal', true, 15),
  ('Laparoscopic appendicectomy', 'Colorectal & anal', true, 16),
  ('Laparoscopic gastrojejunostomy', 'Upper gastrointestinal', true, 17),
  ('Laparoscopic duodenojejunostomy', 'Upper gastrointestinal', true, 18),
  ('Laparoscopic fundoplication', 'Upper gastrointestinal', true, 19),
  ('Laparoscopic hiatus hernia repair', 'Hernia', true, 20),
  ('Laparoscopic hernia repair, type unspecified', 'Hernia', true, 21),
  ('Hernia repair / mesh repair, site unspecified', 'Hernia', true, 22),
  ('Left inguinal hernia repair, including mesh repair', 'Hernia', true, 23),
  ('Right inguinal hernia repair, including mesh and large/recurrent cases', 'Hernia', true, 24),
  ('Bilateral inguinal hernia entry', 'Hernia', true, 25),
  ('Laparoscopic anterior resection (AR)', 'Colorectal & anal', true, 26),
  ('Abdominoperineal resection (APR), including laparoscopic entries', 'Colorectal & anal', true, 27),
  ('AR/APR, recorded without a definite choice', 'Colorectal & anal', true, 28),
  ('Laparoscopic right hemicolectomy', 'Colorectal & anal', true, 29),
  ('Laparoscopic rectopexy, including mesh rectopexy', 'Colorectal & anal', true, 30),
  ('Ileostomy closure/reversal', 'Colorectal & anal', true, 31),
  ('Colostomy closure', 'Colorectal & anal', true, 32),
  ('Stoma closure / STOMA REV', 'Colorectal & anal', true, 33),
  ('Seton removal', 'Colorectal & anal', true, 34),
  ('EPSiT', 'Colorectal & anal', true, 35),
  ('Laparoscopic splenectomy', 'Pancreas & spleen', true, 36),
  ('Whipple procedure', 'Pancreas & spleen', true, 37),
  ('Laparoscopic hydatid cyst surgery', 'Cyst procedures', true, 38),
  ('Laparoscopic deroofing', 'Cyst procedures', true, 39),
  ('Laparoscopic cystectomy', 'Cyst procedures', true, 40),
  ('Nephrectomy, including right, left, laparoscopic and RD entries', 'Urology', true, 41),
  ('Pyeloplasty, including laparoscopic and left-sided entries', 'Urology', true, 42),
  ('Right pyelolithotomy', 'Urology', true, 43),
  ('Right orchidectomy', 'Urology', true, 44),
  ('Cystoscopy', 'Urology', true, 45),
  ('Total abdominal hysterectomy (TAH)', 'Gynaecology', true, 46),
  ('Total laparoscopic hysterectomy (TLH)', 'Gynaecology', true, 47),
  ('TAH/TLH, approach not definitively specified', 'Gynaecology', true, 48),
  ('TLH with bilateral salpingo-oophorectomy (BSO)', 'Gynaecology', true, 49),
  ('TLH with BSO and omentectomy / BSO-Omentectomy variant', 'Gynaecology', true, 50),
  ('Myomectomy', 'Gynaecology', true, 51),
  ('Excision under local, general or spinal anaesthesia', 'Minor surgery & biopsy', true, 52),
  ('Incision and drainage (I&D)', 'Minor surgery & biopsy', true, 53),
  ('Foreign-body removal', 'Minor surgery & biopsy', true, 54),
  ('Lymph-node biopsy', 'Minor surgery & biopsy', true, 55),
  ('Muscle biopsy', 'Minor surgery & biopsy', true, 56),
  ('Tru-cut biopsy', 'Minor surgery & biopsy', true, 57),
  ('Abdominoplasty', 'Plastic surgery', true, 58),
  ('Thyroid surgery', 'Thyroid', true, 59),
  ('MRM + AC', 'Breast', true, 60),
  ('Laparoscopic cholecystectomy + appendicectomy', 'Combined procedures', true, 61),
  ('Laparoscopic cholecystectomy + CBD procedure', 'Combined procedures', true, 62),
  ('Laparoscopic cholecystectomy + ERCP', 'Combined procedures', true, 63),
  ('Laparoscopic cholecystectomy + TLH', 'Combined procedures', true, 64),
  ('Laparoscopic cholecystectomy + splenectomy', 'Combined procedures', true, 65),
  ('Laparoscopic cholecystectomy + cyst procedure', 'Combined procedures', true, 66),
  ('OAGB + cholecystectomy', 'Combined procedures', true, 67),
  ('Sleeve gastrectomy + cholecystectomy', 'Combined procedures', true, 68),
  ('Diagnostic laparoscopy + cholecystectomy', 'Combined procedures', true, 69),
  ('Diagnostic laparoscopy + excision', 'Combined procedures', true, 70),
  ('Laparotomy + gastrojejunostomy', 'Combined procedures', true, 71),
  ('Laparotomy + Whipple procedure', 'Combined procedures', true, 72),
  ('Laparoscopic distal pancreatic/splenic surgery', 'Combined procedures', true, 73),
  ('ERCP + right nephrectomy', 'Combined procedures', true, 74),
  ('DX LAP/ORCHIDE', 'Combined procedures', true, 75),
  ('FIA + HMD', 'Combined procedures', true, 76),
  ('OAGB REV/CHOLE', 'Combined procedures', true, 77),
  ('REV OAGB + CHOLE', 'Combined procedures', true, 78),
  ('Abscess', 'Condition-only entries', true, 79),
  ('Anal fissure', 'Condition-only entries', true, 80),
  ('Bladder stone', 'Condition-only entries', true, 81),
  ('Renal cyst', 'Condition-only entries', true, 82),
  ('Left hydrocele', 'Condition-only entries', true, 83),
  ('Fistula-in-ano (FIA)', 'Condition-only entries', true, 84),
  ('Piles', 'Condition-only entries', true, 85),
  ('Pilonidal sinus (PNS)', 'Condition-only entries', true, 86),
  ('Rectal polyp', 'Condition-only entries', true, 87),
  ('Ingrown toenail (IGTN)', 'Condition-only entries', true, 88),
  ('Varicose veins', 'Condition-only entries', true, 89),
  ('LAP CYSTGASTRECTOMY', 'Unclear records', true, 90),
  ('LAP Urethrolithotomy', 'Unclear records', true, 91),
  ('RT ORCHI SPINAL', 'Unclear records', true, 92),
  ('RT UDP', 'Unclear records', true, 93),
  ('D/D', 'Unclear records', true, 94),
  ('D/D SPINAL', 'Unclear records', true, 95),
  ('EUA/PROCEED/CYST..', 'Unclear records', true, 96),
  ('SLEEVE +', 'Unclear records', true, 97)
ON CONFLICT DO NOTHING;
`;

fs.writeFileSync(path.join(__dirname, '../supabase/zarin_clinic_setup.sql'), setupSql, 'utf8');
console.log('Successfully generated supabase/zarin_clinic_setup.sql');
