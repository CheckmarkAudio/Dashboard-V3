-- Per-profile UI preferences. Free-form jsonb owned by the member —
-- subkeys today: `theme` ('light'|'dark'|'system'), `layout_<scope>`
-- (per-page widget layout snapshot). Future subkeys can be added
-- without schema changes.
--
-- Distinct from the existing `notification_prefs` column, which is
-- specifically scoped to notification opt-ins (channels, digests,
-- etc.). Keeping the two separated makes it obvious which feature
-- owns which subtree.
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.team_members.preferences IS
  'Member-owned UI prefs. Keys today: theme (light|dark|system), layout_<scope> (widget layout per page). Free-form jsonb so additions don''t require migrations.';
