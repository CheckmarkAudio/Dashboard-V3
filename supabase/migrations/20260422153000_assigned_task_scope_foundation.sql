-- Foundation for monday-style task scope:
--   member task  -> one assignee (assigned_to NOT NULL on the row)
--   studio task  -> shared team work (assigned_to IS NULL)
--
-- Schema notes (matches actual Phase 1 shape from PR #6):
--   * The assignee column is `assigned_to` (uuid), not `assigned_to_member_id`.
--   * There is no `team_id` column on assigned_tasks — team scoping is
--     inferred via the batch chain:
--       assigned_tasks.recipient_assignment_id
--         -> assignment_recipients.batch_id
--         -> task_assignment_batches.assigned_by
--         -> intern_users.team_id
--   * Studio tasks still belong to a batch so they keep that chain —
--     admins create a studio-scope batch, the batch's `assigned_by`
--     anchors the team.
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

    -- 1. New columns. `completed_by` mirrors `assigned_by` on batches
    --    for naming consistency (no _member_id suffix elsewhere).
    ALTER TABLE public.assigned_tasks
      ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'member',
      ADD COLUMN IF NOT EXISTS completed_by uuid NULL;

    -- 2. Allow `assigned_to` to be NULL so studio rows can exist.
    --    Existing rows all have non-null assignees; the scope default
    --    of 'member' keeps the new check satisfied for them.
    ALTER TABLE public.assigned_tasks
      ALTER COLUMN assigned_to DROP NOT NULL;

    -- 3. Scope enumeration.
    ALTER TABLE public.assigned_tasks
      DROP CONSTRAINT IF EXISTS assigned_tasks_scope_check;
    ALTER TABLE public.assigned_tasks
      ADD CONSTRAINT assigned_tasks_scope_check
      CHECK (scope IN ('member', 'studio'));

    -- 4. Scope <-> assignee coupling.
    ALTER TABLE public.assigned_tasks
      DROP CONSTRAINT IF EXISTS assigned_tasks_scope_assignee_check;
    ALTER TABLE public.assigned_tasks
      ADD CONSTRAINT assigned_tasks_scope_assignee_check
      CHECK (
        (scope = 'member' AND assigned_to IS NOT NULL)
        OR
        (scope = 'studio' AND assigned_to IS NULL)
      );

    -- 5. Indexes sized for the two new read RPCs.
    CREATE INDEX IF NOT EXISTS assigned_tasks_scope_idx
      ON public.assigned_tasks (scope, is_completed, due_date);
    CREATE INDEX IF NOT EXISTS assigned_tasks_assigned_to_scope_idx
      ON public.assigned_tasks (assigned_to, scope, is_completed, due_date);

    -- 6. Team-wide read RPC. Returns member + studio tasks whose owning
    --    batch was created by a member of the caller's team, matching
    --    the single-team-per-studio model of intern_users.
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.get_team_assigned_tasks(
        p_user_id uuid,
        p_include_completed boolean DEFAULT false
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
      DECLARE
        v_caller_id uuid := auth.uid();
        v_team_id   uuid := public.get_my_team_id();
      BEGIN
        IF v_caller_id IS NULL THEN
          RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
        END IF;

        RETURN COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',                      t.id,
              'title',                   t.title,
              'description',             t.description,
              'category',                t.category,
              'sort_order',              t.sort_order,
              'is_required',             t.is_required,
              'is_completed',            t.is_completed,
              'completed_at',            t.completed_at,
              'due_date',                t.due_date,
              'visible_on_overview',     t.visible_on_overview,
              'source_type',             t.source_type,
              'source_template_id',      t.source_template_id,
              'source_template_item_id', t.source_template_item_id,
              'created_at',              t.created_at,
              'updated_at',              t.updated_at,
              'scope',                   t.scope,
              'assigned_to',             t.assigned_to,
              'assigned_to_name',        assignee.name,
              'can_complete', (
                t.scope = 'studio'
                OR t.assigned_to = v_caller_id
                OR public.is_team_admin()
              ),
              'batch', jsonb_build_object(
                'id',              b.id,
                'assignment_type', b.assignment_type,
                'title',           b.title,
                'description',     b.description,
                'assigned_by',     b.assigned_by,
                'created_at',      b.created_at
              )
            )
            ORDER BY t.is_completed ASC,
                     t.due_date NULLS LAST,
                     t.sort_order ASC,
                     t.created_at DESC
          )
          FROM public.assigned_tasks t
          JOIN public.assignment_recipients ar ON ar.id = t.recipient_assignment_id
          JOIN public.task_assignment_batches b ON b.id = ar.batch_id
          JOIN public.intern_users admin ON admin.id = b.assigned_by
          LEFT JOIN public.intern_users assignee ON assignee.id = t.assigned_to
          WHERE ar.status = 'active'
            AND admin.team_id = v_team_id
            AND (p_include_completed OR t.is_completed = false)
        ), '[]'::jsonb);
      END;
      $fn$;
    $sql$;

    -- 7. Studio-only RPC. Strict subset of the team view filtered to
    --    scope='studio'. Anyone on the team can complete a studio task,
    --    so can_complete is always true for rows this RPC returns.
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.get_studio_assigned_tasks(
        p_user_id uuid,
        p_include_completed boolean DEFAULT false
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
      DECLARE
        v_caller_id uuid := auth.uid();
        v_team_id   uuid := public.get_my_team_id();
      BEGIN
        IF v_caller_id IS NULL THEN
          RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
        END IF;

        RETURN COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',                      t.id,
              'title',                   t.title,
              'description',             t.description,
              'category',                t.category,
              'sort_order',              t.sort_order,
              'is_required',             t.is_required,
              'is_completed',            t.is_completed,
              'completed_at',            t.completed_at,
              'due_date',                t.due_date,
              'visible_on_overview',     t.visible_on_overview,
              'source_type',             t.source_type,
              'source_template_id',      t.source_template_id,
              'source_template_item_id', t.source_template_item_id,
              'created_at',              t.created_at,
              'updated_at',              t.updated_at,
              'scope',                   t.scope,
              'assigned_to',             NULL::uuid,
              'assigned_to_name',        NULL::text,
              'can_complete',            true,
              'batch', jsonb_build_object(
                'id',              b.id,
                'assignment_type', b.assignment_type,
                'title',           b.title,
                'description',     b.description,
                'assigned_by',     b.assigned_by,
                'created_at',      b.created_at
              )
            )
            ORDER BY t.is_completed ASC,
                     t.due_date NULLS LAST,
                     t.sort_order ASC,
                     t.created_at DESC
          )
          FROM public.assigned_tasks t
          JOIN public.assignment_recipients ar ON ar.id = t.recipient_assignment_id
          JOIN public.task_assignment_batches b ON b.id = ar.batch_id
          JOIN public.intern_users admin ON admin.id = b.assigned_by
          WHERE ar.status = 'active'
            AND admin.team_id = v_team_id
            AND t.scope = 'studio'
            AND (p_include_completed OR t.is_completed = false)
        ), '[]'::jsonb);
      END;
      $fn$;
    $sql$;

    COMMENT ON FUNCTION public.get_team_assigned_tasks(uuid, boolean)
      IS 'Team-wide view of assigned_tasks (member + studio), scoped via batch.assigned_by.team_id.';

    COMMENT ON FUNCTION public.get_studio_assigned_tasks(uuid, boolean)
      IS 'Studio-scope subset of assigned_tasks. can_complete is true for every team member.';

  END IF;
END
$$;
