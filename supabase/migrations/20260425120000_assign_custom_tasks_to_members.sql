-- PR #42 — multi-task variant of `assign_custom_task_to_members`.
--
-- The original RPC creates ONE batch with ONE task per recipient.
-- The new row-by-row +Task modal needs to submit a list of tasks
-- (custom rows + rows pulled from a template) as ONE batch so each
-- recipient sees a single notification ("3 new tasks") instead of
-- one per task.
--
-- Behaviour:
--   - Studio scope: each task definition becomes its own studio
--     row (no recipient, no notification).
--   - Member scope: ONE batch + N recipients + N×M tasks (one per
--     recipient per task definition). ONE notification per
--     recipient summarising the batch.
--
-- Validation: caller is admin, p_tasks is a non-empty jsonb array,
-- every task has a non-empty title, p_member_ids non-empty for
-- member scope.

CREATE OR REPLACE FUNCTION public.assign_custom_tasks_to_members(
  p_member_ids uuid[],
  p_tasks jsonb,
  p_batch_title text DEFAULT NULL,
  p_scope text DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_batch_id        uuid;
  v_recipient_count integer := 0;
  v_task_count      integer := 0;
  v_notif_count     integer := 0;
  v_task_array_len  integer;
  v_first_title     text;
  v_batch_title     text;
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
    SELECT 1
    FROM jsonb_array_elements(p_tasks) t
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

  INSERT INTO task_assignment_batches (
    assignment_type, title, description, assigned_by
  )
  VALUES ('custom_task', v_batch_title, NULL, auth.uid())
  RETURNING id INTO v_batch_id;

  IF p_scope = 'studio' THEN
    WITH ins AS (
      INSERT INTO assigned_tasks (
        recipient_assignment_id, assigned_to, scope, source_type,
        title, description, category, sort_order,
        is_required, due_date, visible_on_overview
      )
      SELECT NULL, NULL, 'studio', 'custom',
             trim(t->>'title'),
             NULLIF(t->>'description', ''),
             NULLIF(t->>'category', ''),
             COALESCE((t->>'sort_order')::int, ord),
             COALESCE((t->>'is_required')::boolean, false),
             NULLIF(t->>'due_date', '')::date,
             COALESCE((t->>'show_on_overview')::boolean, true)
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
        is_required, due_date, visible_on_overview
      )
      SELECT ar.id, ar.recipient_id, 'member', 'custom',
             trim(t->>'title'),
             NULLIF(t->>'description', ''),
             NULLIF(t->>'category', ''),
             ord::int,
             COALESCE((t->>'is_required')::boolean, false),
             NULLIF(t->>'due_date', '')::date,
             COALESCE((t->>'show_on_overview')::boolean, true)
      FROM assignment_recipients ar
      CROSS JOIN jsonb_array_elements(p_tasks) WITH ORDINALITY AS j(t, ord)
      WHERE ar.batch_id = v_batch_id
      RETURNING id
    )
    SELECT COUNT(*) INTO v_task_count FROM ins;

    WITH ins AS (
      INSERT INTO assignment_notifications (
        batch_id, recipient_id, notification_type, title, body
      )
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
$fn$;
