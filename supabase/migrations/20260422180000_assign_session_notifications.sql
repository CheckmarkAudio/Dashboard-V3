-- PR #13 — Session assignment: extend the notifications pipeline to
-- cover session-assign events.
--
-- Why reuse `assignment_notifications` instead of a new table:
--   We want ONE notifications surface in the UI. Task-assign and
--   session-assign notifications should flow to the same widget, same
--   click-to-highlight behavior. A parallel `session_notifications`
--   table would double the read path for no user-facing benefit.
--
-- Schema changes:
--   1. Extend enum with 'session_assigned' + 'session_reassigned'
--   2. Relax batch_id NOT NULL (session rows use session_id instead)
--   3. Add session_id column (nullable FK to sessions, CASCADE delete)
--   4. XOR constraint: exactly one of batch_id / session_id is non-null
--
-- The `assign_session` RPC that consumes the new enum values lives in
-- the follow-up migration (20260422180001_assign_session_rpc.sql) so
-- the ALTER TYPE commits before the RPC body is compiled.
--
-- Guarded: no-op if assignment_notifications or sessions are missing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='assignment_notifications'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='sessions'
  ) THEN
    RETURN;
  END IF;

  -- 1. Extend enum. ALTER TYPE ADD VALUE IF NOT EXISTS is idempotent on PG12+.
  BEGIN
    ALTER TYPE public.assignment_notification_type ADD VALUE IF NOT EXISTS 'session_assigned';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.assignment_notification_type ADD VALUE IF NOT EXISTS 'session_reassigned';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- 2. Relax batch_id: session notifications have no batch.
  ALTER TABLE public.assignment_notifications
    ALTER COLUMN batch_id DROP NOT NULL;

  -- 3. Add session_id column.
  ALTER TABLE public.assignment_notifications
    ADD COLUMN IF NOT EXISTS session_id uuid NULL
      REFERENCES public.sessions(id) ON DELETE CASCADE;

  -- 4. XOR constraint: every row is tied to exactly one subject.
  ALTER TABLE public.assignment_notifications
    DROP CONSTRAINT IF EXISTS assignment_notifications_subject_check;
  ALTER TABLE public.assignment_notifications
    ADD CONSTRAINT assignment_notifications_subject_check
    CHECK (
      (batch_id IS NOT NULL AND session_id IS NULL)
      OR
      (batch_id IS NULL AND session_id IS NOT NULL)
    );

  -- Index for session-assign reads.
  CREATE INDEX IF NOT EXISTS assignment_notifications_session_idx
    ON public.assignment_notifications (recipient_id, session_id, created_at DESC)
    WHERE session_id IS NOT NULL;
END
$$;
