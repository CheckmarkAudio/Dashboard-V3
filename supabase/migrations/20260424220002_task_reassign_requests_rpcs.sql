-- PR #38 — RPCs for peer-to-peer task reassignment.
--
-- Four SECURITY DEFINER functions:
--   request_task_reassignment(task_id, note?)           — peer asks
--   approve_task_reassignment(request_id)               — assignee approves → task moves
--   decline_task_reassignment(request_id, note?)        — assignee declines
--   get_my_incoming_reassign_requests()                 — assignee fetches pending list

CREATE OR REPLACE FUNCTION public.request_task_reassignment(
  p_task_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller    uuid := auth.uid();
  v_task      public.assigned_tasks%ROWTYPE;
  v_assignee  uuid;
  v_request   public.task_reassign_requests%ROWTYPE;
  v_req_name  text;
  v_task_title text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task FROM public.assigned_tasks WHERE id = p_task_id;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'task not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_task.scope <> 'member' THEN
    RAISE EXCEPTION 'reassign only applies to member-scope tasks' USING ERRCODE = '22023';
  END IF;
  v_assignee := v_task.assigned_to;
  IF v_assignee IS NULL OR v_assignee = v_caller THEN
    RAISE EXCEPTION 'cannot request reassignment of own or unassigned task' USING ERRCODE = '22023';
  END IF;
  IF v_task.is_completed THEN
    RAISE EXCEPTION 'cannot reassign a completed task' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.task_reassign_requests (
    task_id, requester_id, current_assignee_id, note
  ) VALUES (
    p_task_id, v_caller, v_assignee, p_note
  )
  RETURNING * INTO v_request;

  SELECT display_name INTO v_req_name FROM public.team_members WHERE id = v_caller;
  v_task_title := COALESCE(v_task.title, 'Untitled task');

  INSERT INTO public.assignment_notifications (
    recipient_id,
    notification_type,
    title,
    body,
    task_reassign_request_id
  ) VALUES (
    v_assignee,
    'task_reassign_requested',
    COALESCE(v_req_name, 'A team member') || ' wants to take "' || v_task_title || '"',
    CASE WHEN p_note IS NOT NULL AND length(p_note) > 0
         THEN p_note
         ELSE 'Approve to reassign or decline to keep it.'
    END,
    v_request.id
  );

  RETURN to_jsonb(v_request);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.approve_task_reassignment(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller   uuid := auth.uid();
  v_request  public.task_reassign_requests%ROWTYPE;
  v_task     public.assigned_tasks%ROWTYPE;
  v_assignee_name text;
  v_task_title text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request FROM public.task_reassign_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request already resolved' USING ERRCODE = '22023';
  END IF;
  IF v_caller <> v_request.current_assignee_id AND NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.assigned_tasks
    SET assigned_to = v_request.requester_id,
        updated_at  = now()
    WHERE id = v_request.task_id
    RETURNING * INTO v_task;

  UPDATE public.task_reassign_requests
    SET status      = 'approved',
        resolved_at = now(),
        resolver_id = v_caller
    WHERE id = p_request_id
    RETURNING * INTO v_request;

  SELECT display_name INTO v_assignee_name FROM public.team_members WHERE id = v_request.current_assignee_id;
  v_task_title := COALESCE(v_task.title, 'Untitled task');

  INSERT INTO public.assignment_notifications (
    recipient_id,
    notification_type,
    title,
    body,
    task_reassign_request_id
  ) VALUES (
    v_request.requester_id,
    'task_reassign_approved',
    COALESCE(v_assignee_name, 'The assignee') || ' handed over "' || v_task_title || '"',
    'It is yours now — show up in your My Tasks.',
    v_request.id
  );

  RETURN to_jsonb(v_request);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.decline_task_reassignment(
  p_request_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller   uuid := auth.uid();
  v_request  public.task_reassign_requests%ROWTYPE;
  v_task_title text;
  v_assignee_name text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request FROM public.task_reassign_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request already resolved' USING ERRCODE = '22023';
  END IF;
  IF v_caller <> v_request.current_assignee_id AND NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.task_reassign_requests
    SET status      = 'declined',
        resolved_at = now(),
        resolver_id = v_caller,
        note        = COALESCE(p_note, note)
    WHERE id = p_request_id
    RETURNING * INTO v_request;

  SELECT display_name INTO v_assignee_name FROM public.team_members WHERE id = v_request.current_assignee_id;
  SELECT title INTO v_task_title FROM public.assigned_tasks WHERE id = v_request.task_id;

  INSERT INTO public.assignment_notifications (
    recipient_id,
    notification_type,
    title,
    body,
    task_reassign_request_id
  ) VALUES (
    v_request.requester_id,
    'task_reassign_declined',
    COALESCE(v_assignee_name, 'The assignee') || ' kept "' || COALESCE(v_task_title, 'the task') || '"',
    CASE WHEN p_note IS NOT NULL AND length(p_note) > 0
         THEN p_note
         ELSE 'They decided to keep it for now.'
    END,
    v_request.id
  );

  RETURN to_jsonb(v_request);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_my_incoming_reassign_requests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',                r.id,
        'task_id',           r.task_id,
        'task_title',        t.title,
        'requester_id',      r.requester_id,
        'requester_name',    requester.display_name,
        'note',              r.note,
        'status',            r.status,
        'created_at',        r.created_at
      ) ORDER BY r.created_at DESC
    )
    FROM public.task_reassign_requests r
    JOIN public.assigned_tasks t ON t.id = r.task_id
    LEFT JOIN public.team_members requester ON requester.id = r.requester_id
    WHERE r.current_assignee_id = v_caller
      AND r.status = 'pending'
  ), '[]'::jsonb);
END;
$fn$;
