-- PR4A: one schedule model for work + time off, with team-scoped RLS.
--
-- Existing one-off blocks remain work blocks through the NOT NULL default.
-- Approved time-off blocks subtract from recurring/one-off work windows in
-- the application schedule resolver. Pending requests never alter the
-- effective work schedule until an admin approves them.
--
-- This migration also closes an older multi-team isolation gap: the original
-- schedule policies allowed every authenticated user to read all rows and
-- allowed any admin to mutate rows for any team. This migration adds explicit
-- team ownership to both schedule tables and keeps it synchronized from the
-- target member, giving RLS a direct, indexed boundary.

BEGIN;

ALTER TABLE public.team_schedule_recurring
  ADD COLUMN IF NOT EXISTS team_id uuid;

ALTER TABLE public.team_schedule_blocks
  ADD COLUMN IF NOT EXISTS team_id uuid,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'work';

UPDATE public.team_schedule_recurring schedule
SET team_id = member.team_id
FROM public.team_members member
WHERE member.id = schedule.member_id
  AND schedule.team_id IS NULL;

UPDATE public.team_schedule_blocks schedule
SET team_id = member.team_id
FROM public.team_members member
WHERE member.id = schedule.member_id
  AND schedule.team_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.team_schedule_recurring WHERE team_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.team_schedule_blocks WHERE team_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot team-scope schedule rows: at least one member has no team.';
  END IF;
END
$$;

ALTER TABLE public.team_schedule_recurring
  ALTER COLUMN team_id SET NOT NULL,
  ALTER COLUMN team_id SET DEFAULT public.get_my_team_id();

ALTER TABLE public.team_schedule_blocks
  ALTER COLUMN team_id SET NOT NULL,
  ALTER COLUMN team_id SET DEFAULT public.get_my_team_id();

DO $$
BEGIN
  ALTER TABLE public.team_schedule_recurring
    ADD CONSTRAINT team_schedule_recurring_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE public.team_schedule_blocks
    ADD CONSTRAINT team_schedule_blocks_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE public.team_schedule_blocks
    ADD CONSTRAINT team_schedule_blocks_kind_check
    CHECK (kind IN ('work', 'time_off'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS team_schedule_blocks_member_kind_range_idx
  ON public.team_schedule_blocks (member_id, kind, starts_at);

CREATE INDEX IF NOT EXISTS team_schedule_recurring_team_member_idx
  ON public.team_schedule_recurring (team_id, member_id, weekday);

CREATE INDEX IF NOT EXISTS team_schedule_blocks_team_range_idx
  ON public.team_schedule_blocks (team_id, starts_at);

CREATE OR REPLACE FUNCTION public.team_schedule_set_team_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT team_id
  INTO v_team_id
  FROM public.team_members
  WHERE id = NEW.member_id;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Schedule member does not belong to a team.'
      USING ERRCODE = '23503';
  END IF;

  NEW.team_id := v_team_id;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.team_schedule_set_team_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_schedule_set_team_id() FROM anon;
REVOKE ALL ON FUNCTION public.team_schedule_set_team_id() FROM authenticated;

DROP TRIGGER IF EXISTS team_schedule_recurring_set_team_id
  ON public.team_schedule_recurring;
CREATE TRIGGER team_schedule_recurring_set_team_id
  BEFORE INSERT OR UPDATE OF member_id, team_id
  ON public.team_schedule_recurring
  FOR EACH ROW
  EXECUTE FUNCTION public.team_schedule_set_team_id();

DROP TRIGGER IF EXISTS team_schedule_blocks_set_team_id
  ON public.team_schedule_blocks;
CREATE TRIGGER team_schedule_blocks_set_team_id
  BEFORE INSERT OR UPDATE OF member_id, team_id
  ON public.team_schedule_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.team_schedule_set_team_id();

-- Recurring schedules: team members may read their team's rows; only their
-- own team's admins may write.
DROP POLICY IF EXISTS team_schedule_recurring_read
  ON public.team_schedule_recurring;
CREATE POLICY team_schedule_recurring_read
  ON public.team_schedule_recurring
  FOR SELECT
  TO authenticated
  USING (team_id = (SELECT public.get_my_team_id()));

DROP POLICY IF EXISTS team_schedule_recurring_admin_write
  ON public.team_schedule_recurring;
CREATE POLICY team_schedule_recurring_admin_write
  ON public.team_schedule_recurring
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.is_team_admin())
    AND team_id = (SELECT public.get_my_team_id())
  )
  WITH CHECK (
    (SELECT public.is_team_admin())
    AND team_id = (SELECT public.get_my_team_id())
  );

DROP POLICY IF EXISTS team_schedule_recurring_member_request
  ON public.team_schedule_recurring;
CREATE POLICY team_schedule_recurring_member_request
  ON public.team_schedule_recurring
  FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id = (SELECT auth.uid())
    AND requested_by = (SELECT auth.uid())
    AND status = 'pending'
    AND team_id = (SELECT public.get_my_team_id())
  );

DROP POLICY IF EXISTS team_schedule_recurring_member_withdraw
  ON public.team_schedule_recurring;
CREATE POLICY team_schedule_recurring_member_withdraw
  ON public.team_schedule_recurring
  FOR DELETE
  TO authenticated
  USING (
    member_id = (SELECT auth.uid())
    AND status = 'pending'
    AND team_id = (SELECT public.get_my_team_id())
  );

-- One-off work/time-off blocks use the same team boundary.
DROP POLICY IF EXISTS team_schedule_blocks_read
  ON public.team_schedule_blocks;
CREATE POLICY team_schedule_blocks_read
  ON public.team_schedule_blocks
  FOR SELECT
  TO authenticated
  USING (team_id = (SELECT public.get_my_team_id()));

DROP POLICY IF EXISTS team_schedule_blocks_admin_write
  ON public.team_schedule_blocks;
CREATE POLICY team_schedule_blocks_admin_write
  ON public.team_schedule_blocks
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.is_team_admin())
    AND team_id = (SELECT public.get_my_team_id())
  )
  WITH CHECK (
    (SELECT public.is_team_admin())
    AND team_id = (SELECT public.get_my_team_id())
  );

-- Keep the member request contract explicit in this migration: a member can
-- only request their own pending row. The kind check above limits the request
-- to a recognized work or time-off meaning.
DROP POLICY IF EXISTS team_schedule_blocks_member_request
  ON public.team_schedule_blocks;
CREATE POLICY team_schedule_blocks_member_request
  ON public.team_schedule_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id = (SELECT auth.uid())
    AND requested_by = (SELECT auth.uid())
    AND status = 'pending'
    AND kind IN ('work', 'time_off')
    AND team_id = (SELECT public.get_my_team_id())
  );

DROP POLICY IF EXISTS team_schedule_blocks_member_withdraw
  ON public.team_schedule_blocks;
CREATE POLICY team_schedule_blocks_member_withdraw
  ON public.team_schedule_blocks
  FOR DELETE
  TO authenticated
  USING (
    member_id = (SELECT auth.uid())
    AND status = 'pending'
    AND team_id = (SELECT public.get_my_team_id())
  );

COMMENT ON COLUMN public.team_schedule_recurring.team_id IS
  'Owning team, derived from member_id by trigger and used as the RLS boundary.';

COMMENT ON COLUMN public.team_schedule_blocks.team_id IS
  'Owning team, derived from member_id by trigger and used as the RLS boundary.';

COMMENT ON COLUMN public.team_schedule_blocks.kind IS
  'work=adds a one-off work window; time_off=subtracts from approved work windows once approved.';

COMMIT;
