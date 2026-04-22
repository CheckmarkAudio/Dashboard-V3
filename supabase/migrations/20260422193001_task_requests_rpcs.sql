-- PR #16 — RPCs for the task-request + admin-approval flow.
--
-- Depends on 20260422193000 committing the new enum values and the
-- task_requests table. Split into this second migration so the
-- ALTER TYPE commits before these RPCs reference the new values at
-- compile time (safer than function-body-only casts).

-- ─── submit_task_request ──────────────────────────────────────────
-- Any authenticated user can submit. Creates a pending request and
-- notifies every admin so the approval queue stays fresh.

CREATE OR REPLACE FUNCTION public.submit_task_request(
  p_title       text,
  p_description text DEFAULT NULL,
  p_category    text DEFAULT NULL,
  p_due_date    date DEFAULT NULL
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
    requester_id, title, description, category, due_date, status
  )
  VALUES (
    v_caller, trim(p_title), p_description, p_category, p_due_date, 'pending'
  )
  RETURNING id INTO v_request_id;

  -- Notify every admin on the caller's team.
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
      AND tm.id <> v_caller  -- don't notify the requester if they're admin too
    RETURNING id
  )
  SELECT count(*) INTO v_notif_count FROM ins;

  RETURN jsonb_build_object(
    'request_id',         v_request_id,
    'notification_count', v_notif_count
  );
END;
$fn$;

COMMENT ON FUNCTION public.submit_task_request(text, text, text, date)
  IS 'User submits a task request. Creates pending row + notifies admins.';


-- ─── approve_task_request ──────────────────────────────────────────
-- Admin only. Atomic: materializes an assigned_tasks row (via a
-- batch + recipient + task + notification pipeline that mirrors
-- assign_custom_task_to_members' member branch), marks the request
-- approved, and fires an approval notification to the requester.

CREATE OR REPLACE FUNCTION public.approve_task_request(
  p_request_id uuid
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

  -- Materialize the task via the existing batch/recipient/task shape.
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
    v_request.title, v_request.description, v_request.category, 0,
    false, v_request.due_date, true
  )
  RETURNING id INTO v_task_id;

  -- Update the request row.
  UPDATE public.task_requests
  SET status           = 'approved',
      reviewer_id      = v_caller,
      reviewed_at      = now(),
      approved_task_id = v_task_id
  WHERE id = p_request_id;

  -- Notification: subject=task_request (not the batch), so the user
  -- can jump back to their request history if they want.
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
    'notification_id', v_notif_id
  );
END;
$fn$;

COMMENT ON FUNCTION public.approve_task_request(uuid)
  IS 'Admin approves a pending task request — materializes an assigned_tasks row for the requester and notifies them.';


-- ─── reject_task_request ───────────────────────────────────────────
-- Admin only. Marks the request rejected, records optional note,
-- notifies the requester.

CREATE OR REPLACE FUNCTION public.reject_task_request(
  p_request_id uuid,
  p_note       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller   uuid := auth.uid();
  v_request  public.task_requests%ROWTYPE;
  v_notif_id uuid;
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
    RAISE EXCEPTION 'request already %, cannot reject', v_request.status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.task_requests
  SET status        = 'rejected',
      reviewer_id   = v_caller,
      reviewed_at   = now(),
      reviewer_note = p_note
  WHERE id = p_request_id;

  INSERT INTO public.assignment_notifications (
    recipient_id, notification_type, title, body,
    task_request_id, batch_id, session_id, is_read, created_at
  )
  VALUES (
    v_request.requester_id,
    'task_request_rejected',
    'Your task request was declined',
    COALESCE(p_note, v_request.title),
    p_request_id,
    NULL,
    NULL,
    false,
    now()
  )
  RETURNING id INTO v_notif_id;

  RETURN jsonb_build_object(
    'request_id',      p_request_id,
    'notification_id', v_notif_id
  );
END;
$fn$;

COMMENT ON FUNCTION public.reject_task_request(uuid, text)
  IS 'Admin rejects a pending task request with an optional note. Notifies the requester.';


-- ─── get_pending_task_requests (admin queue) ───────────────────────
-- Returns all pending requests for the admin's team with requester
-- display_name embedded so the queue UI can render names without a
-- client-side join.

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
        'id',             r.id,
        'requester_id',   r.requester_id,
        'requester_name', u.display_name,
        'title',          r.title,
        'description',    r.description,
        'category',       r.category,
        'due_date',       r.due_date,
        'status',         r.status,
        'created_at',     r.created_at
      ) ORDER BY r.created_at DESC
    )
    FROM public.task_requests r
    JOIN public.team_members u ON u.id = r.requester_id
    WHERE r.status = 'pending'
      AND u.team_id = v_team_id
  ), '[]'::jsonb);
END;
$fn$;

COMMENT ON FUNCTION public.get_pending_task_requests()
  IS 'Admin view of the pending task-request queue for the caller team.';


-- ─── get_my_task_requests (member history) ─────────────────────────
-- Returns the caller's own requests regardless of status so they can
-- see pending items + recently reviewed ones + the rejection note.

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

COMMENT ON FUNCTION public.get_my_task_requests(integer)
  IS 'Caller-scoped view of their own task requests — pending + resolved.';
