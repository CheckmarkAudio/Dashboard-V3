-- PR #40 — admin-facing Edit Tasks library + per-task editor.
--
-- Two RPCs:
--   admin_list_all_assigned_tasks(p_include_completed) — admin-only
--     list of every live assigned_tasks row across the whole team,
--     with assignee + batch info. Ordered so the most actionable
--     work surfaces first: incomplete rows, sooner due dates,
--     newest batches.
--   admin_update_assigned_task(p_task_id, ...) — partial update via
--     COALESCE. `p_clear_*` flags let callers explicitly null fields
--     (distinguishes "don't change" from "clear"). Fires a
--     `task_edited` notification to the current assignee (skipped
--     for studio-scope tasks since there's no one assignee, and
--     skipped if the admin is editing their own task).

CREATE OR REPLACE FUNCTION public.admin_list_all_assigned_tasks(
  p_include_completed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_team_id uuid := public.get_my_team_id();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
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
        'assigned_to_name',        assignee.display_name,
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
               t.created_at DESC
    )
    FROM public.assigned_tasks t
    JOIN public.assignment_recipients ar ON ar.id = t.recipient_assignment_id
    JOIN public.task_assignment_batches b ON b.id = ar.batch_id
    JOIN public.team_members admin ON admin.id = b.assigned_by
    LEFT JOIN public.team_members assignee ON assignee.id = t.assigned_to
    WHERE ar.status = 'active'
      AND admin.team_id = v_team_id
      AND (p_include_completed OR t.is_completed = false)
  ), '[]'::jsonb);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_update_assigned_task(
  p_task_id uuid,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_clear_due boolean DEFAULT false,
  p_clear_description boolean DEFAULT false,
  p_clear_category boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller    uuid := auth.uid();
  v_task      public.assigned_tasks%ROWTYPE;
  v_admin_name text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task FROM public.assigned_tasks WHERE id = p_task_id FOR UPDATE;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'task not found' USING ERRCODE = 'P0002';
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
        updated_at  = now()
    WHERE id = p_task_id
    RETURNING * INTO v_task;

  IF v_task.scope = 'member' AND v_task.assigned_to IS NOT NULL AND v_task.assigned_to <> v_caller THEN
    SELECT display_name INTO v_admin_name FROM public.team_members WHERE id = v_caller;
    INSERT INTO public.assignment_notifications (
      recipient_id,
      notification_type,
      title,
      body,
      batch_id
    )
    SELECT
      v_task.assigned_to,
      'task_edited',
      COALESCE(v_admin_name, 'An admin') || ' updated "' || COALESCE(v_task.title, 'a task') || '"',
      'Check the details — due date, description, or stage may have changed.',
      ar.batch_id
    FROM public.assignment_recipients ar
    WHERE ar.id = v_task.recipient_assignment_id;
  END IF;

  RETURN to_jsonb(v_task);
END;
$fn$;
