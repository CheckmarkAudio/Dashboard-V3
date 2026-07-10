-- Site-wide team branding banner.
--
-- Settings > Branding uploads a single banner for the whole workspace.
-- All authenticated team members may read it; only admins may update it.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS site_banner_url text,
  ADD COLUMN IF NOT EXISTS site_banner_fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS site_banner_opacity integer NOT NULL DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_site_banner_fit_check'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_site_banner_fit_check
      CHECK (site_banner_fit IN ('original', 'cover', 'contain'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_site_banner_opacity_check'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_site_banner_opacity_check
      CHECK (site_banner_opacity BETWEEN 0 AND 100);
  END IF;
END $$;

COMMENT ON COLUMN public.teams.site_banner_url IS
  'Public member-media Storage URL for the site-wide workspace header banner.';
COMMENT ON COLUMN public.teams.site_banner_fit IS
  'Rendering mode for the site-wide header banner: original, cover, or contain.';
COMMENT ON COLUMN public.teams.site_banner_opacity IS
  'Opacity percentage for the site-wide header banner, from 0 to 100.';

CREATE OR REPLACE FUNCTION public.get_team_site_branding()
RETURNS TABLE (
  site_banner_url text,
  site_banner_fit text,
  site_banner_opacity integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT
    t.site_banner_url,
    t.site_banner_fit,
    t.site_banner_opacity
  FROM public.teams AS t
  WHERE t.id = public.get_my_team_id()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.update_team_site_branding(
  p_site_banner_url text,
  p_site_banner_fit text DEFAULT 'cover',
  p_site_banner_opacity integer DEFAULT 100
)
RETURNS TABLE (
  site_banner_url text,
  site_banner_fit text,
  site_banner_opacity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team uuid := public.get_my_team_id();
  v_fit text := COALESCE(NULLIF(p_site_banner_fit, ''), 'cover');
  v_opacity integer := GREATEST(0, LEAST(100, COALESCE(p_site_banner_opacity, 100)));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF v_fit NOT IN ('original', 'cover', 'contain') THEN
    RAISE EXCEPTION 'invalid banner fit: %', v_fit;
  END IF;

  RETURN QUERY
  UPDATE public.teams AS t
     SET site_banner_url = NULLIF(p_site_banner_url, ''),
         site_banner_fit = v_fit,
         site_banner_opacity = v_opacity
   WHERE t.id = v_team
   RETURNING t.site_banner_url, t.site_banner_fit, t.site_banner_opacity;
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_site_branding() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_team_site_branding() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_team_site_branding() TO authenticated;

REVOKE ALL ON FUNCTION public.update_team_site_branding(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_team_site_branding(text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_team_site_branding(text, text, integer) TO authenticated;
