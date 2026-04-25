-- PR #43 — admin session library + per-session editor.
--
-- Mirrors the admin_edit_tasks RPCs (PR #40). Three functions:
--   admin_list_all_sessions — admin-only; upcoming sessions first,
--     or include past via flag. Joins engineer display_name.
--   admin_update_session — partial update via COALESCE + p_clear_*
--     flags. Fires session_reassigned notification to the NEW
--     engineer when the assignee changes.
--   admin_delete_session — deletes the row; best-effort cancellation
--     notification to the prior engineer before the delete cascades
--     (swallowed on failure so the delete always proceeds).

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
        'created_at',      s.created_at
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

CREATE OR REPLACE FUNCTION public.admin_update_session(
  p_session_id uuid,
  p_client_name text DEFAULT NULL,
  p_session_date date DEFAULT NULL,
  p_start_time time DEFAULT NULL,
  p_end_time time DEFAULT NULL,
  p_session_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_room text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_clear_client_name boolean DEFAULT false,
  p_clear_room boolean DEFAULT false,
  p_clear_notes boolean DEFAULT false,
  p_clear_assigned_to boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller   uuid := auth.uid();
  v_session  public.sessions%ROWTYPE;
  v_old_engineer uuid;
  v_new_engineer uuid;
  v_admin_name text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
  END IF;

  v_old_engineer := v_session.assigned_to;

  UPDATE public.sessions
    SET client_name  = CASE
                         WHEN p_clear_client_name THEN NULL
                         WHEN p_client_name IS NOT NULL THEN p_client_name
                         ELSE client_name
                       END,
        session_date = COALESCE(p_session_date, session_date),
        start_time   = COALESCE(p_start_time,  start_time),
        end_time     = COALESCE(p_end_time,    end_time),
        session_type = COALESCE(NULLIF(p_session_type, ''), session_type),
        status       = COALESCE(NULLIF(p_status, ''),       status),
        room         = CASE
                         WHEN p_clear_room THEN NULL
                         WHEN p_room IS NOT NULL THEN p_room
                         ELSE room
                       END,
        notes        = CASE
                         WHEN p_clear_notes THEN NULL
                         WHEN p_notes IS NOT NULL THEN p_notes
                         ELSE notes
                       END,
        assigned_to  = CASE
                         WHEN p_clear_assigned_to THEN NULL
                         WHEN p_assigned_to IS NOT NULL THEN p_assigned_to
                         ELSE assigned_to
                       END
    WHERE id = p_session_id
    RETURNING * INTO v_session;

  v_new_engineer := v_session.assigned_to;

  IF v_new_engineer IS NOT NULL
     AND v_new_engineer IS DISTINCT FROM v_old_engineer
     AND v_new_engineer <> v_caller THEN
    SELECT display_name INTO v_admin_name FROM public.team_members WHERE id = v_caller;
    INSERT INTO public.assignment_notifications (
      recipient_id,
      notification_type,
      title,
      body,
      session_id
    ) VALUES (
      v_new_engineer,
      'session_reassigned',
      COALESCE(v_admin_name, 'An admin') || ' assigned you a session',
      COALESCE(v_session.client_name, 'Session') || ' on ' ||
        to_char(v_session.session_date, 'Mon DD') || ' at ' ||
        to_char(v_session.start_time, 'HH12:MI AM'),
      v_session.id
    );
  END IF;

  RETURN to_jsonb(v_session);
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

  RETURN jsonb_build_object('deleted_session_id', p_session_id);
END;
$fn$;
