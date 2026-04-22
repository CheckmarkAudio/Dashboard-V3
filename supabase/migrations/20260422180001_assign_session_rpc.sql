-- PR #13 — `assign_session` RPC.
--
-- Depends on 20260422180000 having added 'session_assigned' /
-- 'session_reassigned' to the assignment_notification_type enum
-- in a prior committed migration.
--
-- Atomic: update sessions.assigned_to + insert notification for the
-- new assignee. Admin-only. Idempotent — no-op (and no duplicate
-- notification) when the assignee is unchanged.

CREATE OR REPLACE FUNCTION public.assign_session(
  p_session_id uuid,
  p_assignee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller_id     uuid := auth.uid();
  v_session       public.sessions;
  v_is_reassign   boolean;
  v_notif_type    assignment_notification_type;
  v_notif_title   text;
  v_notif_body    text;
  v_client        text;
  v_when          text;
  v_notif_id      uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  -- Load current session row to detect assign-vs-reassign + build copy.
  SELECT * INTO v_session
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
  END IF;

  v_is_reassign := v_session.assigned_to IS NOT NULL
                   AND v_session.assigned_to <> p_assignee_id;

  -- No-op if the assignee is unchanged.
  IF v_session.assigned_to = p_assignee_id THEN
    RETURN jsonb_build_object(
      'session_id',      v_session.id,
      'assigned_to',     v_session.assigned_to,
      'changed',         false,
      'notification_id', NULL
    );
  END IF;

  UPDATE public.sessions
     SET assigned_to = p_assignee_id
   WHERE id = p_session_id;

  v_client := COALESCE(NULLIF(v_session.client_name, ''), 'studio session');
  v_when   := to_char(v_session.session_date, 'Mon FMDD') ||
              ' · ' ||
              to_char(v_session.start_time, 'HH12:MIam');

  v_notif_type := CASE WHEN v_is_reassign
                    THEN 'session_reassigned'::assignment_notification_type
                    ELSE 'session_assigned'::assignment_notification_type
                  END;

  v_notif_title := CASE WHEN v_is_reassign
                     THEN 'Session reassigned to you'
                     ELSE 'Session assigned to you'
                   END;

  v_notif_body := v_client || ' — ' || v_when ||
                  COALESCE(' · ' || v_session.room, '');

  INSERT INTO public.assignment_notifications (
    batch_id,
    recipient_id,
    notification_type,
    title,
    body,
    is_read,
    session_id,
    created_at
  )
  VALUES (
    NULL,
    p_assignee_id,
    v_notif_type,
    v_notif_title,
    v_notif_body,
    false,
    p_session_id,
    now()
  )
  RETURNING id INTO v_notif_id;

  RETURN jsonb_build_object(
    'session_id',      p_session_id,
    'assigned_to',     p_assignee_id,
    'changed',         true,
    'is_reassign',     v_is_reassign,
    'notification_id', v_notif_id
  );
END;
$fn$;

COMMENT ON FUNCTION public.assign_session(uuid, uuid)
  IS 'Atomically assign a session to a team member + notify them. Admin-only. Idempotent on no-change.';
