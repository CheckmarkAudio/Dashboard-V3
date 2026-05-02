-- Extend `task_requests` to support edit + delete request kinds.
--
-- WHY: Until now, task_requests only modeled "create new task" — a
-- member submits a title/description/due, an admin approves and the
-- existing approve_task_request RPC materializes an assigned_tasks
-- row. With admin direct-delete shipped (PR #82) the next half of
-- the agreed model needs a path: members request delete + edit,
-- admins approve via the existing PendingTaskRequestsWidget queue.
--
-- Design choice — extend the existing table vs. sibling tables:
--   We extend. One queue, one widget, one notification flow, one
--   approval RPC dispatched on `kind`. The `task_reassign_requests`
--   sibling-table pattern is fine for its specific purpose (peer-
--   to-peer task transfer) but multiplying tables for every request
--   variety would balloon the surface area.
--
-- New columns:
--   - kind (text, NOT NULL, default 'create', CHECK in {create,edit,delete})
--   - target_task_id (uuid, NULL, FK to assigned_tasks ON DELETE CASCADE)
--
-- New CHECK: kind='create' requires target_task_id IS NULL; kind in
-- ('edit','delete') requires target_task_id IS NOT NULL. Old rows
-- backfill to kind='create' automatically via the column DEFAULT,
-- and all of them already have target_task_id IS NULL → constraint
-- holds without a separate backfill step.
--
-- For 'delete' rows, `title` carries the task-title snapshot so the
-- approval widget can show what's about to be deleted even after the
-- target is gone (target_task_id CASCADE clears if the task is
-- already deleted). For 'edit' rows (this PR doesn't ship the UI),
-- `title` carries the proposed new title.
--
-- This migration is schema-only — RPCs land in the next migration so
-- the new columns commit before the function bodies reference them.
--
-- Rollback: ALTER TABLE public.task_requests
--   DROP CONSTRAINT task_requests_kind_target_check,
--   DROP COLUMN kind,
--   DROP COLUMN target_task_id;

BEGIN;

ALTER TABLE public.task_requests
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'create';

ALTER TABLE public.task_requests
  DROP CONSTRAINT IF EXISTS task_requests_kind_check;
ALTER TABLE public.task_requests
  ADD CONSTRAINT task_requests_kind_check
  CHECK (kind IN ('create', 'edit', 'delete'));

ALTER TABLE public.task_requests
  ADD COLUMN IF NOT EXISTS target_task_id uuid NULL
    REFERENCES public.assigned_tasks(id) ON DELETE CASCADE;

ALTER TABLE public.task_requests
  DROP CONSTRAINT IF EXISTS task_requests_kind_target_check;
ALTER TABLE public.task_requests
  ADD CONSTRAINT task_requests_kind_target_check
  CHECK (
    (kind = 'create'  AND target_task_id IS NULL) OR
    (kind = 'edit'    AND target_task_id IS NOT NULL) OR
    (kind = 'delete'  AND target_task_id IS NOT NULL)
  );

-- Index admins' pending queue lookup so the widget query stays fast
-- when filtering by kind for the badge color / body shape.
CREATE INDEX IF NOT EXISTS task_requests_pending_kind_idx
  ON public.task_requests (status, kind, created_at DESC)
  WHERE status = 'pending';

COMMENT ON COLUMN public.task_requests.kind IS
  'create | edit | delete — what the member is asking the admin to do.';
COMMENT ON COLUMN public.task_requests.target_task_id IS
  'For edit/delete: the assigned_tasks row being acted on. NULL for create.';

COMMIT;
