-- Foundation for monday-style task scope:
--   member task  -> one assignee
--   studio task  -> shared team work
--
-- This migration is intentionally guarded. If the Phase 1 assignment
-- tables are not present in the local database yet, the migration is a
-- no-op instead of failing.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'assigned_tasks'
  ) THEN
    ALTER TABLE public.assigned_tasks
      ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'member',
      ADD COLUMN IF NOT EXISTS completed_by_member_id uuid NULL;

    ALTER TABLE public.assigned_tasks
      DROP CONSTRAINT IF EXISTS assigned_tasks_scope_check;

    ALTER TABLE public.assigned_tasks
      ADD CONSTRAINT assigned_tasks_scope_check
      CHECK (scope IN ('member', 'studio'));

    ALTER TABLE public.assigned_tasks
      DROP CONSTRAINT IF EXISTS assigned_tasks_scope_assignee_check;

    ALTER TABLE public.assigned_tasks
      ADD CONSTRAINT assigned_tasks_scope_assignee_check
      CHECK (
        (scope = 'member' AND assigned_to_member_id IS NOT NULL)
        OR
        (scope = 'studio' AND assigned_to_member_id IS NULL)
      );

    CREATE INDEX IF NOT EXISTS assigned_tasks_team_scope_idx
      ON public.assigned_tasks (team_id, scope, is_completed, due_date);

    CREATE INDEX IF NOT EXISTS assigned_tasks_member_scope_idx
      ON public.assigned_tasks (assigned_to_member_id, scope, is_completed, due_date);

    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.get_team_assigned_tasks(
        p_user_id uuid,
        p_include_completed boolean DEFAULT false
      )
      RETURNS SETOF public.assigned_tasks
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
        SELECT at.*
        FROM public.assigned_tasks at
        WHERE at.team_id = public.get_my_team_id()
          AND (
            p_include_completed
            OR at.is_completed = false
          )
        ORDER BY
          at.is_completed ASC,
          at.due_date NULLS LAST,
          at.sort_order ASC,
          at.created_at DESC;
      $fn$;
    $sql$;

    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.get_studio_assigned_tasks(
        p_user_id uuid,
        p_include_completed boolean DEFAULT false
      )
      RETURNS SETOF public.assigned_tasks
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
        SELECT at.*
        FROM public.assigned_tasks at
        WHERE at.team_id = public.get_my_team_id()
          AND at.scope = 'studio'
          AND (
            p_include_completed
            OR at.is_completed = false
          )
        ORDER BY
          at.is_completed ASC,
          at.due_date NULLS LAST,
          at.sort_order ASC,
          at.created_at DESC;
      $fn$;
    $sql$;

    COMMENT ON FUNCTION public.get_team_assigned_tasks(uuid, boolean)
      IS 'Returns all visible assigned_tasks for the current team, including studio tasks.';

    COMMENT ON FUNCTION public.get_studio_assigned_tasks(uuid, boolean)
      IS 'Returns shared studio tasks from assigned_tasks where scope = studio.';
  END IF;
END
$$;
