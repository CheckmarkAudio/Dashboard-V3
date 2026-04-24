-- PR #33 — fix `column assignee.name does not exist` error on the
-- Tasks page Team Tasks widget.
--
-- `get_team_assigned_tasks` (created in the scope-foundation
-- migration) references `assignee.name`, but `intern_users` has no
-- `name` column — the correct column is `display_name`. Recreate
-- the function with the right column. Only the one line changes;
-- the rest of the function body is identical to the prior version.

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
        'assigned_to_name',        assignee.display_name,  -- was `assignee.name` (nonexistent column)
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
