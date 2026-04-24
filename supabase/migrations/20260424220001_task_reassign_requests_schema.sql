-- PR #38 — schema for peer-to-peer task reassignment requests.
--
-- When a user sees a team-member's task in the Team Tasks widget and
-- wants to take it over, they fire this via RPC. The assignee gets a
-- notification; they approve or decline. Approval atomically moves
-- assigned_to to the requester.

CREATE TABLE IF NOT EXISTS public.task_reassign_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.assigned_tasks(id) ON DELETE CASCADE,
  -- References to `team_members` (the real table). `intern_users` is a
  -- compat view; FK targets must be real tables.
  requester_id uuid NOT NULL REFERENCES public.team_members(id),
  current_assignee_id uuid NOT NULL REFERENCES public.team_members(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','declined','cancelled')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolver_id uuid REFERENCES public.team_members(id)
);

-- One pending request per (task, requester) — prevent duplicate pings.
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_reassign_pending
  ON public.task_reassign_requests (task_id, requester_id)
  WHERE status = 'pending';

-- Assignee-side lookup by pending status.
CREATE INDEX IF NOT EXISTS idx_task_reassign_assignee_pending
  ON public.task_reassign_requests (current_assignee_id, status)
  WHERE status = 'pending';

ALTER TABLE public.task_reassign_requests ENABLE ROW LEVEL SECURITY;

-- Only involved parties + admins can read. All writes via RPC.
DROP POLICY IF EXISTS task_reassign_requests_select ON public.task_reassign_requests;
CREATE POLICY task_reassign_requests_select ON public.task_reassign_requests
  FOR SELECT USING (
    requester_id = auth.uid()
    OR current_assignee_id = auth.uid()
    OR public.is_team_admin()
  );

-- Extend assignment_notifications with this subject. XOR constraint
-- now covers all four polymorphic refs.
ALTER TABLE public.assignment_notifications
  ADD COLUMN IF NOT EXISTS task_reassign_request_id uuid
  REFERENCES public.task_reassign_requests(id) ON DELETE CASCADE;

ALTER TABLE public.assignment_notifications
  DROP CONSTRAINT IF EXISTS assignment_notifications_subject_check;
ALTER TABLE public.assignment_notifications
  ADD CONSTRAINT assignment_notifications_subject_check CHECK ((
    (CASE WHEN batch_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN session_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN task_request_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN task_reassign_request_id IS NOT NULL THEN 1 ELSE 0 END)
  ) = 1);
