-- Allow each draft in the multi-task assignment RPC to target its own
-- recipient set. `p_member_ids` remains the backwards-compatible
-- fallback for callers that do not send `recipient_ids` per task.

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
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tasks) t
    WHERE COALESCE(NULLIF(trim(t->>'title'), ''), NULL) IS NULL
  ) THEN
    RAISE EXCEPTION 'every task must have a non-empty title' USING ERRCODE = '22023';
  END IF;
  IF p_scope = 'member' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tasks) t
    WHERE NOT (
      t ? 'recipient_ids'
      AND jsonb_typeof(t->'recipient_ids') = 'array'
      AND jsonb_array_length(t->'recipient_ids') > 0
    )
    AND (p_member_ids IS NULL OR array_length(p_member_ids, 1) IS NULL)
  ) THEN
    RAISE EXCEPTION 'every member task must have at least one recipient'
      USING ERRCODE = '22023';
  END IF;

  v_first_title := p_tasks->0->>'title';
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
             CASE
               WHEN t ? 'recurrence_spec'
                 AND jsonb_typeof(t->'recurrence_spec') = 'object'
               THEN t->'recurrence_spec'
               ELSE NULL
             END
      FROM jsonb_array_elements(p_tasks) WITH ORDINALITY AS j(t, ord)
      RETURNING id
    )
    SELECT COUNT(*) INTO v_task_count FROM ins;
  ELSE
    WITH task_recipients AS (
      SELECT DISTINCT recipient.value::uuid AS recipient_id
      FROM jsonb_array_elements(p_tasks) t
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE
          WHEN t ? 'recipient_ids'
            AND jsonb_typeof(t->'recipient_ids') = 'array'
            AND jsonb_array_length(t->'recipient_ids') > 0
          THEN t->'recipient_ids'
          ELSE COALESCE(to_jsonb(p_member_ids), '[]'::jsonb)
        END
      ) recipient(value)
    ),
    ins AS (
      INSERT INTO assignment_recipients (batch_id, recipient_id)
      SELECT v_batch_id, recipient_id
      FROM task_recipients
      ON CONFLICT (batch_id, recipient_id) DO NOTHING
      RETURNING id, recipient_id
    )
    SELECT COUNT(*) INTO v_recipient_count FROM ins;

    WITH task_recipients AS (
      SELECT t, ord, recipient.value::uuid AS recipient_id
      FROM jsonb_array_elements(p_tasks) WITH ORDINALITY AS j(t, ord)
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE
          WHEN t ? 'recipient_ids'
            AND jsonb_typeof(t->'recipient_ids') = 'array'
            AND jsonb_array_length(t->'recipient_ids') > 0
          THEN t->'recipient_ids'
          ELSE COALESCE(to_jsonb(p_member_ids), '[]'::jsonb)
        END
      ) recipient(value)
    ),
    ins AS (
      INSERT INTO assigned_tasks (
        recipient_assignment_id, assigned_to, scope, source_type,
        title, description, category, sort_order,
        is_required, due_date, visible_on_overview, team_id,
        recurrence_spec
      )
      SELECT ar.id, ar.recipient_id, 'member', 'custom',
             trim(tr.t->>'title'),
             NULLIF(tr.t->>'description', ''),
             NULLIF(tr.t->>'category', ''),
             tr.ord::int,
             COALESCE((tr.t->>'is_required')::boolean, false),
             NULLIF(tr.t->>'due_date', '')::date,
             COALESCE((tr.t->>'show_on_overview')::boolean, true),
             v_team_id,
             CASE
               WHEN tr.t ? 'recurrence_spec'
                 AND jsonb_typeof(tr.t->'recurrence_spec') = 'object'
               THEN tr.t->'recurrence_spec'
               ELSE NULL
             END
      FROM task_recipients tr
      JOIN assignment_recipients ar
        ON ar.batch_id = v_batch_id
       AND ar.recipient_id = tr.recipient_id
      RETURNING id
    )
    SELECT COUNT(*) INTO v_task_count FROM ins;

    WITH task_recipients AS (
      SELECT t, ord, recipient.value::uuid AS recipient_id
      FROM jsonb_array_elements(p_tasks) WITH ORDINALITY AS j(t, ord)
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE
          WHEN t ? 'recipient_ids'
            AND jsonb_typeof(t->'recipient_ids') = 'array'
            AND jsonb_array_length(t->'recipient_ids') > 0
          THEN t->'recipient_ids'
          ELSE COALESCE(to_jsonb(p_member_ids), '[]'::jsonb)
        END
      ) recipient(value)
    ),
    recipient_summary AS (
      SELECT
        recipient_id,
        COUNT(*)::integer AS task_count,
        (array_agg(NULLIF(t->>'description', '') ORDER BY ord))[1] AS first_description
      FROM task_recipients
      GROUP BY recipient_id
    ),
    ins AS (
      INSERT INTO assignment_notifications (
        batch_id, recipient_id, notification_type, title, body
      )
      SELECT
        v_batch_id,
        recipient_id,
        'task_assigned',
        v_batch_title,
        CASE
          WHEN task_count = 1
          THEN COALESCE(first_description, 'New task assigned to you.')
          ELSE task_count || ' new tasks assigned to you.'
        END
      FROM recipient_summary
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
