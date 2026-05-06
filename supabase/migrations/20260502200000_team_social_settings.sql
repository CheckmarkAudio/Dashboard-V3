-- Team-scoped social link settings for Checkmark public channels.
--
-- Keeps top-bar social links and MemberHighlights social snapshot on
-- one source of truth. Admins can update URLs and manual follower
-- counts from Settings; all authenticated team members can read.

BEGIN;

CREATE TABLE IF NOT EXISTS public.team_social_settings (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'youtube', 'tiktok')),
  url text NOT NULL DEFAULT '',
  follower_count integer NOT NULL DEFAULT 0 CHECK (follower_count >= 0),
  updated_by uuid NULL REFERENCES public.team_members(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, platform)
);

ALTER TABLE public.team_social_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_social_settings_select ON public.team_social_settings;
DROP POLICY IF EXISTS team_social_settings_insert ON public.team_social_settings;
DROP POLICY IF EXISTS team_social_settings_update ON public.team_social_settings;
DROP POLICY IF EXISTS team_social_settings_delete ON public.team_social_settings;

CREATE POLICY team_social_settings_select ON public.team_social_settings
  FOR SELECT TO authenticated
  USING (team_id = public.get_my_team_id());

CREATE POLICY team_social_settings_insert ON public.team_social_settings
  FOR INSERT TO authenticated
  WITH CHECK (team_id = public.get_my_team_id() AND public.is_team_admin());

CREATE POLICY team_social_settings_update ON public.team_social_settings
  FOR UPDATE TO authenticated
  USING (team_id = public.get_my_team_id() AND public.is_team_admin())
  WITH CHECK (team_id = public.get_my_team_id() AND public.is_team_admin());

CREATE OR REPLACE FUNCTION public.get_team_social_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team uuid := public.get_my_team_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH defaults(platform, label, url, follower_count, ord) AS (
      VALUES
        ('facebook',  'Facebook',  'https://www.facebook.com/checkmarkaudio',      9, 1),
        ('instagram', 'Instagram', 'https://www.instagram.com/checkmark_audio',   502, 2),
        ('youtube',   'YouTube',   'https://www.youtube.com/@checkmarkAudio',       8, 3),
        ('tiktok',    'TikTok',    'https://www.tiktok.com/@checkmarkaudio',       28, 4)
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'platform', d.platform,
        'label', d.label,
        'url', COALESCE(NULLIF(s.url, ''), d.url),
        'follower_count', COALESCE(s.follower_count, d.follower_count)
      )
      ORDER BY d.ord
    )
    FROM defaults d
    LEFT JOIN public.team_social_settings s
      ON s.team_id = v_team
     AND s.platform = d.platform
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_team_social_settings(
  p_settings jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team uuid := public.get_my_team_id();
  v_row jsonb;
  v_platform text;
  v_url text;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'array' THEN
    RAISE EXCEPTION 'p_settings must be an array' USING ERRCODE = '22023';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_settings)
  LOOP
    v_platform := v_row->>'platform';
    IF v_platform NOT IN ('facebook', 'instagram', 'youtube', 'tiktok') THEN
      RAISE EXCEPTION 'invalid social platform: %', v_platform USING ERRCODE = '22023';
    END IF;

    v_url := COALESCE(v_row->>'url', '');
    IF v_url <> '' AND v_url !~ '^https://(www\.)?[A-Za-z0-9._~:/?#\[\]@!$&''()*+,;=%-]+$' THEN
      RAISE EXCEPTION 'social links must be https URLs' USING ERRCODE = '22023';
    END IF;

    v_count := GREATEST(0, COALESCE((v_row->>'follower_count')::integer, 0));

    INSERT INTO public.team_social_settings (
      team_id, platform, url, follower_count, updated_by, updated_at
    )
    VALUES (
      v_team, v_platform, v_url, v_count, auth.uid(), now()
    )
    ON CONFLICT (team_id, platform)
    DO UPDATE SET
      url = EXCLUDED.url,
      follower_count = EXCLUDED.follower_count,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();
  END LOOP;

  RETURN public.get_team_social_settings();
END;
$function$;

REVOKE ALL ON FUNCTION public.get_team_social_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_team_social_settings() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_team_social_settings() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_team_social_settings(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_team_social_settings(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_team_social_settings(jsonb) TO authenticated;

COMMIT;
