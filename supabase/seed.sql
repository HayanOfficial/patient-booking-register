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
        'name', 'Dr Naeem Eye Laser & Retina Center',
        'tagline', 'Real-time schedule and patient coordination center',
        'phone', '+92-91-5840000',
        'address', 'Khyber Medical Centre, Dabgari Gardens, Peshawar',
        'website', 'www.drnaeemcenter.com',
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
    ('11111111-1111-1111-1111-111111111111', 'admin', 'System Administrator', 'admin@drnaeemcenter.com', 'admin', 'active', false, crypt('admin123', gen_salt('bf'))),
    ('22222222-2222-2222-2222-222222222222', 'operator', 'Lead Operator Ali', 'ali.operator@drnaeemcenter.com', 'operator', 'active', false, crypt('operator123', gen_salt('bf'))),
    ('33333333-3333-3333-3333-333333333333', 'receptionist', 'Front Desk Sara', 'sara.reception@drnaeemcenter.com', 'receptionist', 'active', false, crypt('reception123', gen_salt('bf')))
ON CONFLICT (username) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. DOCTORS & SHIFTS
-- ------------------------------------------------------------------------------
INSERT INTO public.doctors (id, name, specialty, phone, is_active, sort_order)
VALUES
    ('d1111111-1111-1111-1111-111111111111', 'Dr Naeem Khattak', 'Consultant Eye Surgeon & Retina Specialist', '+923005901111', true, 1),
    ('d2222222-2222-2222-2222-222222222222', 'Dr Zarin Khan', 'Consultant Physician & Internal Medicine', '+923005902222', true, 2)
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
    last_names TEXT[] := ARRAY['Khan', 'Afridi', 'Khattak', 'Shah', 'Qureshi', 'Malik', 'Rehman', 'Jan', 'Yousafzai', 'Shinwari', 'Mohmand', 'Bangash', 'Durrani', 'Bibi', 'Sultana'];
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
