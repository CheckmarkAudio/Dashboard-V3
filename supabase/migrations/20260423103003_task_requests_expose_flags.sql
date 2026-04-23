-- PR #17 — task-request read RPCs expose the new flags.
--
-- get_pending_task_requests + get_my_task_requests rebuilt to return
-- `is_required` and `recurrence_spec` alongside the existing payload.
-- The admin queue can render priority + recurrence chips inline, and
-- the member strip can mirror the same hints on pending rows.

CREATE OR REPLACE FUNCTION public.get_pending_task_requests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_team_id uuid := public.get_my_team_id();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',              r.id,
        'requester_id',    r.requester_id,
        'requester_name',  u.display_name,
        'title',           r.title,
        'description',     r.description,
        'category',        r.category,
        'due_date',        r.due_date,
        'status',          r.status,
        'is_required',     r.is_required,
        'recurrence_spec', r.recurrence_spec,
        'created_at',      r.created_at
      ) ORDER BY r.created_at DESC
    )
    FROM public.task_requests r
    JOIN public.team_members u ON u.id = r.requester_id
    WHERE r.status = 'pending'
      AND u.team_id = v_team_id
  ), '[]'::jsonb);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_my_task_requests(
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 20; END IF;
  IF p_limit > 200 THEN p_limit := 200; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',               r.id,
        'title',            r.title,
        'description',      r.description,
        'category',         r.category,
        'due_date',         r.due_date,
        'status',           r.status,
        'is_required',      r.is_required,
        'recurrence_spec',  r.recurrence_spec,
        'reviewer_note',    r.reviewer_note,
        'reviewed_at',      r.reviewed_at,
        'approved_task_id', r.approved_task_id,
        'created_at',       r.created_at
      ) ORDER BY r.created_at DESC
    )
    FROM (
      SELECT *
      FROM public.task_requests
      WHERE requester_id = v_caller
      ORDER BY created_at DESC
      LIMIT p_limit
    ) r
  ), '[]'::jsonb);
END;
$fn$;
