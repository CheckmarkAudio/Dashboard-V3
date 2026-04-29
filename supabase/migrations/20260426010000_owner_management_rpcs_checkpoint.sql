-- PR #49 — checkpoint migration. The two `owner_*` RPCs below have
-- existed in production for a while (deployed via Supabase dashboard
-- when AccountAccessPanel first shipped) but were never captured in
-- the tracked migrations folder. Capturing them now so a fresh
-- checkout can reproduce the schema end-to-end. Definitions are
-- pulled verbatim from production via `pg_get_functiondef` — no
-- behavior change.
--
-- Both functions:
--   - SECURITY DEFINER with locked search_path.
--   - Reject any caller whose JWT email isn't `checkmarkaudio@gmail.com`
--     (the OWNER_EMAIL constant in `src/domain/permissions/index.ts`).
--   - Refuse to demote / reset the primary owner account itself —
--     defense-in-depth alongside the protect_owner_* triggers.
--
-- Used by: `src/components/admin/AccountAccessPanel.tsx` (role
-- toggle + password-reset modal). Soon also referenced by the
-- TeamManager Add-Member flow (PR #49 send-setup-email path).

CREATE OR REPLACE FUNCTION public.owner_set_member_role(p_user_id uuid, p_new_role text)
RETURNS public.team_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_caller_email text := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_target_email text;
  v_updated public.team_members;
BEGIN
  -- Guard 1: only the primary owner may call this.
  IF v_caller_email <> 'checkmarkaudio@gmail.com' THEN
    RAISE EXCEPTION 'Only the primary owner (checkmarkaudio@gmail.com) may grant or revoke admin access. Caller: %', v_caller_email
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Guard 2: role must be one of the allowed values.
  IF p_new_role NOT IN ('admin', 'intern') THEN
    RAISE EXCEPTION 'role must be admin or intern, got %', p_new_role
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Guard 3: you cannot demote the primary owner through this path.
  -- The protect_owner_update trigger would silently coerce it back
  -- anyway, but rejecting here surfaces a clear error.
  SELECT LOWER(email) INTO v_target_email
  FROM public.team_members
  WHERE id = p_user_id;
  IF v_target_email = 'checkmarkaudio@gmail.com' THEN
    RAISE EXCEPTION 'The primary owner cannot be demoted.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- All guards passed — flip the role.
  UPDATE public.team_members
  SET role = p_new_role
  WHERE id = p_user_id
  RETURNING * INTO v_updated;

  IF v_updated IS NULL THEN
    RAISE EXCEPTION 'No team_members row found for id %', p_user_id
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_updated;
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_reset_member_password(p_user_id uuid, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_caller_email text := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_target_email text;
BEGIN
  -- Guard 1: only the primary owner may call this.
  IF v_caller_email <> 'checkmarkaudio@gmail.com' THEN
    RAISE EXCEPTION 'Only the primary owner may reset passwords. Caller: %', v_caller_email
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Guard 2: password must meet minimum length (matches the client Input).
  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Guard 3: the owner can't reset their OWN password through this path.
  -- (If they forget it, they can use Supabase Auth's standard recovery
  -- flow instead.)
  SELECT LOWER(email) INTO v_target_email
  FROM auth.users
  WHERE id = p_user_id;
  IF v_target_email = 'checkmarkaudio@gmail.com' THEN
    RAISE EXCEPTION 'Use the standard password recovery flow to reset the owner account.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'No auth user found for id %', p_user_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- All guards passed. Update the password + re-arm the force-change
  -- flag so the next sign-in triggers ForcePasswordChangeModal.
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{requires_password_change}',
        'true'::jsonb
      ),
      updated_at = now()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.owner_set_member_role(uuid, text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_reset_member_password(uuid, text)       TO authenticated;
