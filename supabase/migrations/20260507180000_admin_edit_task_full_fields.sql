-- Round out the admin "Edit task" surface so admins can change every
-- editable field on an assigned task: recurrence, required flag, and
-- assignee — in addition to the existing title / description /
-- category / due_date / studio_space already supported.
--
-- Two changes:
--   1. Extend `admin_update_assigned_task` with three new optional
--      params: p_recurrence_spec (jsonb), p_clear_recurrence_spec,
--      p_is_required (nullable boolean = "don't change" when null),
--      p_assigned_to (uuid), p_clear_assigned_to.
--   2. New `admin_clone_task_to_members(p_task_id, p_member_ids[])`
--      RPC for "add additional people" — copies the source task to
--      each new recipient as its own row (mirrors the multi-task RPC
--      pattern). Skips members who already have the same task in
--      their queue (de-dupe by title + parent batch when present).

-- 1. admin_update_assigned_task — additive params ──────────────────
CREATE OR REPLACE FUNCTION public.admin_update_assigned_task(
  p_task_id              uuid,
  p_title                text     DEFAULT NULL::text,
  p_description          text     DEFAULT NULL::text,
  p_category             text     DEFAULT NULL::text,
  p_due_date             date     DEFAULT NULL::date,
  p_clear_due            boolean  DEFAULT false,
  p_clear_description    boolean  DEFAULT false,
  p_clear_category       boolean  DEFAULT false,
  p_studio_space         text     DEFAULT NULL::text,
  p_clear_studio_space   boolean  DEFAULT false,
  p_recurrence_spec      jsonb    DEFAULT NULL::jsonb,
  p_clear_recurrence_spec boolean DEFAULT false,
  p_is_required          boolean  DEFAULT NULL::boolean,
  p_assigned_to          uuid     DEFAULT NULL::uuid,
  p_clear_assigned_to    boolean  DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller     uuid := auth.uid();
  v_team       uuid := public.get_my_team_id();
  v_task       public.assigned_tasks%ROWTYPE;
  v_admin_name text;
  v_recipient_assignment_id uuid;
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

  -- Validate the new assignee belongs to this team if reassigning.
  IF p_assigned_to IS NOT NULL THEN
    IF v_task.scope <> 'member' THEN
      RAISE EXCEPTION 'assigned_to is only valid for member-scope tasks' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members
       WHERE id = p_assigned_to AND team_id = v_team
    ) THEN
      RAISE EXCEPTION 'assignee not on this team' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- When reassigning, also fan out a fresh assignment_recipients row
  -- so notifications + per-recipient lookups stay coherent. Reuse the
  -- existing batch (so the row keeps its origin) but point at the new
  -- recipient. ON CONFLICT DO NOTHING handles the (rare) case where
  -- the new recipient already has a row in the same batch.
  IF p_assigned_to IS NOT NULL AND v_task.recipient_assignment_id IS NOT NULL THEN
    INSERT INTO public.assignment_recipients (batch_id, recipient_id)
    SELECT batch_id, p_assigned_to
      FROM public.assignment_recipients
     WHERE id = v_task.recipient_assignment_id
    ON CONFLICT (batch_id, recipient_id) DO NOTHING
    RETURNING id INTO v_recipient_assignment_id;

    -- If the conflict path hit, look up the existing row id.
    IF v_recipient_assignment_id IS NULL THEN
      SELECT ar.id INTO v_recipient_assignment_id
        FROM public.assignment_recipients ar
        JOIN public.assignment_recipients src ON src.batch_id = ar.batch_id
       WHERE src.id = v_task.recipient_assignment_id
         AND ar.recipient_id = p_assigned_to;
    END IF;
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
         recurrence_spec = CASE
                             WHEN p_clear_recurrence_spec THEN NULL
                             WHEN p_recurrence_spec IS NOT NULL THEN p_recurrence_spec
                             ELSE recurrence_spec
                           END,
         is_required = CASE
                         WHEN p_is_required IS NOT NULL THEN p_is_required
                         ELSE is_required
                       END,
         assigned_to = CASE
                         WHEN p_clear_assigned_to THEN NULL
                         WHEN p_assigned_to IS NOT NULL THEN p_assigned_to
                         ELSE assigned_to
                       END,
         recipient_assignment_id = COALESCE(v_recipient_assignment_id, recipient_assignment_id),
         updated_at  = now()
   WHERE id = p_task_id
     AND team_id = v_team
   RETURNING * INTO v_task;

  -- Notify the (current) assignee so they see what's changed. Skip
  -- when the admin IS the assignee, or when this is a studio task.
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
      'Check the details — fields may have changed.',
      ar.batch_id
    FROM public.assignment_recipients ar
    WHERE ar.id = v_task.recipient_assignment_id;
  END IF;

  RETURN to_jsonb(v_task);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_assigned_task(
  uuid, text, text, text, date, boolean, boolean, boolean, text, boolean,
  jsonb, boolean, boolean, uuid, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_assigned_task(
  uuid, text, text, text, date, boolean, boolean, boolean, text, boolean,
  jsonb, boolean, boolean, uuid, boolean
) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_assigned_task(
  uuid, text, text, text, date, boolean, boolean, boolean, text, boolean,
  jsonb, boolean, boolean, uuid, boolean
) TO authenticated;

-- 2. admin_clone_task_to_members — "add people" ─────────────────────
-- Copies the source task to each member id passed in. Returns the
-- count of rows created. Skips members who already have a task with
-- the same title from the same batch (prevents accidental dupes when
-- the admin re-clones).
CREATE OR REPLACE FUNCTION public.admin_clone_task_to_members(
  p_task_id     uuid,
  p_member_ids  uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_team       uuid := public.get_my_team_id();
  v_source     public.assigned_tasks%ROWTYPE;
  v_batch      uuid;
  v_added      int  := 0;
  v_admin_name text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_member_ids IS NULL OR array_length(p_member_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'p_member_ids must not be empty' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_source
    FROM public.assigned_tasks
   WHERE id = p_task_id
     AND team_id = v_team;
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'task not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_source.scope <> 'member' THEN
    RAISE EXCEPTION 'can only clone member-scope tasks' USING ERRCODE = '22023';
  END IF;

  -- Resolve / create the batch this clone group belongs to. If the
  -- source was custom-assigned (has a recipient_assignment_id) reuse
  -- its batch so the group reads as a single assignment in the
  -- audit log; otherwise stand up a fresh batch.
  IF v_source.recipient_assignment_id IS NOT NULL THEN
    SELECT batch_id INTO v_batch
      FROM public.assignment_recipients
     WHERE id = v_source.recipient_assignment_id;
  END IF;

  IF v_batch IS NULL THEN
    INSERT INTO public.task_assignment_batches (
      assignment_type, title, description, assigned_by
    ) VALUES (
      'custom_task',
      COALESCE(v_source.title, 'Untitled task'),
      v_source.description,
      v_caller
    )
    RETURNING id INTO v_batch;
  END IF;

  -- Insert one task per new member (excluding any who already have
  -- a row in this batch with the same title — handles re-clones).
  WITH eligible AS (
    SELECT m AS member_id
      FROM unnest(p_member_ids) AS m
      JOIN public.team_members tm ON tm.id = m AND tm.team_id = v_team
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.assignment_recipients ar
         JOIN public.assigned_tasks t ON t.recipient_assignment_id = ar.id
        WHERE ar.batch_id = v_batch
          AND ar.recipient_id = m
          AND t.title = v_source.title
     )
  ),
  ins_recipients AS (
    INSERT INTO public.assignment_recipients (batch_id, recipient_id)
    SELECT v_batch, member_id FROM eligible
    ON CONFLICT (batch_id, recipient_id) DO NOTHING
    RETURNING id, recipient_id
  ),
  ins_tasks AS (
    INSERT INTO public.assigned_tasks (
      recipient_assignment_id, assigned_to, scope, source_type,
      title, description, category, sort_order,
      is_required, due_date, visible_on_overview, team_id
    )
    SELECT
      ar.id, ar.recipient_id, 'member', 'custom',
      v_source.title, v_source.description, v_source.category,
      v_source.sort_order, v_source.is_required, v_source.due_date,
      v_source.visible_on_overview, v_team
    FROM ins_recipients ar
    RETURNING id, assigned_to
  )
  SELECT count(*) INTO v_added FROM ins_tasks;

  -- Notify each new assignee.
  IF v_added > 0 THEN
    SELECT display_name INTO v_admin_name
      FROM public.team_members WHERE id = v_caller;
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body, batch_id
    )
    SELECT
      ar.recipient_id,
      'task_assigned',
      COALESCE(v_source.title, 'A task'),
      COALESCE(v_admin_name, 'An admin') || ' added you to this task.',
      v_batch
    FROM public.assignment_recipients ar
    JOIN public.assigned_tasks t ON t.recipient_assignment_id = ar.id
   WHERE ar.batch_id = v_batch
     AND ar.recipient_id = ANY (p_member_ids)
     AND t.created_at > now() - INTERVAL '5 seconds';  -- only the just-inserted rows
  END IF;

  RETURN jsonb_build_object('added', v_added);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clone_task_to_members(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_clone_task_to_members(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_clone_task_to_members(uuid, uuid[]) TO authenticated;
