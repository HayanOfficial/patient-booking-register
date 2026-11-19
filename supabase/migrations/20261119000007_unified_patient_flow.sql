-- ==============================================================================
-- Bariatric Surgery Clinic: Patient Booking Register
-- Migration 000007: Unified One-Patient Flow & Counseling Handoff
-- 
-- Flow:
-- Booked (pending) -> Checked In (checked_in) -> In Progress (in_process) ->
-- Completed (completed) -> Checked Out (checked_out) -> In Counseling (in_counseling) ->
-- Procedure Done (procedure_done)
-- ==============================================================================

SET timezone = 'Asia/Karachi';

-- ------------------------------------------------------------------------------
-- 1. UPDATE BOOKING STATUS CONSTRAINTS & COLUMNS
-- ------------------------------------------------------------------------------
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status IN (
    'pending',        -- Booked by operator / walk-in
    'checked_in',     -- Receptionist checked in & issued token
    'in_process',     -- Doctor consultation in progress
    'completed',      -- Doctor consultation finished
    'checked_out',    -- Checked out by reception & handed over to counseling
    'in_counseling',  -- In counseling session with counselor
    'procedure_done', -- Procedure advised, pricing confirmed, slip printed
    'absent',         -- Patient did not show up
    'cancelled',      -- Cancelled
    'follow_up',      -- Follow-up booking
    'rescheduled'     -- Rescheduled
  ));

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS checkout_time TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 2. TRIGGER: AUTO-CREATE COUNSELING SESSION ON CHECKOUT
--    Every patient who is Checked Out by reception goes to counseling.
--    No dependency on purpose or requires_counseling flag!
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_auto_create_counseling_session()
RETURNS TRIGGER AS $$
BEGIN
  -- When booking status becomes checked_out, automatically queue for counseling
  IF NEW.status = 'checked_out' AND (OLD.status IS NULL OR OLD.status <> 'checked_out') THEN
    INSERT INTO public.counseling_sessions (booking_id, status, created_by)
    VALUES (NEW.id, 'waiting', NEW.created_by)
    ON CONFLICT (booking_id) DO UPDATE
      SET status = 'waiting',
          updated_at = timezone('Asia/Karachi', now())
      WHERE counseling_sessions.status <> 'done';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_create_counseling_session ON public.bookings;
CREATE TRIGGER trg_auto_create_counseling_session
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_create_counseling_session();

-- ------------------------------------------------------------------------------
-- 3. RPC: advance_booking_status
--    Progresses patient through the clinic workflow:
--    checked_in -> in_process -> completed -> checked_out
--    Plus undo for each step.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_booking_status(
    p_booking_id    UUID,
    p_user_id       UUID,
    p_target_status TEXT, -- 'in_process', 'completed', 'checked_out', 'checked_in', etc.
    p_reason        TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user public.user_profiles%ROWTYPE;
    v_booking public.bookings%ROWTYPE;
    v_now TIMESTAMPTZ := timezone('Asia/Karachi'::text, now());
    v_session public.counseling_sessions%ROWTYPE;
BEGIN
    -- 1. Verify user
    SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id AND status = 'active';
    IF v_user.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive user account.');
    END IF;

    -- Operator CANNOT advance or change workflow statuses
    IF v_user.role = 'operator' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Operator role cannot advance patient status.');
    END IF;

    -- Only Admin and Receptionist can move patient through reception steps
    IF v_user.role NOT IN ('admin', 'receptionist', 'counselor') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Insufficient permissions.');
    END IF;

    -- 2. Lock booking row
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id AND deleted_at IS NULL FOR UPDATE;
    IF v_booking.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking record not found.');
    END IF;

    -- 3. Execute target transition
    IF p_target_status = 'in_process' THEN
        UPDATE public.bookings
        SET status = 'in_process',
            in_process_time = COALESCE(in_process_time, v_now),
            updated_at = v_now
        WHERE id = p_booking_id
        RETURNING * INTO v_booking;

    ELSIF p_target_status = 'completed' THEN
        -- If undoing checkout, void pending counseling session if not yet started
        IF v_booking.status = 'checked_out' THEN
            UPDATE public.counseling_sessions
            SET status = 'voided', updated_at = v_now
            WHERE booking_id = p_booking_id AND status = 'waiting';
        END IF;

        UPDATE public.bookings
        SET status = 'completed',
            completed_time = COALESCE(completed_time, v_now),
            updated_at = v_now
        WHERE id = p_booking_id
        RETURNING * INTO v_booking;

    ELSIF p_target_status = 'checked_out' THEN
        UPDATE public.bookings
        SET status = 'checked_out',
            checkout_time = v_now,
            updated_at = v_now
        WHERE id = p_booking_id
        RETURNING * INTO v_booking;

        -- Idempotently create or activate counseling session in waiting queue
        INSERT INTO public.counseling_sessions (booking_id, status, created_by)
        VALUES (p_booking_id, 'waiting', p_user_id)
        ON CONFLICT (booking_id) DO UPDATE
          SET status = 'waiting',
              updated_at = v_now
          WHERE counseling_sessions.status <> 'done'
        RETURNING * INTO v_session;

    ELSIF p_target_status = 'checked_in' THEN
        -- Undo in_process back to checked_in
        UPDATE public.bookings
        SET status = 'checked_in',
            updated_at = v_now
        WHERE id = p_booking_id
        RETURNING * INTO v_booking;

    ELSE
        -- Admin arbitrary status update
        IF v_user.role <> 'admin' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Unauthorized status transition.');
        END IF;
        UPDATE public.bookings
        SET status = p_target_status,
            updated_at = v_now
        WHERE id = p_booking_id
        RETURNING * INTO v_booking;
    END IF;

    -- Audit trail
    INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
    VALUES (v_user.id, v_user.username, v_user.role, 'status_advance', 'booking', v_booking.id::TEXT,
            jsonb_build_object('from_status', v_booking.status, 'to_status', p_target_status, 'reason', p_reason));

    RETURN jsonb_build_object(
        'success', true,
        'booking', row_to_json(v_booking)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.advance_booking_status(UUID, UUID, TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. UPDATE COUNSELING RPCS (Keep status in sync on bookings table)
-- ------------------------------------------------------------------------------

-- 4a. start_counseling: updates session status to 'in_counseling' AND booking status to 'in_counseling'
CREATE OR REPLACE FUNCTION public.start_counseling(
  p_booking_id UUID,
  p_user_id    UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user       public.user_profiles%ROWTYPE;
  v_booking    public.bookings%ROWTYPE;
  v_session    public.counseling_sessions%ROWTYPE;
  v_now        TIMESTAMPTZ := timezone('Asia/Karachi', now());
BEGIN
  -- Auth check
  SELECT * INTO v_user FROM public.user_profiles
  WHERE id = p_user_id AND status = 'active';
  IF v_user.id IS NULL OR v_user.role NOT IN ('admin','counselor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Counselor or Admin can start counseling.');
  END IF;

  -- Booking check
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found.');
  END IF;

  -- Get or create session
  SELECT * INTO v_session FROM public.counseling_sessions WHERE booking_id = p_booking_id;

  IF v_session.id IS NULL THEN
    INSERT INTO public.counseling_sessions (
      booking_id, status, counselor_id, started_at, created_by
    ) VALUES (
      p_booking_id, 'in_counseling', p_user_id, v_now, p_user_id
    ) RETURNING * INTO v_session;
  ELSIF v_session.status = 'in_counseling' THEN
    -- Already in counseling, idempotent
    NULL;
  ELSIF v_session.status = 'done' AND v_user.role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Counseling already completed for this patient.');
  ELSE
    UPDATE public.counseling_sessions
    SET status = 'in_counseling',
        counselor_id = p_user_id,
        started_at = COALESCE(started_at, v_now),
        updated_at = v_now
    WHERE id = v_session.id
    RETURNING * INTO v_session;
  END IF;

  -- Sync booking status to in_counseling
  UPDATE public.bookings
  SET status = 'in_counseling',
      updated_at = v_now
  WHERE id = p_booking_id;

  -- Audit
  INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
  VALUES (v_user.id, v_user.username, v_user.role, 'counseling_checkin', 'counseling_session',
          v_session.id::TEXT, jsonb_build_object('booking_id', p_booking_id));

  RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.start_counseling(UUID, UUID) TO anon, authenticated, service_role;

-- 4b. save_counseling: when complete=true, marks session 'done' AND booking 'procedure_done'
CREATE OR REPLACE FUNCTION public.save_counseling(
  p_booking_id UUID,
  p_user_id    UUID,
  p_items      JSONB,       -- [{procedure_id, procedure_name_snapshot, procedure_category_snapshot, quoted_price, sort_order}]
  p_notes      TEXT DEFAULT NULL,
  p_complete   BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_user    public.user_profiles%ROWTYPE;
  v_session public.counseling_sessions%ROWTYPE;
  v_item    JSONB;
  v_total   NUMERIC(12,2) := 0;
  v_new_status TEXT;
  v_now     TIMESTAMPTZ := timezone('Asia/Karachi', now());
BEGIN
  -- Auth check
  SELECT * INTO v_user FROM public.user_profiles
  WHERE id = p_user_id AND status = 'active';
  IF v_user.id IS NULL OR v_user.role NOT IN ('admin','counselor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Counselor or Admin can save counseling records.');
  END IF;

  -- Session check
  SELECT * INTO v_session FROM public.counseling_sessions WHERE booking_id = p_booking_id;
  IF v_session.id IS NULL THEN
    -- Auto-create if missing
    INSERT INTO public.counseling_sessions (booking_id, status, counselor_id, started_at, created_by)
    VALUES (p_booking_id, 'in_counseling', p_user_id, v_now, p_user_id)
    RETURNING * INTO v_session;
  END IF;

  IF v_session.status = 'done' AND NOT (v_user.role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session is finalized. Only Admin can edit completed counseling.');
  END IF;

  -- Validate prices (must not be negative)
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    IF (v_item->>'quoted_price') IS NOT NULL AND (v_item->>'quoted_price')::NUMERIC < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Quoted price cannot be negative.');
    END IF;
    v_total := v_total + COALESCE((v_item->>'quoted_price')::NUMERIC, 0);
  END LOOP;

  -- Replace procedure items atomically
  DELETE FROM public.counseling_session_items WHERE session_id = v_session.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    INSERT INTO public.counseling_session_items (
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

  -- Update session status
  v_new_status := CASE WHEN p_complete THEN 'done' ELSE v_session.status END;

  UPDATE public.counseling_sessions
  SET notes        = COALESCE(p_notes, notes),
      status       = v_new_status,
      completed_at = CASE WHEN p_complete AND completed_at IS NULL THEN v_now ELSE completed_at END,
      updated_at   = v_now
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  -- If complete, sync booking status to procedure_done
  IF p_complete THEN
    UPDATE public.bookings
    SET status = 'procedure_done',
        updated_at = v_now
    WHERE id = p_booking_id;
  END IF;

  -- Audit
  INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
  VALUES (v_user.id, v_user.username, v_user.role,
          CASE WHEN p_complete THEN 'counseling_complete' ELSE 'counseling_save_draft' END,
          'counseling_session', v_session.id::TEXT,
          jsonb_build_object('booking_id', p_booking_id, 'item_count', jsonb_array_length(COALESCE(p_items,'[]'::jsonb)), 'total', v_total));

  RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session), 'total', v_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_counseling(UUID, UUID, JSONB, TEXT, BOOLEAN) TO anon, authenticated, service_role;

-- 4c. undo_counseling_checkin: resets to waiting & booking status to checked_out
CREATE OR REPLACE FUNCTION public.undo_counseling_checkin(
  p_booking_id UUID,
  p_user_id    UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user    public.user_profiles%ROWTYPE;
  v_session public.counseling_sessions%ROWTYPE;
  v_now     TIMESTAMPTZ := timezone('Asia/Karachi', now());
BEGIN
  SELECT * INTO v_user FROM public.user_profiles
  WHERE id = p_user_id AND status = 'active';
  IF v_user.id IS NULL OR v_user.role NOT IN ('admin','counselor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  SELECT * INTO v_session FROM public.counseling_sessions WHERE booking_id = p_booking_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found.');
  END IF;
  IF v_session.status = 'done' AND v_user.role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot undo completed session.');
  END IF;

  UPDATE public.counseling_sessions
  SET status = 'waiting',
      counselor_id = NULL,
      started_at = NULL,
      updated_at = v_now
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  -- Sync booking back to checked_out
  UPDATE public.bookings
  SET status = 'checked_out',
      updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
  VALUES (v_user.id, v_user.username, v_user.role, 'undo_counseling_checkin', 'counseling_session',
          v_session.id::TEXT, jsonb_build_object('booking_id', p_booking_id));

  RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.undo_counseling_checkin(UUID, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. FIX get_counseling_queue
--    Takes p_user_id (no auth.uid() dependency!). Returns JSON array of sessions.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_counseling_queue(
  p_date      DATE,
  p_doctor_id UUID DEFAULT NULL,
  p_user_id   UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user public.user_profiles%ROWTYPE;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id AND status = 'active';
    IF v_user.id IS NOT NULL AND v_user.role NOT IN ('admin','counselor') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Counselor or Admin required.');
    END IF;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY b.token_number NULLS LAST, cs.created_at), '[]'::jsonb)
    FROM public.counseling_sessions cs
    JOIN public.bookings b ON b.id = cs.booking_id
    JOIN public.patients p ON p.id = b.patient_id
    JOIN public.doctors  d ON d.id = b.doctor_id
    LEFT JOIN public.user_profiles counselor ON counselor.id = cs.counselor_id
    CROSS JOIN LATERAL (
      SELECT
        cs.id               AS session_id,
        cs.status           AS counseling_status,
        cs.started_at,
        cs.completed_at,
        cs.notes,
        counselor.full_name AS counselor_name,
        b.id                AS booking_id,
        b.booking_date,
        b.token_number,
        b.purpose,
        b.reservation_type,
        b.source,
        b.called_as,
        b.check_in_time,
        b.checked_in_at,
        b.checkout_time,
        b.doctor_id,
        d.name              AS doctor_name,
        p.id                AS patient_id,
        p.patient_mrn,
        p.first_name,
        p.last_name,
        p.age,
        p.full_phone,
        p.city,
        p.area
    ) r
    WHERE b.booking_date = p_date
      AND cs.deleted_at IS NULL
      AND cs.status <> 'voided'
      AND (p_doctor_id IS NULL OR b.doctor_id = p_doctor_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_counseling_queue(DATE, UUID, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. RLS POLICIES FOR COUNSELING
--    Allow reading counseling_sessions so Realtime can deliver to clients.
--    Keep quoted prices in counseling_session_items strictly protected.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "cs_select_admin_counselor" ON public.counseling_sessions;
DROP POLICY IF EXISTS "cs_select_receptionist" ON public.counseling_sessions;
DROP POLICY IF EXISTS "cs_select_all" ON public.counseling_sessions;

CREATE POLICY "cs_select_all" ON public.counseling_sessions
  FOR SELECT USING (deleted_at IS NULL);

-- ------------------------------------------------------------------------------
-- 7. REALTIME PUBLICATION & REPLICA IDENTITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.counseling_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.counseling_sessions;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ------------------------------------------------------------------------------
-- 8. BACKFILL EXISTING CHECKED_OUT BOOKINGS
-- ------------------------------------------------------------------------------
INSERT INTO public.counseling_sessions (booking_id, status, created_by)
SELECT b.id, 'waiting', b.created_by
FROM public.bookings b
WHERE b.status = 'checked_out'
  AND NOT EXISTS (SELECT 1 FROM public.counseling_sessions cs WHERE cs.booking_id = b.id)
ON CONFLICT (booking_id) DO NOTHING;
