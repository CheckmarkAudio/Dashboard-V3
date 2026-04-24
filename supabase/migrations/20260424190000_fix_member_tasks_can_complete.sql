-- PR #37 — fix My Tasks checkboxes being uninteractable.
--
-- `get_member_assigned_tasks` was missing `can_complete`, `scope`,
-- `assigned_to`, and `assigned_to_name` from the returned jsonb. The
-- client normalizer defaults `can_complete` to `false` when absent, so
-- every My Tasks row rendered with a disabled checkbox.
--
-- Recreate the function to emit those fields. `can_complete` is true
-- iff the row is assigned to the caller (the function already filters
-- `WHERE t.assigned_to = p_user_id`, and admins calling it for another
-- user should see read-only rows — so can_complete = assigned_to = caller).

CREATE OR REPLACE FUNCTION public.get_member_assigned_tasks(
  p_user_id uuid,
  p_include_completed boolean DEFAULT false,
  p_only_overview boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_caller_id uuid := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_caller_id <> p_user_id AND NOT public.is_team_admin() THEN
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
        -- Caller can complete iff this is their own row. Admins
        -- viewing someone else's queue see read-only checkboxes
        -- (they'd use the Team widget or task detail modal for
        -- admin-level overrides).
        'can_complete',            (t.assigned_to = v_caller_id),
        'batch', jsonb_build_object(
          'id',              b.id,
          'assignment_type', b.assignment_type,
          'title',           b.title,
          'description',     b.description,
          'assigned_by',     b.assigned_by,
          'created_at',      b.created_at
        )
      ) ORDER BY b.created_at DESC, t.sort_order ASC, t.created_at ASC
    )
    FROM assigned_tasks t
    JOIN assignment_recipients ar ON ar.id = t.recipient_assignment_id
    JOIN task_assignment_batches b ON b.id = ar.batch_id
    LEFT JOIN intern_users assignee ON assignee.id = t.assigned_to
    WHERE t.assigned_to = p_user_id
      AND ar.status = 'active'
      AND (p_include_completed OR t.is_completed = false)
      AND (NOT p_only_overview OR t.visible_on_overview = true)
  ), '[]'::jsonb);
END;
$fn$;
