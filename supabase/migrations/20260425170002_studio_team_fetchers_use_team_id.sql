-- PR #44 fix — fetcher RPCs filter by team_id directly so studio
-- tasks (which have no recipient chain) surface correctly. Member
-- tasks still join the recipient chain via LEFT JOIN to surface
-- batch metadata + the active-status filter where applicable.

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
        'batch', NULL
      )
      ORDER BY t.is_completed ASC,
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
$fn$;

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
        'assigned_to_name',        assignee.display_name,
        'can_complete', (
          t.scope = 'studio'
          OR t.assigned_to = v_caller_id
        ),
        'batch', CASE
          WHEN b.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id',              b.id,
            'assignment_type', b.assignment_type,
            'title',           b.title,
            'description',     b.description,
            'assigned_by',     b.assigned_by,
            'created_at',      b.created_at
          )
        END
      )
      ORDER BY t.is_completed ASC,
               t.due_date NULLS LAST,
               t.sort_order ASC,
               t.created_at DESC
    )
    FROM public.assigned_tasks t
    LEFT JOIN public.assignment_recipients ar ON ar.id = t.recipient_assignment_id
    LEFT JOIN public.task_assignment_batches b ON b.id = ar.batch_id
    LEFT JOIN public.team_members assignee ON assignee.id = t.assigned_to
    WHERE t.team_id = v_team_id
      AND (ar.id IS NULL OR ar.status = 'active')
      AND (p_include_completed OR t.is_completed = false)
  ), '[]'::jsonb);
END;
$fn$;
