-- PR #16 — User task requests + admin approval pipeline.
--
-- New table `task_requests` captures a member's request for a task
-- to be added to their personal queue. Admin reviews and either
-- approves (materializes an `assigned_tasks` row via the existing
-- pipeline) or rejects (with optional note).
--
-- Schema-only migration. RPCs + the row-materializing logic live in
-- the follow-up 20260422193001_task_requests_rpcs.sql so the new
-- enum values commit before the RPC bodies reference them.

DO $$
BEGIN
  -- ─── 1. Extend notification enum ────────────────────────────────
  BEGIN
    ALTER TYPE public.assignment_notification_type ADD VALUE IF NOT EXISTS 'task_request_submitted';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.assignment_notification_type ADD VALUE IF NOT EXISTS 'task_request_approved';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.assignment_notification_type ADD VALUE IF NOT EXISTS 'task_request_rejected';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;

-- ─── 2. `task_requests` table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_requests (
  id              uuid            NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id    uuid            NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  title           text            NOT NULL CHECK (length(trim(title)) > 0),
  description     text            NULL,
  category        text            NULL,
  due_date        date            NULL,
  status          text            NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id     uuid            NULL REFERENCES public.team_members(id) ON DELETE SET NULL,
  reviewed_at     timestamptz     NULL,
  reviewer_note   text            NULL,
  -- Set when status transitions to 'approved'; points to the newly
  -- materialized assigned_tasks row. Useful for "jump to task" in
  -- the approved-notification click.
  approved_task_id uuid           NULL REFERENCES public.assigned_tasks(id) ON DELETE SET NULL,
  created_at      timestamptz     NOT NULL DEFAULT now(),
  updated_at      timestamptz     NOT NULL DEFAULT now()
);

-- Queries:
--   "my pending requests" (requester view)    — filter by requester_id + status
--   "pending queue for admin"                 — filter by status='pending', order by created_at
CREATE INDEX IF NOT EXISTS task_requests_requester_idx
  ON public.task_requests (requester_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS task_requests_pending_queue_idx
  ON public.task_requests (status, created_at DESC)
  WHERE status = 'pending';

-- Auto-update updated_at on any row change. Matches the trigger
-- pattern used elsewhere in this schema.
CREATE OR REPLACE FUNCTION public.task_requests_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS task_requests_updated_at ON public.task_requests;
CREATE TRIGGER task_requests_updated_at
  BEFORE UPDATE ON public.task_requests
  FOR EACH ROW EXECUTE FUNCTION public.task_requests_set_updated_at();

-- ─── 3. RLS ─────────────────────────────────────────────────────────
-- Members see their own requests. Admins see everything on the team.
-- Writes go through RPCs (SECURITY DEFINER) so RLS can stay strict.

ALTER TABLE public.task_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_requests_self_read ON public.task_requests;
CREATE POLICY task_requests_self_read
  ON public.task_requests FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid());

DROP POLICY IF EXISTS task_requests_admin_read ON public.task_requests;
CREATE POLICY task_requests_admin_read
  ON public.task_requests FOR SELECT
  TO authenticated
  USING (public.is_team_admin());

-- No direct INSERT/UPDATE/DELETE policies — all mutation goes through
-- the SECURITY DEFINER RPCs in the next migration.

-- ─── 4. Notifications: add task_request_id + relax subject constraint ─
ALTER TABLE public.assignment_notifications
  ADD COLUMN IF NOT EXISTS task_request_id uuid NULL
    REFERENCES public.task_requests(id) ON DELETE CASCADE;

-- Replace the XOR constraint (batch_id vs session_id) with a
-- "exactly one of three" check that also covers task_request_id.
ALTER TABLE public.assignment_notifications
  DROP CONSTRAINT IF EXISTS assignment_notifications_subject_check;
ALTER TABLE public.assignment_notifications
  ADD CONSTRAINT assignment_notifications_subject_check
  CHECK (
    (CASE WHEN batch_id        IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN session_id      IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN task_request_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

CREATE INDEX IF NOT EXISTS assignment_notifications_task_request_idx
  ON public.assignment_notifications (recipient_id, task_request_id, created_at DESC)
  WHERE task_request_id IS NOT NULL;

COMMENT ON TABLE public.task_requests IS
  'User-submitted requests for a new task to be added to their My Tasks queue. Admin reviews + approves (materializes an assigned_tasks row) or rejects. See PR #16.';
