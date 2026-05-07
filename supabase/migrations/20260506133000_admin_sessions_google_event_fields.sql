-- Surface Google Calendar event ids through the admin sessions RPCs so
-- delete and edit flows can clean up synced events after DB mutations.

CREATE OR REPLACE FUNCTION public.admin_list_all_sessions(
  p_include_past boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_team uuid := public.get_my_team_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',              s.id,
        'client_name',     s.client_name,
        'session_date',    s.session_date,
        'start_time',      s.start_time,
        'end_time',        s.end_time,
        'session_type',    s.session_type,
        'status',          s.status,
        'room',            s.room,
        'notes',           s.notes,
        'assigned_to',     s.assigned_to,
        'assigned_to_name', engineer.display_name,
        'created_by',      s.created_by,
        'created_at',      s.created_at,
        'google_event_id', s.google_event_id
      )
      ORDER BY s.session_date ASC, s.start_time ASC
    )
    FROM public.sessions s
    LEFT JOIN public.team_members engineer ON engineer.id = s.assigned_to
    WHERE s.team_id = v_team
      AND (p_include_past OR s.session_date >= CURRENT_DATE)
  ), '[]'::jsonb);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_delete_session(
  p_session_id uuid,
  p_cancel_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller   uuid := auth.uid();
  v_session  public.sessions%ROWTYPE;
  v_admin_name text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.assigned_to IS NOT NULL AND v_session.assigned_to <> v_caller THEN
    BEGIN
      SELECT display_name INTO v_admin_name FROM public.team_members WHERE id = v_caller;
      INSERT INTO public.assignment_notifications (
        recipient_id,
        notification_type,
        title,
        body,
        session_id
      ) VALUES (
        v_session.assigned_to,
        'session_reassigned',
        COALESCE(v_admin_name, 'An admin') || ' cancelled a session',
        COALESCE(NULLIF(p_cancel_note, ''),
          COALESCE(v_session.client_name, 'Session') || ' on ' ||
            to_char(v_session.session_date, 'Mon DD') || ' was cancelled.'),
        v_session.id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  DELETE FROM public.sessions WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'deleted_session_id', p_session_id,
    'deleted_google_event_id', v_session.google_event_id
  );
END;
$fn$;
