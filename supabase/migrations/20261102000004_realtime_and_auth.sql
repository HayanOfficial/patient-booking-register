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

