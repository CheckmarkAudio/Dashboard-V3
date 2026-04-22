-- PR #16 — Extend get_assignment_notifications to expose task_request_id.
--
-- The payload gained task_request_id so the frontend can branch on
-- which subject the notification references. No shape change to
-- `batch` or `session`; they stay nullable as introduced in PR #13.

CREATE OR REPLACE FUNCTION public.get_assignment_notifications(
  p_user_id uuid,
  p_unread_only boolean DEFAULT false,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_caller_id uuid := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_caller_id <> p_user_id AND NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 20; END IF;
  IF p_limit > 200 THEN p_limit := 200; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',                n.id,
        'batch_id',          n.batch_id,
        'session_id',        n.session_id,
        'task_request_id',   n.task_request_id,
        'notification_type', n.notification_type,
        'title',             n.title,
        'body',              n.body,
        'is_read',           n.is_read,
        'read_at',           n.read_at,
        'created_at',        n.created_at,
        'batch', CASE
          WHEN b.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id',                 b.id,
            'assignment_type',    b.assignment_type,
            'source_template_id', b.source_template_id,
            'assigned_by',        b.assigned_by,
            'created_at',         b.created_at
          )
        END,
        'session', CASE
          WHEN s.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id',           s.id,
            'client_name',  s.client_name,
            'session_date', s.session_date,
            'start_time',   s.start_time,
            'end_time',     s.end_time,
            'room',         s.room,
            'status',       s.status
          )
        END
      ) ORDER BY n.created_at DESC
    )
    FROM (
      SELECT *
      FROM assignment_notifications
      WHERE recipient_id = p_user_id
        AND (NOT p_unread_only OR is_read = false)
      ORDER BY created_at DESC
      LIMIT p_limit
    ) n
    LEFT JOIN task_assignment_batches b ON b.id = n.batch_id
    LEFT JOIN sessions s ON s.id = n.session_id
  ), '[]'::jsonb);
END;
$function$;
