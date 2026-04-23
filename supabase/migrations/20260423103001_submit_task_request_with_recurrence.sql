-- PR #17 — submit_task_request gains p_recurrence_spec so the member
-- "+ Task" modal's recurring picker persists the choice. Stub until
-- the cron engine lands; existing callers pass NULL and behavior is
-- unchanged (column defaults NULL).

CREATE OR REPLACE FUNCTION public.submit_task_request(
  p_title       text,
  p_description text DEFAULT NULL,
  p_category    text DEFAULT NULL,
  p_due_date    date DEFAULT NULL,
  p_recurrence_spec jsonb DEFAULT NULL
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
    requester_id, title, description, category, due_date, status, recurrence_spec
  )
  VALUES (
    v_caller, trim(p_title), p_description, p_category, p_due_date, 'pending', p_recurrence_spec
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
