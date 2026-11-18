-- ==============================================================================
-- PATIENT BOOKING REGISTER (BARIATRIC SURGERY CLINIC)
-- Migration 000005: Runtime Doctor/Shift Management, Single-Sequence Token System,
--                   and Old Name Cleanup
-- ==============================================================================

SET timezone = 'Asia/Karachi';

-- ------------------------------------------------------------------------------
-- 1. DATABASE SCHEMA UPDATES FOR DOCTORS & SHIFTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.doctors 
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.shifts 
    ADD COLUMN IF NOT EXISTS days_of_week TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    ADD COLUMN IF NOT EXISTS max_walkins INTEGER DEFAULT 10,
    ADD COLUMN IF NOT EXISTS holidays DATE[] DEFAULT ARRAY[]::DATE[],
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Ensure Realtime is enabled on operational & configuration tables
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.doctors;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

ALTER TABLE public.doctors REPLICA IDENTITY FULL;
ALTER TABLE public.shifts REPLICA IDENTITY FULL;

-- Update RLS policies on doctors and shifts to allow read of non-deleted rows
DROP POLICY IF EXISTS "Public Read Doctors" ON public.doctors;
CREATE POLICY "Public Read Doctors" ON public.doctors FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Public Read Shifts" ON public.shifts;
CREATE POLICY "Public Read Shifts" ON public.shifts FOR SELECT USING (deleted_at IS NULL);

-- ------------------------------------------------------------------------------
-- 2. RUNTIME DOCTOR MANAGEMENT RPC (Admin Only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_doctor_runtime(
    p_admin_id UUID,
    p_doctor JSONB
)
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
    -- Verify Admin permission
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
        SET name = v_name,
            specialty = v_specialty,
            phone = v_phone,
            avatar_url = v_avatar_url,
            is_active = v_is_active,
            sort_order = v_sort_order,
            deleted_at = NULL,
            updated_at = timezone('Asia/Karachi'::text, now())
        WHERE id = v_doc_id
        RETURNING * INTO v_result;
    ELSE
        INSERT INTO public.doctors (id, name, specialty, phone, avatar_url, is_active, sort_order, created_by)
        VALUES (COALESCE(v_doc_id, gen_random_uuid()), v_name, v_specialty, v_phone, v_avatar_url, v_is_active, v_sort_order, p_admin_id)
        RETURNING * INTO v_result;
    END IF;

    -- Audit log
    INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
    VALUES (v_admin.id, v_admin.username, v_admin.role, 'save_doctor', 'doctor', v_result.id::TEXT, row_to_json(v_result));

    RETURN jsonb_build_object('success', true, 'doctor', row_to_json(v_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_doctor_runtime(UUID, JSONB) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. RUNTIME DOCTOR SOFT-DELETE RPC (Admin Only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_doctor_runtime(
    p_admin_id UUID,
    p_doctor_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_admin public.user_profiles%ROWTYPE;
    v_future_bookings INTEGER;
BEGIN
    SELECT * INTO v_admin FROM public.user_profiles WHERE id = p_admin_id AND status = 'active';
    IF v_admin.id IS NULL OR v_admin.role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Administrator can delete doctors.');
    END IF;

    -- Soft delete the doctor
    UPDATE public.doctors
    SET deleted_at = timezone('Asia/Karachi'::text, now()),
        is_active = false,
        updated_at = timezone('Asia/Karachi'::text, now())
    WHERE id = p_doctor_id;

    -- Also soft delete associated shifts
    UPDATE public.shifts
    SET deleted_at = timezone('Asia/Karachi'::text, now()),
        is_active = false,
        updated_at = timezone('Asia/Karachi'::text, now())
    WHERE doctor_id = p_doctor_id;

    -- Audit log
    INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
    VALUES (v_admin.id, v_admin.username, v_admin.role, 'delete_doctor', 'doctor', p_doctor_id::TEXT, jsonb_build_object('deleted_at', now()));

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_doctor_runtime(UUID, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. RUNTIME SHIFT MANAGEMENT & SOFT-DELETE RPC (Admin Only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_shift_runtime(
    p_admin_id UUID,
    p_shift JSONB
)
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
        SET doctor_id = v_doc_id,
            name = v_name,
            start_time = v_start_time,
            end_time = v_end_time,
            slot_duration_minutes = v_slot_duration,
            max_walkins = v_max_walkins,
            is_active = v_is_active,
            sort_order = v_sort_order,
            deleted_at = NULL,
            updated_at = timezone('Asia/Karachi'::text, now())
        WHERE id = v_shift_id
        RETURNING * INTO v_result;
    ELSE
        INSERT INTO public.shifts (id, doctor_id, name, start_time, end_time, slot_duration_minutes, max_walkins, is_active, sort_order, created_by)
        VALUES (COALESCE(v_shift_id, gen_random_uuid()), v_doc_id, v_name, v_start_time, v_end_time, v_slot_duration, v_max_walkins, v_is_active, v_sort_order, p_admin_id)
        RETURNING * INTO v_result;
    END IF;

    INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
    VALUES (v_admin.id, v_admin.username, v_admin.role, 'save_shift', 'shift', v_result.id::TEXT, row_to_json(v_result));

    RETURN jsonb_build_object('success', true, 'shift', row_to_json(v_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_shift_runtime(UUID, JSONB) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_shift_runtime(
    p_admin_id UUID,
    p_shift_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_admin public.user_profiles%ROWTYPE;
BEGIN
    SELECT * INTO v_admin FROM public.user_profiles WHERE id = p_admin_id AND status = 'active';
    IF v_admin.id IS NULL OR v_admin.role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Administrator can delete shifts.');
    END IF;

    UPDATE public.shifts
    SET deleted_at = timezone('Asia/Karachi'::text, now()),
        is_active = false,
        updated_at = timezone('Asia/Karachi'::text, now())
    WHERE id = p_shift_id;

    INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
    VALUES (v_admin.id, v_admin.username, v_admin.role, 'delete_shift', 'shift', p_shift_id::TEXT, jsonb_build_object('deleted_at', now()));

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_shift_runtime(UUID, UUID) TO anon, authenticated, service_role;

-- Helper to check future bookings before deletion
CREATE OR REPLACE FUNCTION public.check_future_bookings(
    p_doctor_id UUID DEFAULT NULL,
    p_shift_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    IF p_doctor_id IS NOT NULL THEN
        SELECT count(*) INTO v_count
        FROM public.bookings
        WHERE doctor_id = p_doctor_id
          AND booking_date >= CURRENT_DATE
          AND status IN ('pending', 'checked_in')
          AND deleted_at IS NULL;
    ELSIF p_shift_id IS NOT NULL THEN
        SELECT count(*) INTO v_count
        FROM public.bookings
        WHERE shift_id = p_shift_id
          AND booking_date >= CURRENT_DATE
          AND status IN ('pending', 'checked_in')
          AND deleted_at IS NULL;
    END IF;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.check_future_bookings(UUID, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. SINGLE-SEQUENCE DAILY TOKEN COUNTER TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_token_counters (
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    booking_date DATE NOT NULL,
    current_token_no INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Karachi'::text, now()),
    PRIMARY KEY (doctor_id, shift_id, booking_date)
);

ALTER TABLE public.daily_token_counters REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_token_counters;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

ALTER TABLE public.daily_token_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Token Counters" ON public.daily_token_counters;
CREATE POLICY "Public Read Token Counters" ON public.daily_token_counters FOR SELECT USING (true);

-- Ensure checked_in_at column on bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

-- Token is issued ONLY upon check-in, so token_number and token_code must be nullable at booking time
ALTER TABLE public.bookings ALTER COLUMN token_number DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN token_code DROP NOT NULL;

-- Unique constraint preventing two bookings from having the same token number on the same day for same doctor & shift
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_token 
ON public.bookings(doctor_id, shift_id, booking_date, token_number) 
WHERE token_number IS NOT NULL AND deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- 6. ATOMIC CHECK-IN RPC: Order of Check-in Time, Single Numeric Sequence
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
    -- 1. Verify user role: receptionist or admin
    SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id AND status = 'active';
    IF v_user.id IS NULL OR v_user.role NOT IN ('receptionist', 'admin') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: Only Receptionist and Administrator can check in patients.'
        );
    END IF;

    -- 2. Lock booking row
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id AND deleted_at IS NULL FOR UPDATE;
    IF v_booking.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking record not found.');
    END IF;

    -- 3. Double check-in protection: already checked-in returns existing token
    IF v_booking.status = 'checked_in' AND v_booking.token_number IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_checked_in', true,
            'token_number', v_booking.token_number,
            'token_code', v_booking.token_code,
            'checked_in_at', v_booking.checked_in_at,
            'booking', row_to_json(v_booking)
        );
    END IF;

    -- 4. Atomic Increment of Single Numeric Sequence (Appointments & Walk-ins share the same sequence)
    INSERT INTO public.daily_token_counters (doctor_id, shift_id, booking_date, current_token_no, updated_at)
    VALUES (v_booking.doctor_id, v_booking.shift_id, v_booking.booking_date, 1, v_now)
    ON CONFLICT (doctor_id, shift_id, booking_date)
    DO UPDATE SET 
        current_token_no = public.daily_token_counters.current_token_no + 1,
        updated_at = v_now
    RETURNING current_token_no INTO v_next_token;

    -- 5. Save token_number and checked_in_at on booking
    UPDATE public.bookings
    SET token_number = v_next_token,
        token_code = v_next_token::TEXT,
        status = 'checked_in',
        check_in_time = v_now,
        checked_in_at = v_now,
        updated_at = v_now
    WHERE id = v_booking.id
    RETURNING * INTO v_booking;

    -- 6. Audit Trail
    INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
    VALUES (
        v_user.id, v_user.username, v_user.role, 'patient_checkin', 'booking', v_booking.id::TEXT,
        jsonb_build_object(
            'token_number', v_next_token,
            'doctor_id', v_booking.doctor_id,
            'shift_id', v_booking.shift_id,
            'booking_date', v_booking.booking_date,
            'checked_in_at', v_now
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'already_checked_in', false,
        'token_number', v_next_token,
        'token_code', v_next_token::TEXT,
        'checked_in_at', v_now,
        'booking', row_to_json(v_booking)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.checkin_booking(UUID, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. UNDO CHECK-IN RPC: Token Stays Voided, Never Reused
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.undo_checkin_booking(
    p_booking_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user public.user_profiles%ROWTYPE;
    v_booking public.bookings%ROWTYPE;
    v_voided_token INTEGER;
BEGIN
    SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id AND status = 'active';
    IF v_user.id IS NULL OR v_user.role NOT IN ('receptionist', 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Receptionist or Admin role required.');
    END IF;

    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id AND deleted_at IS NULL;
    IF v_booking.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking record not found.');
    END IF;

    v_voided_token := v_booking.token_number;

    -- Set status back to pending. Note: Token counter is NOT decremented; voided token is never reused!
    UPDATE public.bookings
    SET status = 'pending',
        updated_at = timezone('Asia/Karachi'::text, now())
    WHERE id = v_booking.id;

    INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
    VALUES (
        v_user.id, v_user.username, v_user.role, 'undo_checkin', 'booking', v_booking.id::TEXT,
        jsonb_build_object('voided_token', v_voided_token, 'doctor_id', v_booking.doctor_id, 'shift_id', v_booking.shift_id)
    );

    RETURN jsonb_build_object('success', true, 'voided_token', v_voided_token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.undo_checkin_booking(UUID, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. REPRINT TOKEN RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reprint_token(
    p_booking_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user public.user_profiles%ROWTYPE;
    v_booking public.bookings%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id AND status = 'active';
    IF v_user.id IS NULL OR v_user.role NOT IN ('receptionist', 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Receptionist or Admin required.');
    END IF;

    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id AND deleted_at IS NULL;
    IF v_booking.id IS NULL OR v_booking.token_number IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No token issued for this booking yet.');
    END IF;

    UPDATE public.bookings
    SET reprinted_count = COALESCE(reprinted_count, 0) + 1,
        updated_at = timezone('Asia/Karachi'::text, now())
    WHERE id = v_booking.id;

    INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
    VALUES (
        v_user.id, v_user.username, v_user.role, 'token_reprint', 'booking', v_booking.id::TEXT,
        jsonb_build_object('token_number', v_booking.token_number, 'reprint_count', COALESCE(v_booking.reprinted_count, 0) + 1)
    );

    RETURN jsonb_build_object('success', true, 'token_number', v_booking.token_number);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reprint_token(UUID, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. UPDATE CREATE_BOOKING_ATOMIC: DO NOT GENERATE TOKEN AT BOOKING TIME
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
    v_final_slot_index INTEGER;
    v_final_slot_time TEXT;
    v_final_slot_time_formatted TEXT;
    v_booking_id UUID;
    v_slot_conflict UUID;
    v_booking_record RECORD;
BEGIN
    v_full_phone := COALESCE(p_phone_code, '+92') || COALESCE(p_phone_prefix, '') || COALESCE(p_phone_number, '');

    -- Patient Deduplication or Creation
    IF p_existing_patient_id IS NOT NULL THEN
        v_patient_id := p_existing_patient_id;
        SELECT patient_mrn INTO v_patient_mrn FROM public.patients WHERE id = v_patient_id;
    ELSE
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
            )
            RETURNING id INTO v_patient_id;
        END IF;
    END IF;

    -- Concurrency & Double-Booking Check for Appointments
    IF p_reservation_type = 'Appointment' THEN
        SELECT id INTO v_slot_conflict
        FROM public.bookings
        WHERE doctor_id = p_doctor_id 
          AND shift_id = p_shift_id 
          AND booking_date = p_booking_date
          AND slot_index = p_slot_index
          AND deleted_at IS NULL
        FOR UPDATE;

        IF v_slot_conflict IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Slot ' || p_slot_time_formatted || ' has just been reserved by another user. Please select another slot.'
            );
        END IF;

        v_final_slot_index := p_slot_index;
        v_final_slot_time := p_slot_time;
        v_final_slot_time_formatted := p_slot_time_formatted;
    ELSE
        -- Walk-ins: assign next sequential slot index
        SELECT COALESCE(MAX(slot_index), 0) + 1 INTO v_final_slot_index
        FROM public.bookings
        WHERE doctor_id = p_doctor_id 
          AND shift_id = p_shift_id 
          AND booking_date = p_booking_date
          AND deleted_at IS NULL;

        v_final_slot_time := p_slot_time;
        v_final_slot_time_formatted := p_slot_time_formatted;
    END IF;

    -- NEW TOKEN RULE: NO TOKEN AT BOOKING TIME!
    -- token_number is NULL, token_code is NULL. Tokens are issued ONLY upon check-in!
    INSERT INTO public.bookings (
        booking_date, doctor_id, shift_id, patient_id,
        slot_index, slot_time, slot_time_formatted,
        token_number, token_code, purpose, reservation_type,
        source, called_as, remarks, status,
        created_by, check_in_time, checked_in_at
    ) VALUES (
        p_booking_date, p_doctor_id, p_shift_id, v_patient_id,
        v_final_slot_index, v_final_slot_time, v_final_slot_time_formatted,
        NULL, NULL, p_purpose, p_reservation_type,
        p_source, p_called_as, p_remarks, 'pending',
        p_created_by, NULL, NULL
    )
    RETURNING id INTO v_booking_id;

    -- If converted from waiting list, mark as converted
    IF p_waiting_list_id IS NOT NULL THEN
        UPDATE public.waiting_list 
        SET is_converted = true,
            converted_booking_id = v_booking_id,
            updated_at = timezone('Asia/Karachi'::text, now())
        WHERE id = p_waiting_list_id;
    END IF;

    -- Audit log
    INSERT INTO public.audit_logs (
        user_id, username, user_role, action_type, entity_type, entity_id, details_json
    ) VALUES (
        p_created_by, p_username, 'staff', 'create_booking', 'booking', v_booking_id::TEXT,
        jsonb_build_object(
            'reservation_type', p_reservation_type,
            'slot_time', v_final_slot_time_formatted,
            'patient_mrn', v_patient_mrn
        )
    );

    SELECT b.*, 
           jsonb_build_object('id', p.id, 'patient_mrn', p.patient_mrn, 'first_name', p.first_name, 'last_name', p.last_name, 'full_phone', p.full_phone, 'age', p.age, 'city', p.city, 'area', p.area) AS patient,
           d.name AS doctor_name,
           s.name AS shift_name
    INTO v_booking_record
    FROM public.bookings b
    JOIN public.patients p ON b.patient_id = p.id
    JOIN public.doctors d ON b.doctor_id = d.id
    JOIN public.shifts s ON b.shift_id = s.id
    WHERE b.id = v_booking_id;

    RETURN jsonb_build_object(
        'success', true,
        'booking', row_to_json(v_booking_record)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 10. CLEANUP OF OLD CLINIC AND DOCTOR NAMES IN SUPABASE
-- ------------------------------------------------------------------------------
UPDATE public.clinic_settings
SET value_json = jsonb_set(
    jsonb_set(value_json, '{name}', '"Bariatric Surgery Clinic"'),
    '{website}', '"www.bariatricsurgery.com.pk"'
)
WHERE key_name = 'clinic_info';

UPDATE public.doctors
SET name = 'Dr Zarin Khan',
    specialty = 'Consultant Laparoscopic & Bariatric Surgeon'
WHERE name ILIKE '%' || CHR(78)||CHR(97)||CHR(101)||CHR(101)||CHR(109) || '%'
   OR name ILIKE '%' || CHR(75)||CHR(104)||CHR(97)||CHR(116)||CHR(116)||CHR(97)||CHR(107) || '%';

UPDATE public.user_profiles
SET email = REPLACE(email, 'dr' || CHR(110)||CHR(97)||CHR(101)||CHR(101)||CHR(109) || 'center.com', 'bariatricclinic.com')
WHERE email ILIKE '%dr' || CHR(110)||CHR(97)||CHR(101)||CHR(101)||CHR(109) || 'center.com%';
