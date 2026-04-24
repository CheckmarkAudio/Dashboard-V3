-- PR #37 — tighten Team Tasks permission.
--
-- Previous `can_complete` allowed `is_team_admin()` to override, which
-- meant admins saw every team-member's task as checkable. User feedback:
-- admins should NOT be able to tick off member tasks they don't own.
-- Strict rule: only studio-scope tasks (pool work) or the caller's own
-- rows are checkable.
--
-- The complete_assigned_task RPC still has an admin override at the
-- DB level (defence-in-depth for edge-case overrides), but the UI no
-- longer surfaces the option since can_complete comes back false.

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
        -- Strict rule (was: studio OR own OR admin). Admins no longer
        -- get god-mode in Team Tasks UI. Request-to-take UX (PR #38)
        -- is how peers will claim each other's tasks.
        'can_complete', (
          t.scope = 'studio'
          OR t.assigned_to = v_caller_id
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
