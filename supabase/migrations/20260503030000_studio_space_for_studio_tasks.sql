-- Studio Tasks divided by physical space — schema + RPC plumbing.
--
-- MCP-APPLIED: 2026-05-03 to ncljfjdcyswoeitsooty as
-- migrations `studio_space_for_studio_tasks` +
-- `studio_space_drop_old_admin_update_overload`.
-- ADVISOR-VERIFIED: 0 ERRORS, 75 WARN (+1 by-design from the new
-- admin_update_assigned_task signature; old 8-param overload dropped).
--
-- New column lets the admin tag a `scope='studio'` task with which
-- physical room it lives in (Control Room / Studio A / Studio B), so
-- the new Studio Tasks pane on /admin/templates can render rows under
-- per-room section headers instead of one flat list.
--
-- Distinct from the booking system's `StudioSpace` enum
-- ('Studio A' | 'Studio B' | 'Home Visit' | 'Venue') which describes
-- where a session happens. Studio TASKS are about studio upkeep
-- (cleaning, patch bay rewire, mic stand reset) and only happen in
-- physical rooms, never off-site.

-- 1. Schema: nullable `studio_space text`. Backfill window is wide
--    open (existing studio tasks stay NULL until an admin tags them).
ALTER TABLE public.assigned_tasks
  ADD COLUMN IF NOT EXISTS studio_space text;

-- 2. CHECK: the column is meaningful only for studio-scope tasks, and
--    if set must be one of the three physical rooms. Member-scope
--    tasks must keep it NULL — guards against a future bug where a
--    member task accidentally inherits a room tag.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assigned_tasks_studio_space_check'
      AND conrelid = 'public.assigned_tasks'::regclass
  ) THEN
    ALTER TABLE public.assigned_tasks
      ADD CONSTRAINT assigned_tasks_studio_space_check CHECK (
        studio_space IS NULL
        OR (
          scope = 'studio'
          AND studio_space = ANY (ARRAY['Control Room', 'Studio A', 'Studio B'])
        )
      );
  END IF;
END $$;

-- 3. assign_custom_tasks_to_members — extend the studio-scope branch
--    to read `studio_space` from each task element and persist it.
--    Member-scope branch is unchanged (member tasks ignore the field).
CREATE OR REPLACE FUNCTION public.assign_custom_tasks_to_members(
  p_member_ids uuid[],
  p_tasks jsonb,
  p_batch_title text DEFAULT NULL::text,
  p_scope text DEFAULT 'member'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_batch_id        uuid;
  v_recipient_count integer := 0;
  v_task_count      integer := 0;
  v_notif_count     integer := 0;
  v_task_array_len  integer;
  v_first_title     text;
  v_batch_title     text;
  v_team_id         uuid := public.get_my_team_id();
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;
  IF p_tasks IS NULL OR jsonb_typeof(p_tasks) <> 'array' THEN
    RAISE EXCEPTION 'p_tasks must be a non-null jsonb array' USING ERRCODE = '22023';
  END IF;
  v_task_array_len := jsonb_array_length(p_tasks);
  IF v_task_array_len = 0 THEN
    RAISE EXCEPTION 'p_tasks must contain at least one task' USING ERRCODE = '22023';
  END IF;
  IF p_scope NOT IN ('member', 'studio') THEN
    RAISE EXCEPTION 'p_scope must be member or studio' USING ERRCODE = '22023';
  END IF;
  IF p_scope = 'member' AND (p_member_ids IS NULL OR array_length(p_member_ids, 1) IS NULL) THEN
    RAISE EXCEPTION 'p_member_ids must not be empty for member scope' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_tasks) t
    WHERE COALESCE(NULLIF(trim(t->>'title'), ''), NULL) IS NULL
  ) THEN
    RAISE EXCEPTION 'every task must have a non-empty title' USING ERRCODE = '22023';
  END IF;

  v_first_title := (p_tasks->0->>'title');
  v_batch_title := COALESCE(
    NULLIF(trim(p_batch_title), ''),
    CASE
      WHEN v_task_array_len = 1 THEN v_first_title
      ELSE v_first_title || ' +' || (v_task_array_len - 1) || ' more'
    END
  );

  INSERT INTO task_assignment_batches (assignment_type, title, description, assigned_by)
  VALUES ('custom_task', v_batch_title, NULL, auth.uid())
  RETURNING id INTO v_batch_id;

  IF p_scope = 'studio' THEN
    WITH ins AS (
      INSERT INTO assigned_tasks (
        recipient_assignment_id, assigned_to, scope, source_type,
        title, description, category, sort_order,
        is_required, due_date, visible_on_overview, team_id,
        studio_space
      )
      SELECT NULL, NULL, 'studio', 'custom',
             trim(t->>'title'),
             NULLIF(t->>'description', ''),
             NULLIF(t->>'category', ''),
             COALESCE((t->>'sort_order')::int, ord),
             COALESCE((t->>'is_required')::boolean, false),
             NULLIF(t->>'due_date', '')::date,
             COALESCE((t->>'show_on_overview')::boolean, true),
             v_team_id,
             NULLIF(t->>'studio_space', '')
      FROM jsonb_array_elements(p_tasks) WITH ORDINALITY AS j(t, ord)
      RETURNING id
    )
    SELECT COUNT(*) INTO v_task_count FROM ins;
  ELSE
    WITH ins AS (
      INSERT INTO assignment_recipients (batch_id, recipient_id)
      SELECT v_batch_id, DISTINCT_mid
      FROM (SELECT DISTINCT unnest(p_member_ids) AS DISTINCT_mid) s
      ON CONFLICT (batch_id, recipient_id) DO NOTHING
      RETURNING id, recipient_id
    )
    SELECT COUNT(*) INTO v_recipient_count FROM ins;

    WITH ins AS (
      INSERT INTO assigned_tasks (
        recipient_assignment_id, assigned_to, scope, source_type,
        title, description, category, sort_order,
        is_required, due_date, visible_on_overview, team_id
      )
      SELECT ar.id, ar.recipient_id, 'member', 'custom',
             trim(t->>'title'),
             NULLIF(t->>'description', ''),
             NULLIF(t->>'category', ''),
             ord::int,
             COALESCE((t->>'is_required')::boolean, false),
             NULLIF(t->>'due_date', '')::date,
             COALESCE((t->>'show_on_overview')::boolean, true),
             v_team_id
      FROM assignment_recipients ar
      CROSS JOIN jsonb_array_elements(p_tasks) WITH ORDINALITY AS j(t, ord)
      WHERE ar.batch_id = v_batch_id
      RETURNING id
    )
    SELECT COUNT(*) INTO v_task_count FROM ins;

    WITH ins AS (
      INSERT INTO assignment_notifications (batch_id, recipient_id, notification_type, title, body)
      SELECT v_batch_id, ar.recipient_id, 'task_assigned',
             v_batch_title,
             CASE WHEN v_task_array_len = 1
                  THEN COALESCE(NULLIF(p_tasks->0->>'description', ''), 'New task assigned to you.')
                  ELSE v_task_array_len || ' new tasks assigned to you.'
             END
      FROM assignment_recipients ar
      WHERE ar.batch_id = v_batch_id
      RETURNING id
    )
    SELECT COUNT(*) INTO v_notif_count FROM ins;
  END IF;

  RETURN jsonb_build_object(
    'batch_id',           v_batch_id,
    'batch_title',        v_batch_title,
    'recipient_count',    v_recipient_count,
    'task_count',         v_task_count,
    'notification_count', v_notif_count,
    'scope',              p_scope
  );
END;
$$;

-- 4. get_studio_assigned_tasks — surface `studio_space` in the
--    JSON projection so the frontend can group rows by section.
CREATE OR REPLACE FUNCTION public.get_studio_assigned_tasks(
  p_user_id uuid,
  p_include_completed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        'studio_space',            t.studio_space,
        'assigned_to',             NULL::uuid,
        'assigned_to_name',        NULL::text,
        'can_complete',            true,
        'batch', NULL
      )
      ORDER BY t.is_completed ASC,
               t.studio_space NULLS FIRST,
               t.due_date NULLS LAST,
               t.sort_order ASC,
               t.created_at DESC
    )
    FROM public.assigned_tasks t
    WHERE t.team_id = v_team_id
      AND t.scope = 'studio'
      AND (p_include_completed OR t.is_completed = false)
  ), '[]'::jsonb);
END;
$$;

-- 5. admin_update_assigned_task — accept p_studio_space + p_clear_studio_space
--    so the Studio Tasks pane can edit the room tag inline.
--    The old 8-param overload was DROPPED in a paired migration
--    (studio_space_drop_old_admin_update_overload) to keep PostgREST
--    resolution unambiguous.
CREATE OR REPLACE FUNCTION public.admin_update_assigned_task(
  p_task_id uuid,
  p_title text DEFAULT NULL::text,
  p_description text DEFAULT NULL::text,
  p_category text DEFAULT NULL::text,
  p_due_date date DEFAULT NULL::date,
  p_clear_due boolean DEFAULT false,
  p_clear_description boolean DEFAULT false,
  p_clear_category boolean DEFAULT false,
  p_studio_space text DEFAULT NULL,
  p_clear_studio_space boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_team       uuid := public.get_my_team_id();
  v_task       public.assigned_tasks%ROWTYPE;
  v_admin_name text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task
    FROM public.assigned_tasks
   WHERE id = p_task_id
     AND team_id = v_team
   FOR UPDATE;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'task not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_studio_space IS NOT NULL AND v_task.scope <> 'studio' THEN
    RAISE EXCEPTION 'studio_space is only valid for studio-scope tasks' USING ERRCODE = '22023';
  END IF;

  UPDATE public.assigned_tasks
     SET title       = COALESCE(NULLIF(p_title, ''), title),
         description = CASE
                         WHEN p_clear_description THEN NULL
                         WHEN p_description IS NOT NULL THEN p_description
                         ELSE description
                       END,
         category    = CASE
                         WHEN p_clear_category THEN NULL
                         WHEN p_category IS NOT NULL THEN p_category
                         ELSE category
                       END,
         due_date    = CASE
                         WHEN p_clear_due THEN NULL
                         WHEN p_due_date IS NOT NULL THEN p_due_date
                         ELSE due_date
                       END,
         studio_space = CASE
                          WHEN p_clear_studio_space THEN NULL
                          WHEN p_studio_space IS NOT NULL THEN p_studio_space
                          ELSE studio_space
                        END,
         updated_at  = now()
   WHERE id = p_task_id
     AND team_id = v_team
   RETURNING * INTO v_task;

  IF v_task.scope = 'member'
     AND v_task.assigned_to IS NOT NULL
     AND v_task.assigned_to <> v_caller THEN
    SELECT display_name INTO v_admin_name
      FROM public.team_members WHERE id = v_caller;
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body, batch_id
    )
    SELECT
      v_task.assigned_to,
      'task_edited',
      COALESCE(v_admin_name, 'An admin') || ' updated "'
        || COALESCE(v_task.title, 'a task') || '"',
      'Check the details — due date, description, or stage may have changed.',
      ar.batch_id
    FROM public.assignment_recipients ar
    WHERE ar.id = v_task.recipient_assignment_id;
  END IF;

  RETURN to_jsonb(v_task);
END;
$$;

-- Drop the legacy 8-param overload after the new 10-param signature
-- ships, so PostgREST never has to disambiguate. Same cleanup pattern
-- PR #97 used when consolidating approve_task_request.
DROP FUNCTION IF EXISTS public.admin_update_assigned_task(
  uuid,
  text,
  text,
  text,
  date,
  boolean,
  boolean,
  boolean
);
