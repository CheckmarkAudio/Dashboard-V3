-- Direction-aware reassign-request queries.
--
-- WHY: PR #85 added `direction` ('take' | 'transfer') to
-- task_reassign_requests but `get_my_incoming_reassign_requests`
-- still keys only on `current_assignee_id = caller`, which is the
-- correct decider for TAKE direction but the WRONG party for
-- TRANSFER direction (in transfer the requester is the target /
-- decider; the caller is just the initiator). Result today: a
-- member who initiates a transfer sees their OWN outgoing
-- transfer in their incoming-requests modal, treated as if a peer
-- wanted to take their task. Visual confusion + accidental
-- approve-yourself path.
--
-- Two functions in this migration:
--
--   1. Replace get_my_incoming_reassign_requests so it returns
--      only rows where the CALLER IS THE DECIDER:
--         - direction='take'     → caller = current_assignee
--         - direction='transfer' → caller = requester (target)
--      Adds `direction` + the OTHER PARTY's name to the JSON so
--      the modal can render appropriate copy on each row.
--
--   2. Add get_my_outgoing_pending_reassign_requests for the
--      symmetric case — rows where the CALLER IS THE INITIATOR.
--      Used by MyTasksCard to badge tasks with a pending outgoing
--      transfer ("awaiting <target>'s acceptance").
--
-- No schema changes; functions only.

BEGIN;

-- ─── get_my_incoming_reassign_requests — direction-aware ────────────
CREATE OR REPLACE FUNCTION public.get_my_incoming_reassign_requests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',                 r.id,
        'task_id',            r.task_id,
        'task_title',         t.title,
        'direction',          r.direction,
        -- The "other party" is who initiated the request — for TAKE
        -- it's the requester (peer wanting the task); for TRANSFER
        -- it's the current_assignee (owner offering the task).
        'other_party_id',
          CASE r.direction
            WHEN 'take'     THEN r.requester_id
            WHEN 'transfer' THEN r.current_assignee_id
          END,
        'other_party_name',
          CASE r.direction
            WHEN 'take'     THEN requester.display_name
            WHEN 'transfer' THEN owner.display_name
          END,
        -- Legacy field — preserved for any client still reading it.
        'requester_id',       r.requester_id,
        'requester_name',     requester.display_name,
        'note',               r.note,
        'status',             r.status,
        'created_at',         r.created_at
      ) ORDER BY r.created_at DESC
    )
    FROM public.task_reassign_requests r
    JOIN public.assigned_tasks t ON t.id = r.task_id
    LEFT JOIN public.team_members requester ON requester.id = r.requester_id
    LEFT JOIN public.team_members owner ON owner.id = r.current_assignee_id
    WHERE r.status = 'pending'
      AND (
        (r.direction = 'take'     AND r.current_assignee_id = v_caller) OR
        (r.direction = 'transfer' AND r.requester_id        = v_caller)
      )
  ), '[]'::jsonb);
END;
$fn$;

-- ─── get_my_outgoing_pending_reassign_requests ──────────────────────
CREATE OR REPLACE FUNCTION public.get_my_outgoing_pending_reassign_requests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',                r.id,
        'task_id',           r.task_id,
        'task_title',        t.title,
        'direction',         r.direction,
        -- The "other party" is who must decide.
        'other_party_id',
          CASE r.direction
            WHEN 'take'     THEN r.current_assignee_id
            WHEN 'transfer' THEN r.requester_id
          END,
        'other_party_name',
          CASE r.direction
            WHEN 'take'     THEN owner.display_name
            WHEN 'transfer' THEN requester.display_name
          END,
        'note',              r.note,
        'status',            r.status,
        'created_at',        r.created_at
      ) ORDER BY r.created_at DESC
    )
    FROM public.task_reassign_requests r
    JOIN public.assigned_tasks t ON t.id = r.task_id
    LEFT JOIN public.team_members requester ON requester.id = r.requester_id
    LEFT JOIN public.team_members owner ON owner.id = r.current_assignee_id
    WHERE r.status = 'pending'
      AND (
        (r.direction = 'take'     AND r.requester_id        = v_caller) OR
        (r.direction = 'transfer' AND r.current_assignee_id = v_caller)
      )
  ), '[]'::jsonb);
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_my_outgoing_pending_reassign_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_outgoing_pending_reassign_requests() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_outgoing_pending_reassign_requests() TO authenticated;

COMMENT ON FUNCTION public.get_my_outgoing_pending_reassign_requests() IS
  'Returns the caller''s outgoing pending reassign requests — i.e. requests the caller initiated, awaiting the OTHER party''s decision. Used by MyTasksCard to badge tasks with a pending transfer.';

COMMIT;
