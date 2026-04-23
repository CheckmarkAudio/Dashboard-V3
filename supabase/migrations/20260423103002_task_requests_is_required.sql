-- PR #17 — task_requests gains is_required; merges the pre-PR-11
-- "High Priority" + "Required" toggles into one concept. Flows into
-- assigned_tasks.is_required at approval time.
--
-- Also rebuilds submit + approve RPCs to thread the flag + reuse the
-- requester's flag in approve.

ALTER TABLE public.task_requests
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.task_requests.is_required IS
  'Merged priority+required flag. Flows into assigned_tasks.is_required on approval.';

CREATE OR REPLACE FUNCTION public.submit_task_request(
  p_title       text,
  p_description text DEFAULT NULL,
  p_category    text DEFAULT NULL,
  p_due_date    date DEFAULT NULL,
  p_recurrence_spec jsonb DEFAULT NULL,
  p_is_required boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller  uuid := auth.uid();
  v_team_id uuid := public.get_my_team_id();
  v_request_id uuid;
  v_notif_count integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'title required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.task_requests (
    requester_id, title, description, category, due_date, status,
    recurrence_spec, is_required
  )
  VALUES (
    v_caller, trim(p_title), p_description, p_category, p_due_date, 'pending',
    p_recurrence_spec, COALESCE(p_is_required, false)
  )
  RETURNING id INTO v_request_id;

  WITH ins AS (
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body,
      task_request_id, batch_id, session_id, is_read, created_at
    )
    SELECT tm.id,
           'task_request_submitted',
           'New task request',
           (SELECT display_name FROM public.team_members WHERE id = v_caller)
             || ' — ' || trim(p_title),
           v_request_id,
           NULL,
           NULL,
           false,
           now()
    FROM public.team_members tm
    WHERE tm.role = 'admin'
      AND tm.team_id = v_team_id
      AND tm.id <> v_caller
    RETURNING id
  )
  SELECT count(*) INTO v_notif_count FROM ins;

  RETURN jsonb_build_object(
    'request_id',         v_request_id,
    'notification_count', v_notif_count
  );
END;
$fn$;

-- approve_task_request rebuilt to consume v_request.is_required so
-- the priority/required flag makes it into assigned_tasks.
CREATE OR REPLACE FUNCTION public.approve_task_request(
  p_request_id uuid,
  p_category   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller   uuid := auth.uid();
  v_request  public.task_requests%ROWTYPE;
  v_batch_id uuid;
  v_recipient_id uuid;
  v_task_id  uuid;
  v_notif_id uuid;
  v_category text;
BEGIN
  IF v_caller IS NULL OR NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
  FROM public.task_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request already %, cannot approve', v_request.status
      USING ERRCODE = '22023';
  END IF;

  v_category := COALESCE(NULLIF(p_category, ''), v_request.category);

  INSERT INTO public.task_assignment_batches (
    assignment_type, title, description, due_date, assigned_by
  )
  VALUES ('custom_task', v_request.title, v_request.description, v_request.due_date, v_caller)
  RETURNING id INTO v_batch_id;

  INSERT INTO public.assignment_recipients (batch_id, recipient_id)
  VALUES (v_batch_id, v_request.requester_id)
  RETURNING id INTO v_recipient_id;

  INSERT INTO public.assigned_tasks (
    recipient_assignment_id, assigned_to, scope, source_type,
    title, description, category, sort_order,
    is_required, due_date, visible_on_overview
  )
  VALUES (
    v_recipient_id, v_request.requester_id, 'member', 'custom',
    v_request.title, v_request.description, v_category, 0,
    v_request.is_required, v_request.due_date, true
  )
  RETURNING id INTO v_task_id;

  UPDATE public.task_requests
  SET status           = 'approved',
      reviewer_id      = v_caller,
      reviewed_at      = now(),
      approved_task_id = v_task_id,
      category         = COALESCE(v_category, category)
  WHERE id = p_request_id;

  INSERT INTO public.assignment_notifications (
    recipient_id, notification_type, title, body,
    task_request_id, batch_id, session_id, is_read, created_at
  )
  VALUES (
    v_request.requester_id,
    'task_request_approved',
    'Your task request was approved',
    v_request.title,
    p_request_id,
    NULL,
    NULL,
    false,
    now()
  )
  RETURNING id INTO v_notif_id;

  RETURN jsonb_build_object(
    'request_id',      p_request_id,
    'task_id',         v_task_id,
    'batch_id',        v_batch_id,
    'category',        v_category,
    'notification_id', v_notif_id
  );
END;
$fn$;
