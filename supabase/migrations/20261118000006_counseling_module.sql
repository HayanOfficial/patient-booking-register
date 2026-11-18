-- ==============================================================================
-- PATIENT BOOKING REGISTER (BARIATRIC SURGERY CLINIC)
-- Migration 000006: Counseling Module
--   - procedures table
--   - counseling_sessions table
--   - counseling_procedures table
--   - requires_counseling on lookup_items (purpose)
--   - Counselor role
--   - RPCs: counseling_checkin, save_counseling, undo_counseling_checkin
--   - Trigger: auto-create session on checkin when purpose requires counseling
--   - RLS on all new tables
--   - Realtime publications
-- ==============================================================================

SET timezone = 'Asia/Karachi';

-- ==============================================================================
-- 1. ADD COUNSELOR ROLE TO ENUM (or handle via TEXT check if no enum exists)
-- ==============================================================================
-- The existing schema uses TEXT for role with a CHECK constraint.
-- Extend it to include 'counselor'.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin','operator','receptionist','counselor'));

-- ==============================================================================
-- 2. ADD requires_counseling TO lookup_items (purpose category)
-- ==============================================================================
ALTER TABLE public.lookup_items
  ADD COLUMN IF NOT EXISTS requires_counseling BOOLEAN NOT NULL DEFAULT false;

-- Enable counseling for 'Consultation' purpose by default
UPDATE public.lookup_items
SET requires_counseling = true
WHERE category = 'purpose'
  AND LOWER(name) = 'consultation';

-- ==============================================================================
-- 3. PROCEDURES TABLE
-- ==============================================================================
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

-- RLS
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

-- All logged-in users can read active procedures
DROP POLICY IF EXISTS "procedures_read" ON public.procedures;
CREATE POLICY "procedures_read" ON public.procedures
  FOR SELECT USING (deleted_at IS NULL);

-- Only Admin can write
DROP POLICY IF EXISTS "procedures_admin_insert" ON public.procedures;
CREATE POLICY "procedures_admin_insert" ON public.procedures
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "procedures_admin_update" ON public.procedures;
CREATE POLICY "procedures_admin_update" ON public.procedures
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "procedures_admin_delete" ON public.procedures;
CREATE POLICY "procedures_admin_delete" ON public.procedures
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- ==============================================================================
-- 4. COUNSELING SESSIONS TABLE
-- ==============================================================================
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
CREATE INDEX IF NOT EXISTS idx_cs_counselor ON public.counseling_sessions (counselor_id) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.counseling_sessions ENABLE ROW LEVEL SECURITY;

-- Admin & Counselor can SELECT
DROP POLICY IF EXISTS "cs_select_admin_counselor" ON public.counseling_sessions;
CREATE POLICY "cs_select_admin_counselor" ON public.counseling_sessions
  FOR SELECT USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin','counselor')
        AND status = 'active'
    )
  );

-- Receptionist can see counseling status (no price-carrying column here)
DROP POLICY IF EXISTS "cs_select_receptionist" ON public.counseling_sessions;
CREATE POLICY "cs_select_receptionist" ON public.counseling_sessions
  FOR SELECT USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'receptionist'
        AND status = 'active'
    )
  );

-- Only admin and counselor can update
DROP POLICY IF EXISTS "cs_update_counselor" ON public.counseling_sessions;
CREATE POLICY "cs_update_counselor" ON public.counseling_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin','counselor')
        AND status = 'active'
    )
  );

-- Only admin and system (via RPC SECURITY DEFINER) can insert
DROP POLICY IF EXISTS "cs_insert_admin" ON public.counseling_sessions;
CREATE POLICY "cs_insert_admin" ON public.counseling_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin','counselor')
        AND status = 'active'
    )
  );

-- ==============================================================================
-- 5. COUNSELING PROCEDURES TABLE
-- ==============================================================================
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

-- RLS
ALTER TABLE public.counseling_procedures ENABLE ROW LEVEL SECURITY;

-- Only Admin and Counselor can read (prices are confidential)
DROP POLICY IF EXISTS "cp_select" ON public.counseling_procedures;
CREATE POLICY "cp_select" ON public.counseling_procedures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin','counselor')
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "cp_insert" ON public.counseling_procedures;
CREATE POLICY "cp_insert" ON public.counseling_procedures
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin','counselor')
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "cp_delete" ON public.counseling_procedures;
CREATE POLICY "cp_delete" ON public.counseling_procedures
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin','counselor')
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "cp_update" ON public.counseling_procedures;
CREATE POLICY "cp_update" ON public.counseling_procedures
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin','counselor')
        AND status = 'active'
    )
  );

-- ==============================================================================
-- 6. REALTIME PUBLICATIONS
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.procedures;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.counseling_sessions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.counseling_procedures;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

ALTER TABLE public.procedures           REPLICA IDENTITY FULL;
ALTER TABLE public.counseling_sessions  REPLICA IDENTITY FULL;
ALTER TABLE public.counseling_procedures REPLICA IDENTITY FULL;

-- ==============================================================================
-- 7. RPC: counseling_checkin(booking_id, user_id)
--    Idempotent: if session already exists returns existing. Marks status='in_counseling'.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.counseling_checkin(
  p_booking_id UUID,
  p_user_id    UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user       public.user_profiles%ROWTYPE;
  v_booking    public.bookings%ROWTYPE;
  v_session    public.counseling_sessions%ROWTYPE;
BEGIN
  -- Auth check
  SELECT * INTO v_user FROM public.user_profiles
  WHERE id = p_user_id AND status = 'active';
  IF v_user.id IS NULL OR v_user.role NOT IN ('admin','counselor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Counselor or Admin can start counseling.');
  END IF;

  -- Booking must exist and be checked in
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found.');
  END IF;
  IF v_booking.status NOT IN ('checked_in','in_process','completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Patient has not been checked in yet.');
  END IF;

  -- Get or create session
  SELECT * INTO v_session FROM public.counseling_sessions WHERE booking_id = p_booking_id;

  IF v_session.id IS NULL THEN
    -- Create new session
    INSERT INTO public.counseling_sessions (
      booking_id, status, counselor_id, started_at, created_by
    ) VALUES (
      p_booking_id, 'in_counseling', p_user_id, timezone('Asia/Karachi', now()), p_user_id
    ) RETURNING * INTO v_session;
  ELSIF v_session.status = 'in_counseling' THEN
    -- Idempotent: already in counseling
    RETURN jsonb_build_object('success', true, 'already_started', true, 'session', row_to_json(v_session));
  ELSIF v_session.status = 'done' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Counseling already completed for this patient.');
  ELSE
    -- Move from waiting to in_counseling
    UPDATE public.counseling_sessions
    SET status = 'in_counseling',
        counselor_id = p_user_id,
        started_at = timezone('Asia/Karachi', now()),
        updated_at = timezone('Asia/Karachi', now())
    WHERE id = v_session.id
    RETURNING * INTO v_session;
  END IF;

  -- Audit
  INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
  VALUES (v_user.id, v_user.username, v_user.role, 'counseling_checkin', 'counseling_session',
          v_session.id::TEXT, jsonb_build_object('booking_id', p_booking_id));

  RETURN jsonb_build_object('success', true, 'already_started', false, 'session', row_to_json(v_session));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 8. RPC: save_counseling(booking_id, user_id, items jsonb, notes text, complete boolean)
--    Atomically replaces the procedure list. If complete=true marks done.
-- ==============================================================================
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
  v_new_status TEXT;
  v_total   NUMERIC(12,2) := 0;
BEGIN
  -- Auth check
  SELECT * INTO v_user FROM public.user_profiles
  WHERE id = p_user_id AND status = 'active';
  IF v_user.id IS NULL OR v_user.role NOT IN ('admin','counselor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Counselor or Admin can save counseling.');
  END IF;

  -- Get session
  SELECT * INTO v_session FROM public.counseling_sessions WHERE booking_id = p_booking_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No counseling session found for this booking.');
  END IF;
  IF v_session.status = 'done' AND NOT (v_user.role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Counseling already completed. Only Admin can modify.');
  END IF;

  -- Validate prices
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

  -- Atomically replace procedure list
  DELETE FROM public.counseling_procedures WHERE session_id = v_session.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO public.counseling_procedures (
      session_id, procedure_id, procedure_name_snapshot,
      procedure_category_snapshot, quoted_price, sort_order
    ) VALUES (
      v_session.id,
      CASE WHEN (v_item->>'procedure_id') IS NOT NULL
           THEN (v_item->>'procedure_id')::UUID
           ELSE NULL END,
      TRIM(v_item->>'procedure_name_snapshot'),
      v_item->>'procedure_category_snapshot',
      COALESCE((v_item->>'quoted_price')::NUMERIC, 0),
      COALESCE((v_item->>'sort_order')::INTEGER, 0)
    );
  END LOOP;

  -- Update session
  v_new_status := CASE WHEN p_complete THEN 'done' ELSE v_session.status END;

  UPDATE public.counseling_sessions
  SET notes        = COALESCE(p_notes, notes),
      status       = v_new_status,
      completed_at = CASE WHEN p_complete AND completed_at IS NULL
                          THEN timezone('Asia/Karachi', now())
                          ELSE completed_at END,
      updated_at   = timezone('Asia/Karachi', now())
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  -- Audit
  INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
  VALUES (v_user.id, v_user.username, v_user.role,
          CASE WHEN p_complete THEN 'counseling_complete' ELSE 'counseling_save_draft' END,
          'counseling_session', v_session.id::TEXT,
          jsonb_build_object('booking_id', p_booking_id, 'item_count', jsonb_array_length(COALESCE(p_items,'[]'::jsonb)), 'total', v_total));

  RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session), 'total', v_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 9. RPC: undo_counseling_checkin(booking_id, user_id)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.undo_counseling_checkin(
  p_booking_id UUID,
  p_user_id    UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user    public.user_profiles%ROWTYPE;
  v_session public.counseling_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.user_profiles
  WHERE id = p_user_id AND status = 'active';
  IF v_user.id IS NULL OR v_user.role NOT IN ('admin','counselor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  SELECT * INTO v_session FROM public.counseling_sessions WHERE booking_id = p_booking_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No counseling session found.');
  END IF;

  UPDATE public.counseling_sessions
  SET status = 'waiting',
      counselor_id = NULL,
      started_at = NULL,
      updated_at = timezone('Asia/Karachi', now())
  WHERE id = v_session.id;

  INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
  VALUES (v_user.id, v_user.username, v_user.role, 'undo_counseling_checkin', 'counseling_session',
          v_session.id::TEXT, jsonb_build_object('booking_id', p_booking_id));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 10. RPC: get_counseling_queue(date, doctor_id)
--     Returns joined data needed by /counseling.html. No prices exposed for receptionist.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_counseling_queue(
  p_date      DATE DEFAULT CURRENT_DATE,
  p_doctor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user public.user_profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.user_profiles
  WHERE id = auth.uid() AND status = 'active';
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
      AND (p_doctor_id IS NULL OR b.doctor_id = p_doctor_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 11. RPC: get_counseling_session_detail(session_id)
--     Returns session + procedures (with prices) for Counselor/Admin only.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_counseling_session_detail(
  p_session_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user    public.user_profiles%ROWTYPE;
  v_session public.counseling_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.user_profiles
  WHERE id = auth.uid() AND status = 'active';
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
    'procedures', (
      SELECT COALESCE(jsonb_agg(row_to_json(cp) ORDER BY cp.sort_order), '[]'::jsonb)
      FROM public.counseling_procedures cp
      WHERE cp.session_id = p_session_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 12. TRIGGER: auto-create counseling_session when checkin_booking fires
--     for a purpose that has requires_counseling = true
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.trg_auto_create_counseling_session()
RETURNS TRIGGER AS $$
DECLARE
  v_requires BOOLEAN;
BEGIN
  -- Only run when status flips to checked_in
  IF NEW.status = 'checked_in' AND (OLD.status IS NULL OR OLD.status <> 'checked_in') THEN
    -- Check if purpose requires counseling
    SELECT COALESCE(requires_counseling, false) INTO v_requires
    FROM public.lookup_items
    WHERE category = 'purpose'
      AND LOWER(name) = LOWER(NEW.purpose)
      AND is_active = true
    LIMIT 1;

    IF v_requires THEN
      -- Only insert if not already exists (idempotent)
      INSERT INTO public.counseling_sessions (booking_id, status, created_by)
      VALUES (NEW.id, 'waiting', NEW.created_by)
      ON CONFLICT (booking_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_create_counseling_session ON public.bookings;
CREATE TRIGGER trg_auto_create_counseling_session
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_create_counseling_session();

-- ==============================================================================
-- 13. RPC: save_procedure_runtime(admin_id, procedure jsonb)
--     Admin CRUD for procedures in Settings.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.save_procedure_runtime(
  p_admin_id  UUID,
  p_procedure JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_admin     public.user_profiles%ROWTYPE;
  v_proc_id   UUID;
  v_name      TEXT := TRIM((p_procedure->>'name')::TEXT);
  v_category  TEXT := NULLIF(TRIM((p_procedure->>'category')::TEXT), '');
  v_is_active BOOLEAN := COALESCE((p_procedure->>'is_active')::BOOLEAN, true);
  v_sort_order INTEGER := COALESCE((p_procedure->>'sort_order')::INTEGER, 0);
  v_result    public.procedures%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM public.user_profiles
  WHERE id = p_admin_id AND status = 'active';
  IF v_admin.id IS NULL OR v_admin.role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin role required.');
  END IF;

  IF v_name IS NULL OR length(v_name) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Procedure name is required.');
  END IF;

  IF (p_procedure->>'id') IS NOT NULL AND (p_procedure->>'id') ~ '^[0-9a-fA-F-]{36}$' THEN
    v_proc_id := (p_procedure->>'id')::UUID;
  END IF;

  IF v_proc_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.procedures WHERE id = v_proc_id) THEN
    UPDATE public.procedures
    SET name = v_name, category = v_category, is_active = v_is_active,
        sort_order = v_sort_order, deleted_at = NULL,
        updated_at = timezone('Asia/Karachi', now())
    WHERE id = v_proc_id RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.procedures (name, category, is_active, sort_order, created_by)
    VALUES (v_name, v_category, v_is_active, v_sort_order, p_admin_id)
    RETURNING * INTO v_result;
  END IF;

  INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
  VALUES (v_admin.id, v_admin.username, v_admin.role, 'save_procedure', 'procedure',
          v_result.id::TEXT, row_to_json(v_result));

  RETURN jsonb_build_object('success', true, 'procedure', row_to_json(v_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 14. RPC: delete_procedure_runtime(admin_id, procedure_id)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.delete_procedure_runtime(
  p_admin_id    UUID,
  p_procedure_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_admin public.user_profiles%ROWTYPE;
  v_name  TEXT;
BEGIN
  SELECT * INTO v_admin FROM public.user_profiles
  WHERE id = p_admin_id AND status = 'active';
  IF v_admin.id IS NULL OR v_admin.role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin role required.');
  END IF;

  SELECT name INTO v_name FROM public.procedures WHERE id = p_procedure_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Procedure not found.');
  END IF;

  -- Soft delete
  UPDATE public.procedures
  SET deleted_at = timezone('Asia/Karachi', now()),
      updated_at = timezone('Asia/Karachi', now())
  WHERE id = p_procedure_id;

  INSERT INTO public.audit_logs (user_id, username, user_role, action_type, entity_type, entity_id, details_json)
  VALUES (v_admin.id, v_admin.username, v_admin.role, 'delete_procedure', 'procedure',
          p_procedure_id::TEXT, jsonb_build_object('name', v_name));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 15. SEED: Surgical Procedures List (From reference/Surgical_Procedures_List.xlsx)
-- ==============================================================================
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
  ('Thyroid surgery, recorded as THYROIDE/THROIDE', 'Thyroid', true, 59),
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

-- ==============================================================================
-- 16. Add counseling_status view column to bookings (as view helper)
--     This lets reception quickly see counseling badge without exposing prices
-- ==============================================================================
-- We use a VIEW so receptionist can query it safely
CREATE OR REPLACE VIEW public.v_booking_counseling_status AS
SELECT
  b.id AS booking_id,
  cs.id AS session_id,
  cs.status AS counseling_status,
  cs.started_at,
  cs.completed_at
FROM public.bookings b
LEFT JOIN public.counseling_sessions cs ON cs.booking_id = b.id AND cs.deleted_at IS NULL;

-- RLS cannot be applied to views directly; the underlying table RLS is enforced.
-- Receptionist selects only: booking_id, session_id, counseling_status (no prices).
