-- Re-key the flywheel ledger to the refined 5-stage platform model.
--
-- Phase 1 (migration 20260517220000) shipped with the original
-- deliver/capture/share/attract/book vocabulary. We've since refined the
-- "big five" to a platform model that fits Checkmark's growth loop:
--
--   discovery   — Discovery & Media         (funnel entrance: content → leads)
--   workflow    — Workflow & Administration (booking, onboarding, conversion)
--   production  — Production & Completion    (deliver radio-ready work)
--   education   — Education & Community       (workshops, LMS, forum)
--   growth      — Growth, Advocacy & Retention (reviews, referrals, loyalty)
--
-- Re-key map applied to existing rows (currently 0 on prod; this UPDATE is
-- defensive in case a preview deployment wrote a test row against the same DB):
--   deliver → production · capture → workflow · share → discovery
--   attract → discovery  · book    → workflow
--
-- Client emit hooks are re-pointed in the same PR (flywheelEvents.ts +
-- call sites). education + growth have no emit sources yet — they're the
-- next build-out (LMS/ticketing, CRM/referrals).

BEGIN;

-- 1. Remap any existing rows to the new vocabulary BEFORE the new CHECK.
UPDATE public.flywheel_events SET stage = CASE stage
  WHEN 'deliver' THEN 'production'
  WHEN 'capture' THEN 'workflow'
  WHEN 'share'   THEN 'discovery'
  WHEN 'attract' THEN 'discovery'
  WHEN 'book'    THEN 'workflow'
  ELSE stage
END
WHERE stage IN ('deliver', 'capture', 'share', 'attract', 'book');

-- 2. Swap the CHECK constraint to the new stage set.
ALTER TABLE public.flywheel_events DROP CONSTRAINT IF EXISTS flywheel_events_stage_check;
ALTER TABLE public.flywheel_events
  ADD CONSTRAINT flywheel_events_stage_check
  CHECK (stage IN ('discovery', 'workflow', 'production', 'education', 'growth'));

-- 3. Update the RPC's defensive validation IN-list to match (body otherwise
--    identical to the Phase 1 definition).
CREATE OR REPLACE FUNCTION public.record_flywheel_event(
  p_stage         text,
  p_source_type   text,
  p_source_id     uuid        DEFAULT NULL,
  p_member_id     uuid        DEFAULT NULL,
  p_metadata      jsonb       DEFAULT '{}'::jsonb,
  p_occurred_at   timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_team_id  uuid;
  v_member   uuid;
BEGIN
  IF p_stage NOT IN ('discovery', 'workflow', 'production', 'education', 'growth') THEN
    RAISE EXCEPTION 'Invalid flywheel stage: %', p_stage
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_source_type IS NULL OR length(p_source_type) = 0 THEN
    RAISE EXCEPTION 'source_type is required';
  END IF;

  v_member  := COALESCE(p_member_id, auth.uid());
  v_team_id := get_my_team_id();

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Cannot record flywheel event without a team context';
  END IF;

  INSERT INTO public.flywheel_events
    (stage, source_type, source_id, member_id, team_id, metadata, occurred_at)
  VALUES
    (p_stage, p_source_type, p_source_id, v_member, v_team_id, COALESCE(p_metadata, '{}'::jsonb), p_occurred_at)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMIT;
