-- Member-side cancel for task_requests (PR follow-up to #97).
--
-- MCP-APPLIED: 2026-05-03 to ncljfjdcyswoeitsooty as
-- migration `task_request_cancel_and_status_cancelled`.
-- ADVISOR-VERIFIED: 0 ERRORS.
--
-- Adds a fourth status `cancelled` so the requester can withdraw a
-- pending request before an admin acts on it. Cancelled rows still
-- appear in the resolution log for an audit trail (admin sees who
-- pulled what + when), but the row immediately disappears from the
-- pending queue + the requester's pending-row badge.
--
-- Scope is task_requests only (kinds: create, edit, delete). The
-- task_reassign_requests table is a sibling for transfers and gets
-- its own cancel flow separately.

-- 1. Extend the status CHECK to admit 'cancelled'.
ALTER TABLE public.task_requests
  DROP CONSTRAINT IF EXISTS task_requests_status_check;

ALTER TABLE public.task_requests
  ADD CONSTRAINT task_requests_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])
  );

-- 2. cancel_my_task_request — caller-only withdrawal of a pending row.
-- Sets reviewer_id + reviewed_at = caller/now so the row appears in
-- the resolution log (admin_recent_approvals) and is distinguishable
-- from a normal admin resolution by status='cancelled'. Notifies all
-- team admins so a pending row vanishing isn't surprising.
CREATE OR REPLACE FUNCTION public.cancel_my_task_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_request      public.task_requests%ROWTYPE;
  v_team         uuid := public.get_my_team_id();
  v_notif_count  integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
    FROM public.task_requests
   WHERE id = p_request_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.requester_id <> v_caller THEN
    RAISE EXCEPTION 'can only cancel your own requests' USING ERRCODE = '42501';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request already %, cannot cancel', v_request.status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.task_requests
     SET status      = 'cancelled',
         reviewer_id = v_caller,
         reviewed_at = now()
   WHERE id = p_request_id;

  -- Notify admins (idempotent: if member never opened the request UI
  -- nothing else changes). Skip the notification if v_team isn't
  -- resolvable — the cancel itself still lands.
  IF v_team IS NOT NULL THEN
    WITH ins AS (
      INSERT INTO public.assignment_notifications (
        recipient_id, notification_type, title, body,
        task_request_id, batch_id, session_id, is_read, created_at
      )
      SELECT tm.id,
             'task_request_cancelled',
             'Request cancelled',
             (SELECT display_name FROM public.team_members WHERE id = v_caller)
               || ' cancelled their '
               || v_request.kind
               || ' request: '
               || COALESCE(NULLIF(trim(v_request.title), ''), 'a task'),
             p_request_id,
             NULL,
             NULL,
             false,
             now()
      FROM public.team_members tm
      WHERE tm.role = 'admin'
        AND tm.team_id = v_team
        AND tm.id <> v_caller
      RETURNING id
    )
    SELECT count(*) INTO v_notif_count FROM ins;
  END IF;

  RETURN jsonb_build_object(
    'request_id', p_request_id,
    'notification_count', v_notif_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_task_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_my_task_request(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_task_request(uuid) TO authenticated;

-- 3. admin_recent_approvals — extend WHERE so cancelled rows surface
-- in the resolution log alongside approved/rejected. The widget is
-- already named "Approval Log" but functions as a general resolution
-- feed; renaming is a future cosmetic change.
CREATE OR REPLACE FUNCTION public.admin_recent_approvals(p_limit integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team uuid := public.get_my_team_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 30; END IF;
  IF p_limit > 200 THEN p_limit := 200; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',             tr.id,
        'status',         tr.status,
        'kind',           tr.kind,
        'title',          tr.title,
        'requester_id',   tr.requester_id,
        'requester_name', requester.display_name,
        'reviewer_note',  tr.reviewer_note,
        'resolved_at',    tr.reviewed_at,
        'created_at',     tr.created_at
      )
      ORDER BY tr.reviewed_at DESC NULLS LAST
    )
    FROM public.task_requests tr
    LEFT JOIN public.team_members requester ON requester.id = tr.requester_id
    LEFT JOIN public.team_members reviewer  ON reviewer.id  = tr.reviewer_id
    WHERE tr.status IN ('approved', 'rejected', 'cancelled')
      AND (
        requester.team_id = v_team
        OR reviewer.team_id = v_team
      )
    LIMIT p_limit
  ), '[]'::jsonb);
END;
$$;
