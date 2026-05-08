-- Lean 4 (super-PR) — extend team_members with profile-editor fields.
--
-- All additive. Defaults are permissive (NULL or empty jsonb) so the
-- migration is safe to run live: existing rows get NULL/{} for the
-- new fields without any backfill required.
--
-- `avatar_url` is added even though the TypeScript type already
-- claimed it existed — the actual table didn't have it. Honest now.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS avatar_url         text,
  ADD COLUMN IF NOT EXISTS banner_url         text,
  ADD COLUMN IF NOT EXISTS bio                text,
  ADD COLUMN IF NOT EXISTS pronouns           text,
  ADD COLUMN IF NOT EXISTS socials            jsonb        NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timezone           text,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb        NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz  NOT NULL DEFAULT now();

-- Auto-touch updated_at on every UPDATE so the column is honest.
CREATE OR REPLACE FUNCTION public.team_members_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_members_updated_at ON public.team_members;
CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.team_members_touch_updated_at();

-- Quick sanity: backfill updated_at to created_at for existing rows
-- so the column starts honest (NOW() default would otherwise stamp
-- everything to the migration time).
UPDATE public.team_members
SET updated_at = COALESCE(created_at, now())
WHERE updated_at >= now() - interval '1 minute';

COMMENT ON COLUMN public.team_members.avatar_url         IS 'Public Supabase Storage URL for the member''s avatar (member-media bucket, avatars/{user_id}/...).';
COMMENT ON COLUMN public.team_members.banner_url         IS 'Public Supabase Storage URL for the member''s banner (member-media bucket, banners/{user_id}/...).';
COMMENT ON COLUMN public.team_members.bio                IS 'Free-form short bio shown on the profile page.';
COMMENT ON COLUMN public.team_members.pronouns           IS 'Self-described pronouns (e.g. she/her, they/them).';
COMMENT ON COLUMN public.team_members.socials            IS 'JSON map of social handles, e.g. { "instagram": "checkmark", "soundcloud": "..." }.';
COMMENT ON COLUMN public.team_members.timezone           IS 'IANA timezone string for the member (e.g. America/Los_Angeles).';
COMMENT ON COLUMN public.team_members.notification_prefs IS 'JSON blob for member-controlled notification preferences (channels, email opt-ins, etc).';
COMMENT ON COLUMN public.team_members.updated_at         IS 'Auto-touched on every UPDATE via trigger team_members_updated_at.';
