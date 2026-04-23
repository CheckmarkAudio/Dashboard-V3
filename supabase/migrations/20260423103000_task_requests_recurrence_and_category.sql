-- PR #17 — Rich task-request modal foundations.
--
--   1. `task_requests.recurrence_spec` jsonb NULL — stub storage for
--      the recurring-frequency choice. UI lets users pick a cadence
--      but the cron engine is Phase 2 work; persisting the choice now
--      means saved requests auto-activate when the engine ships.
--      Shape (future-proofed for a gcal-style RRULE):
--        { frequency: 'daily'|'weekly'|'monthly'|'custom',
--          interval: 1,
--          byDay?: ['mon','tue',...],
--          until?: 'YYYY-MM-DD',
--          count?: integer }
--      A null value = one-shot task (default).
--
--   2. `approve_task_request(p_request_id, p_category)` — the RPC
--      gains a flywheel-stage parameter so admins can tag the
--      approved task during review. Flows into the new
--      `assigned_tasks.category`. `p_category` defaults to NULL
--      which preserves the existing call site's behavior (request's
--      own category used).

ALTER TABLE public.task_requests
  ADD COLUMN IF NOT EXISTS recurrence_spec jsonb NULL;

COMMENT ON COLUMN public.task_requests.recurrence_spec IS
  'Stub for recurring-task cadence; engine lands in a later PR. See migration comment for shape.';

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

  -- Admin override wins; fall back to the requester's category; then NULL.
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
    false, v_request.due_date, true
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
