-- Normalize nullable GoTrue bookkeeping fields that can make Auth Admin
-- email checks fail on manually provisioned users.
--
-- This does not change emails, passwords, roles, or profile data. It only
-- turns blank-token NULLs into empty strings, matching rows created by
-- Supabase's normal Auth API.

UPDATE auth.users
SET
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  updated_at = now()
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change IS NULL
   OR email_change_token_current IS NULL
   OR email_change_token_new IS NULL
   OR reauthentication_token IS NULL;

CREATE OR REPLACE FUNCTION public.admin_bootstrap_member_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $function$
DECLARE
  v_caller public.team_members;
  v_target public.team_members;
  v_email text;
BEGIN
  SELECT *
  INTO v_caller
  FROM public.team_members
  WHERE id = auth.uid();

  IF v_caller.id IS NULL OR v_caller.role <> 'admin' THEN
    RAISE EXCEPTION 'Only team admins can set temporary member passwords.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT *
  INTO v_target
  FROM public.team_members
  WHERE id = p_user_id;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Member not found.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_target.team_id IS DISTINCT FROM v_caller.team_id THEN
    RAISE EXCEPTION 'Target member is outside your team.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_email := lower(trim(coalesce(v_target.email, '')));

  IF v_email = '' THEN
    RAISE EXCEPTION 'Target email not found.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_email = 'checkmarkaudio@gmail.com' THEN
    RAISE EXCEPTION 'Use the standard password recovery flow to reset the owner account.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    UPDATE auth.users
    SET
      email = v_email,
      encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change = coalesce(email_change, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      reauthentication_token = coalesce(reauthentication_token, ''),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
      raw_user_meta_data = jsonb_set(
        coalesce(raw_user_meta_data, '{}'::jsonb),
        '{requires_password_change}',
        'true'::jsonb
      ),
      updated_at = now()
    WHERE id = p_user_id;
  ELSE
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_current,
      email_change_token_new,
      reauthentication_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      p_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'display_name', v_target.display_name,
        'created_by_admin', auth.uid(),
        'requires_password_change', true
      ),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      ''
    );
  END IF;

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_user_id,
    p_user_id::text,
    jsonb_build_object(
      'sub', p_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE
  SET
    identity_data = excluded.identity_data,
    updated_at = now();

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_bootstrap_member_password(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_bootstrap_member_password(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_bootstrap_member_password(uuid, text) TO authenticated;
