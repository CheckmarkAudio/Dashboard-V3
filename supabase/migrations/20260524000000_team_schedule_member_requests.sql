-- Member-driven scheduler requests — recurring rules + deletion flow.
--
-- Until now `team_schedule_recurring` was admin-only writes; members
-- could only propose one-off blocks (`team_schedule_blocks` had a
-- status column from day one). This migration extends recurring with
-- the same status pipeline so members can request weekly hours too,
-- plus a `pending_deletion` flag that powers the "ask admin to
-- remove this approved rule" flow.
--
-- Migration is additive — existing rows default to status='approved'
-- and pending_deletion=false, so admin-managed schedules continue to
-- render unchanged.

-- ─── 1. Columns on team_schedule_recurring ──────────────────────────
ALTER TABLE public.team_schedule_recurring
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'denied')),
  ADD COLUMN IF NOT EXISTS requested_by uuid NULL REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reviewer_note text NULL,
  -- pending_deletion is true while a member's "remove this rule"
  -- request is awaiting admin action. The rule still renders during
  -- this window (it's still active until admin confirms), with a
  -- "pending removal" badge so the situation is visible.
  ADD COLUMN IF NOT EXISTS pending_deletion boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS team_schedule_recurring_pending_idx
  ON public.team_schedule_recurring (status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS team_schedule_recurring_pending_deletion_idx
  ON public.team_schedule_recurring (pending_deletion, updated_at DESC)
  WHERE pending_deletion = true;

-- ─── 2. RLS additions ───────────────────────────────────────────────
-- Existing admin policies (FOR ALL using public.is_team_admin()) stay
-- in place. We add two member-only policies for the request +
-- withdraw flows. UPDATEs (including the pending_deletion flag) go
-- through the SECURITY DEFINER RPCs below so members can't tweak
-- start_time / end_time on their own approved rules.

DROP POLICY IF EXISTS team_schedule_recurring_member_request ON public.team_schedule_recurring;
CREATE POLICY team_schedule_recurring_member_request
  ON public.team_schedule_recurring FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    AND status = 'pending'
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS team_schedule_recurring_member_withdraw ON public.team_schedule_recurring;
CREATE POLICY team_schedule_recurring_member_withdraw
  ON public.team_schedule_recurring FOR DELETE
  TO authenticated
  USING (
    member_id = auth.uid()
    AND status = 'pending'
  );

-- ─── 3. Member-deletion-request RPCs ────────────────────────────────
-- SECURITY DEFINER so members can flip the pending_deletion flag on
-- their OWN approved rules without an UPDATE policy that would let
-- them touch other columns.

CREATE OR REPLACE FUNCTION public.request_recurring_deletion(
  p_rule_id uuid,
  p_note    text DEFAULT NULL
)
RETURNS public.team_schedule_recurring
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_row public.team_schedule_recurring;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  -- Caller must own the rule. Admins go through deleteRecurring
  -- directly (the admin RLS policy allows it).
  SELECT * INTO v_row
    FROM public.team_schedule_recurring
    WHERE id = p_rule_id AND member_id = v_caller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found or not yours' USING ERRCODE = '42501';
  END IF;

  IF v_row.status <> 'approved' THEN
    -- Pending recurring is withdrawn via DELETE, not deletion request.
    RAISE EXCEPTION 'rule must be approved to request deletion' USING ERRCODE = '22023';
  END IF;

  UPDATE public.team_schedule_recurring
    SET pending_deletion = true,
        reviewer_note = COALESCE(p_note, reviewer_note)
    WHERE id = p_rule_id
    RETURNING * INTO v_row;

  RETURN v_row;
END
$$;

REVOKE ALL ON FUNCTION public.request_recurring_deletion(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_recurring_deletion(uuid, text) TO authenticated;

-- Member changes their mind before admin acts.
CREATE OR REPLACE FUNCTION public.withdraw_recurring_deletion_request(
  p_rule_id uuid
)
RETURNS public.team_schedule_recurring
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_row public.team_schedule_recurring;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.team_schedule_recurring
    SET pending_deletion = false
    WHERE id = p_rule_id
      AND member_id = v_caller
      AND pending_deletion = true
    RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found, not yours, or no pending deletion' USING ERRCODE = '42501';
  END IF;

  RETURN v_row;
END
$$;

REVOKE ALL ON FUNCTION public.withdraw_recurring_deletion_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_recurring_deletion_request(uuid) TO authenticated;

-- ─── 4. Comments ────────────────────────────────────────────────────
COMMENT ON COLUMN public.team_schedule_recurring.status IS
  'pending=member proposal awaiting admin review · approved=live rule · denied=audit trail only. Default approved so admin-created rules go live immediately.';

COMMENT ON COLUMN public.team_schedule_recurring.pending_deletion IS
  'true while a member has asked admin to remove this approved rule. The rule still renders during this window (still in effect until admin confirms). Admin confirms by DELETE; rejects by setting back to false.';
