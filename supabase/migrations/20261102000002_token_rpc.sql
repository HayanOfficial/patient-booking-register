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
