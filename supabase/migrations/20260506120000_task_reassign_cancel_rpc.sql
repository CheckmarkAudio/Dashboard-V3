-- Requester-side cancel for task_reassign_requests.
--
-- The status enum already admits 'cancelled' (set in the original
-- schema migration 20260424220001_task_reassign_requests_schema.sql),
-- so this is purely an RPC + RLS-permission addition.
--
-- Companion to cancel_my_task_request (PR #97 follow-up). Where that
-- one cancels create/edit/delete requests, this one cancels the
-- peer-to-peer "Request to take this task" + owner-initiated transfer
-- flows. Caller must be the row's `requester_id` and the row must
-- still be `pending`.
--
-- On cancel we DELETE the original `task_reassign_requested`
-- notification we sent to the current assignee — the most useful
-- behavior for the assignee is for the row to silently vanish from
-- their notifications panel, since the request never went anywhere.
-- (Same posture as: "ignore unread email; sender takes it back".)

CREATE OR REPLACE FUNCTION public.cancel_my_task_reassignment(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller   uuid := auth.uid();
  v_request  public.task_reassign_requests%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
    FROM public.task_reassign_requests
   WHERE id = p_request_id
   FOR UPDATE;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.requester_id <> v_caller THEN
    RAISE EXCEPTION 'can only cancel your own requests' USING ERRCODE = '42501';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request already %, cannot cancel', v_request.status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.task_reassign_requests
     SET status      = 'cancelled',
         resolved_at = now(),
         resolver_id = v_caller
   WHERE id = p_request_id
   RETURNING * INTO v_request;

  -- Pull the original "X wants to take Y" notification so the
  -- assignee's notifications panel reflects reality.
  DELETE FROM public.assignment_notifications
   WHERE task_reassign_request_id = p_request_id
     AND notification_type = 'task_reassign_requested';

  RETURN to_jsonb(v_request);
END;
$fn$;

REVOKE ALL ON FUNCTION public.cancel_my_task_reassignment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_my_task_reassignment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_task_reassignment(uuid) TO authenticated;
