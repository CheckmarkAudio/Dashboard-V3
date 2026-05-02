-- Member-initiated transfer flow — schema half.
--
-- WHY: Today task_reassign_requests is one-direction: a peer fires
-- request_task_reassignment to ASK to take someone else's task.
-- Member-side is missing the OPPOSITE direction — the current owner
-- wanting to hand a task off to a specific teammate. Per user
-- 2026-05-02: "we already have a nice 'request to take task' so we
-- probably should have tasks to be able to flow in the other
-- direction."
--
-- Approach: add a `direction` column ('take' | 'transfer') to the
-- existing table so the new flow shares 80% of the take-flow code.
-- The other columns retain their semantic ("requester_id = future
-- taker / new owner" and "current_assignee_id = current owner /
-- losing the task") for BOTH directions:
--
--   TAKE:     requester is the initiator; current_assignee decides
--   TRANSFER: current_assignee is the initiator; requester decides
--
-- The unique index that prevents duplicate pending requests now
-- includes `direction` so a take and a transfer for the same
-- (task, person) pair can coexist (rare but possible — e.g. A
-- requested to take B's task; B simultaneously decides to transfer
-- to A; both are valid intents until one resolves).
--
-- Existing rows backfill to 'take' via the column DEFAULT.
--
-- Rollback:
--   ALTER TABLE public.task_reassign_requests DROP COLUMN direction;
--   DROP INDEX uq_task_reassign_pending;
--   CREATE UNIQUE INDEX uq_task_reassign_pending
--     ON public.task_reassign_requests (task_id, requester_id)
--     WHERE status = 'pending';

BEGIN;

ALTER TABLE public.task_reassign_requests
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'take';

ALTER TABLE public.task_reassign_requests
  DROP CONSTRAINT IF EXISTS task_reassign_requests_direction_check;
ALTER TABLE public.task_reassign_requests
  ADD CONSTRAINT task_reassign_requests_direction_check
  CHECK (direction IN ('take', 'transfer'));

-- Replace the unique-pending index so a take + transfer for the
-- same (task, future-owner) pair can both be pending. They're
-- different intents and will resolve independently.
DROP INDEX IF EXISTS public.uq_task_reassign_pending;
CREATE UNIQUE INDEX uq_task_reassign_pending
  ON public.task_reassign_requests (task_id, requester_id, direction)
  WHERE status = 'pending';

COMMENT ON COLUMN public.task_reassign_requests.direction IS
  'take = peer asks to take owner''s task. transfer = owner asks to hand off to peer.';

COMMIT;
