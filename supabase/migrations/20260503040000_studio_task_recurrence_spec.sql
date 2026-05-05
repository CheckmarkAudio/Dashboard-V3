-- Studio Tasks recurrence — schema column + RPC plumbing.
--
-- MCP-APPLIED: 2026-05-03 to ncljfjdcyswoeitsooty as
-- migration `studio_task_recurrence_spec`.
-- ADVISOR-VERIFIED: 0 ERRORS, 75 WARN (unchanged — both RPCs replaced
-- in-place with the same signatures, no overload pollution).
--
-- Mirrors the recurrence_spec shape that task_requests already uses
-- ({frequency: 'daily'|'weekly'|'monthly', interval: int}). Only
-- persisted + displayed for now — the auto-recreate scheduler that
-- will fire new tasks on the cadence is a future engine; this PR
-- captures the spec so it's ready when that ships.
--
-- Member-scope tasks keep recurrence_spec NULL for now (the modal's
-- RecurrencePicker only shows in studio mode this PR; the column
-- accepts member-task recurrence too so the UI side is a 1-line
-- change when we want to extend it).

-- 1. Schema: nullable jsonb with a shape CHECK so bad payloads
--    can't slip in via the RPC.
ALTER TABLE public.assigned_tasks
  ADD COLUMN IF NOT EXISTS recurrence_spec jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assigned_tasks_recurrence_spec_check'
      AND conrelid = 'public.assigned_tasks'::regclass
  ) THEN
    ALTER TABLE public.assigned_tasks
      ADD CONSTRAINT assigned_tasks_recurrence_spec_check CHECK (
        recurrence_spec IS NULL
        OR (
          jsonb_typeof(recurrence_spec) = 'object'
          AND recurrence_spec ? 'frequency'
          AND recurrence_spec->>'frequency' = ANY (ARRAY['daily','weekly','monthly'])
        )
      );
  END IF;
END $$;

-- 2. assign_custom_tasks_to_members — thread recurrence_spec through
--    both INSERT branches.
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
        studio_space, recurrence_spec
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
             NULLIF(t->>'studio_space', ''),
             CASE WHEN t ? 'recurrence_spec' AND jsonb_typeof(t->'recurrence_spec') = 'object'
                  THEN t->'recurrence_spec'
                  ELSE NULL
             END
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
        is_required, due_date, visible_on_overview, team_id,
        recurrence_spec
      )
      SELECT ar.id, ar.recipient_id, 'member', 'custom',
             trim(t->>'title'),
             NULLIF(t->>'description', ''),
             NULLIF(t->>'category', ''),
             ord::int,
             COALESCE((t->>'is_required')::boolean, false),
             NULLIF(t->>'due_date', '')::date,
             COALESCE((t->>'show_on_overview')::boolean, true),
             v_team_id,
             CASE WHEN t ? 'recurrence_spec' AND jsonb_typeof(t->'recurrence_spec') = 'object'
                  THEN t->'recurrence_spec'
                  ELSE NULL
             END
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

-- 3. get_studio_assigned_tasks — surface recurrence_spec.
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
        'recurrence_spec',         t.recurrence_spec,
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
