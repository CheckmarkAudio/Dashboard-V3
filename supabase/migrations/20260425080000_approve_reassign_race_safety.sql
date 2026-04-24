-- PR #39 — race safety for the approve-reassignment path.
--
-- Between a peer firing `request_task_reassignment` and the current
-- assignee clicking Approve, the task's `assigned_to` could change
-- (admin edit, another peer's approved reassignment, etc). The
-- previous version blindly overwrote `assigned_to` with the
-- requester's id. Now we refuse to approve if the task's current
-- assignee no longer matches the request's snapshot — and auto-
-- cancel the stale request so it doesn't linger in the UI.

CREATE OR REPLACE FUNCTION public.approve_task_reassignment(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller        uuid := auth.uid();
  v_request       public.task_reassign_requests%ROWTYPE;
  v_task          public.assigned_tasks%ROWTYPE;
  v_current_owner uuid;
  v_assignee_name text;
  v_task_title    text;
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

  SELECT assigned_to INTO v_current_owner
    FROM public.assigned_tasks
    WHERE id = v_request.task_id;
  IF v_current_owner IS DISTINCT FROM v_request.current_assignee_id THEN
    UPDATE public.task_reassign_requests
      SET status = 'cancelled',
          resolved_at = now(),
          resolver_id = v_caller,
          note = COALESCE(note, '') || ' [auto-cancelled: task owner changed]'
      WHERE id = p_request_id;
    RAISE EXCEPTION 'task has been reassigned since this request was made' USING ERRCODE = '22023';
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
