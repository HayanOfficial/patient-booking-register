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
