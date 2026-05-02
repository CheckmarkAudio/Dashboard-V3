-- Add the request-flow tables to supabase_realtime so cross-session
-- changes (admin deletes a task, a peer accepts a transfer, etc.)
-- propagate to every open browser instantly.
--
-- WHY: User reported a stale-cache bug where an admin deleted a task
-- on `/admin/templates`, then opened the member's My Tasks widget in
-- a different browser session and the deleted task was still listed.
-- Submitting a delete request against the (already-deleted) task
-- returned `task not found` from the server. Root cause: the
-- React Query realtime listener in MyTasksCard subscribes to
-- postgres_changes on `assigned_tasks` filtered by
-- `assigned_to=eq.<user-id>`, but the table wasn't in the
-- `supabase_realtime` publication — so no events were ever emitted
-- and the cache stayed stale until the next 60s refetchInterval.
--
-- Fix: add the four request-flow tables to the publication so DML
-- events (INSERT / UPDATE / DELETE) flow to subscribed clients.
--
-- REPLICA IDENTITY FULL on `assigned_tasks` so DELETE events carry
-- the FULL row (default identity = PK only). Without this, the
-- client filter `assigned_to=eq.<user-id>` cannot match a DELETE
-- event because the `assigned_to` column isn't included in the
-- emitted payload — so deletes silently slip past member-side
-- listeners. Update events with default identity carry only changed
-- columns; full identity is the safest default for any table whose
-- realtime listeners filter on non-PK columns.
--
-- Cost: REPLICA IDENTITY FULL ~doubles WAL volume per UPDATE/DELETE.
-- Acceptable for a small task table at our scale; revisit if write
-- throughput becomes an issue.
--
-- Out of scope: `sessions` (the booking-board live-update story is
-- Lean 5 territory and may want its own subscription topology).

BEGIN;

-- 1. Replica identity — required for DELETE events to carry filterable columns
ALTER TABLE public.assigned_tasks         REPLICA IDENTITY FULL;
ALTER TABLE public.assignment_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.task_requests          REPLICA IDENTITY FULL;
ALTER TABLE public.task_reassign_requests REPLICA IDENTITY FULL;

-- 2. Add to the realtime publication. `IF NOT EXISTS`-equivalent via
--    a DO block since ALTER PUBLICATION ADD TABLE has no native skip.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'assigned_tasks'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.assigned_tasks';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'assignment_notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_notifications';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'task_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.task_requests';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'task_reassign_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.task_reassign_requests';
  END IF;
END
$$;

COMMIT;
