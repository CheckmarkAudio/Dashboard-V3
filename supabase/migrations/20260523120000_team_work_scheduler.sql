-- PR — Member Work Scheduler (foundation).
--
-- Two tables drive the new scheduler surface:
--
--   `team_schedule_recurring` — admin-managed weekly rules. Each row
--     is one (member, weekday, time-of-day window). Studio work week
--     is Tuesday–Saturday, but weekend rows are allowed for staff
--     who cover Sun/Mon. Effective window (effective_from /
--     effective_until) lets admins schedule a future change without
--     touching the current rule — set effective_until = today on the
--     old row + insert a new one starting tomorrow.
--
--   `team_schedule_blocks` — one-off blocks + member-proposed blocks
--     pending admin approval. status:
--       'approved'  — visible on calendar / widgets, ready to go
--       'pending'   — member-requested, only visible to the member
--                     and admins, NOT shown on team-wide views
--       'denied'    — admin rejected; kept for audit trail
--
-- Member-side surfaces (Overview widget, Profile page) compute their
-- weekly view by combining the recurring rules + any approved blocks
-- in the date range. Pending blocks render on the member's own view
-- only, with a "pending" badge.
--
-- RLS:
--   - All authenticated team members can SELECT both tables (so
--     team-wide views and the calendar overlay work). Pending blocks
--     are filtered out of group queries client-side.
--   - INSERT/UPDATE/DELETE on team_schedule_recurring is admin-only
--     (no member self-management of recurring patterns; admins set
--     the canonical weekly hours).
--   - INSERT on team_schedule_blocks: admin can insert any row;
--     members can insert ONLY rows where member_id = auth.uid() AND
--     status = 'pending' (the "request schedule block" flow).
--   - UPDATE/DELETE on team_schedule_blocks: admin-only (admins
--     approve/deny/edit/remove; members can only ask).

-- ─── 1. team_schedule_recurring ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_schedule_recurring (
  id                uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id         uuid          NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  -- 0=Sunday, 1=Monday, ..., 6=Saturday. Matches Postgres
  -- EXTRACT(DOW) + JS Date.getDay() so date arithmetic is portable.
  weekday           smallint      NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  -- Local wall-clock time at the studio (America/New_York). Cast to
  -- timestamptz at render time using the studio TZ; we don't store
  -- TZ here because the studio operates from one location.
  start_time        time          NOT NULL,
  end_time          time          NOT NULL,
  -- Optional window for when the rule is active. NULL effective_until
  -- means "ongoing". Inclusive on both ends.
  effective_from    date          NULL,
  effective_until   date          NULL,
  -- Soft-disable without deleting (useful when staff is out for a
  -- few weeks but we don't want to lose the rule).
  active            boolean       NOT NULL DEFAULT true,
  note              text          NULL,
  created_by        uuid          NULL REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  -- Guard against malformed windows.
  CONSTRAINT team_schedule_recurring_time_order CHECK (end_time > start_time),
  CONSTRAINT team_schedule_recurring_effective_order CHECK (
    effective_from IS NULL OR effective_until IS NULL OR effective_until >= effective_from
  )
);

CREATE INDEX IF NOT EXISTS team_schedule_recurring_member_idx
  ON public.team_schedule_recurring (member_id, weekday)
  WHERE active = true;

-- ─── 2. team_schedule_blocks ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_schedule_blocks (
  id               uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id        uuid          NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  starts_at        timestamptz   NOT NULL,
  ends_at          timestamptz   NOT NULL,
  status           text          NOT NULL DEFAULT 'approved'
                                     CHECK (status IN ('pending', 'approved', 'denied')),
  note             text          NULL,
  -- requested_by is who created the row (the requester for pending,
  -- usually = admin for direct adds). approved_by + reviewed_at fill
  -- when status transitions away from 'pending'.
  requested_by     uuid          NULL REFERENCES public.team_members(id) ON DELETE SET NULL,
  approved_by      uuid          NULL REFERENCES public.team_members(id) ON DELETE SET NULL,
  reviewed_at      timestamptz   NULL,
  reviewer_note    text          NULL,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT team_schedule_blocks_time_order CHECK (ends_at > starts_at)
);

-- Queries:
--   "blocks for member in date range" — calendar overlay, widget
--   "pending queue" — admin's review surface in Work Scheduler
CREATE INDEX IF NOT EXISTS team_schedule_blocks_member_range_idx
  ON public.team_schedule_blocks (member_id, starts_at);

CREATE INDEX IF NOT EXISTS team_schedule_blocks_pending_idx
  ON public.team_schedule_blocks (status, created_at DESC)
  WHERE status = 'pending';

-- ─── 3. updated_at triggers ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.team_schedule_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS team_schedule_recurring_updated_at ON public.team_schedule_recurring;
CREATE TRIGGER team_schedule_recurring_updated_at
  BEFORE UPDATE ON public.team_schedule_recurring
  FOR EACH ROW EXECUTE FUNCTION public.team_schedule_set_updated_at();

DROP TRIGGER IF EXISTS team_schedule_blocks_updated_at ON public.team_schedule_blocks;
CREATE TRIGGER team_schedule_blocks_updated_at
  BEFORE UPDATE ON public.team_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.team_schedule_set_updated_at();

-- ─── 4. RLS — team_schedule_recurring ───────────────────────────────
ALTER TABLE public.team_schedule_recurring ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_schedule_recurring_read ON public.team_schedule_recurring;
CREATE POLICY team_schedule_recurring_read
  ON public.team_schedule_recurring FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS team_schedule_recurring_admin_write ON public.team_schedule_recurring;
CREATE POLICY team_schedule_recurring_admin_write
  ON public.team_schedule_recurring FOR ALL
  TO authenticated
  USING (public.is_team_admin())
  WITH CHECK (public.is_team_admin());

-- ─── 5. RLS — team_schedule_blocks ──────────────────────────────────
ALTER TABLE public.team_schedule_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_schedule_blocks_read ON public.team_schedule_blocks;
CREATE POLICY team_schedule_blocks_read
  ON public.team_schedule_blocks FOR SELECT
  TO authenticated
  USING (true);

-- Members can INSERT a row ONLY for themselves AND only as 'pending'.
-- This powers the "Request schedule block" flow on the Overview
-- widget — member proposes a time, admin reviews from Work Scheduler.
DROP POLICY IF EXISTS team_schedule_blocks_member_request ON public.team_schedule_blocks;
CREATE POLICY team_schedule_blocks_member_request
  ON public.team_schedule_blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    AND status = 'pending'
    AND requested_by = auth.uid()
  );

-- Admins can do anything (insert approved blocks directly, approve
-- pending requests, edit times, delete blocks, etc.).
DROP POLICY IF EXISTS team_schedule_blocks_admin_write ON public.team_schedule_blocks;
CREATE POLICY team_schedule_blocks_admin_write
  ON public.team_schedule_blocks FOR ALL
  TO authenticated
  USING (public.is_team_admin())
  WITH CHECK (public.is_team_admin());

-- Members can DELETE their OWN pending request (i.e., withdraw it
-- before an admin has reviewed). Once approved/denied, only admins
-- can mutate.
DROP POLICY IF EXISTS team_schedule_blocks_member_withdraw ON public.team_schedule_blocks;
CREATE POLICY team_schedule_blocks_member_withdraw
  ON public.team_schedule_blocks FOR DELETE
  TO authenticated
  USING (
    member_id = auth.uid()
    AND status = 'pending'
  );

-- ─── 6. Comments ────────────────────────────────────────────────────
COMMENT ON TABLE public.team_schedule_recurring IS
  'Admin-managed weekly recurring work schedules for team members. One row per (member, weekday, time-window). Studio default work week is Tue–Sat; weekend rows are allowed for cover staff.';

COMMENT ON TABLE public.team_schedule_blocks IS
  'One-off schedule blocks. Powers both admin-added single-day shifts AND the member-proposed-block request flow (status=pending → admin approve/deny). Approved blocks render alongside recurring rules in calendar overlays and the My Schedule widget.';

COMMENT ON COLUMN public.team_schedule_blocks.status IS
  'pending=member proposal awaiting admin review · approved=live on schedule · denied=audit trail only';
