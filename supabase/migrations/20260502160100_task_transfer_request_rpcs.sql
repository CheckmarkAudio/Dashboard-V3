-- Member-initiated transfer flow — RPC half.
--
-- Companion to 20260502160000_task_reassign_add_direction.sql which
-- added the `direction` column. This migration:
--
--   1. Adds submit_task_transfer_request(p_task_id, p_target_member_id,
--      p_note) — current owner offers task to a specific teammate.
--      Reason note is REQUIRED per user spec ("nobody loses track of
--      the reason and admin can view the reason later").
--
--   2. Replaces approve_task_reassignment to dispatch the resolution
--      notification + admin notification on direction:
--        TAKE     → notify requester (initiator) "X handed over Y";
--                   no admin notification (peer-to-peer only).
--        TRANSFER → notify current_assignee (initiator) "Z accepted
--                   your transfer of Y"; ALSO notify all team admins
--                   "X transferred Y to Z. Reason: W" so admins are
--                   in the loop without being in the approval path.
--
--   3. Replaces decline_task_reassignment to dispatch the resolution
--      notification on direction:
--        TAKE     → notify requester "X kept Y" (existing).
--        TRANSFER → notify current_assignee "Z declined your transfer
--                   of Y" with optional decline note.
--
-- Auth model: same is_team_admin() override on approve/decline so an
-- admin can resolve a stuck request from either side. Member-side
-- transfer enforces ownership server-side: only the current assignee
-- of a member-scope, not-completed task can submit a transfer for it.

BEGIN;

-- ─── submit_task_transfer_request ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_task_transfer_request(
  p_task_id          uuid,
  p_target_member_id uuid,
  p_note             text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_caller       uuid := auth.uid();
  v_team         uuid := public.get_my_team_id();
  v_task         public.assigned_tasks%ROWTYPE;
  v_target       public.team_members%ROWTYPE;
  v_request      public.task_reassign_requests%ROWTYPE;
  v_caller_name  text;
  v_task_title   text;
  v_clean_note   text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  v_clean_note := NULLIF(trim(COALESCE(p_note, '')), '');
  IF v_clean_note IS NULL THEN
    RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
  END IF;
  IF p_target_member_id = v_caller THEN
    RAISE EXCEPTION 'cannot transfer to yourself' USING ERRCODE = '22023';
  END IF;

  -- Team-scoped lookup so cross-team ids return 'task not found'.
  SELECT * INTO v_task
    FROM public.assigned_tasks
   WHERE id = p_task_id
     AND team_id = v_team;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'task not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_task.scope <> 'member' OR v_task.assigned_to IS NULL THEN
    RAISE EXCEPTION 'transfer only applies to your own member-scope tasks'
      USING ERRCODE = '22023';
  END IF;
  IF v_task.assigned_to <> v_caller THEN
    RAISE EXCEPTION 'can only transfer your own tasks' USING ERRCODE = '42501';
  END IF;
  IF v_task.is_completed THEN
    RAISE EXCEPTION 'cannot transfer a completed task' USING ERRCODE = '22023';
  END IF;

  -- Target must exist on the same team.
  SELECT * INTO v_target
    FROM public.team_members
   WHERE id = p_target_member_id
     AND team_id = v_team;
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'target member not found' USING ERRCODE = 'P0002';
  END IF;

  -- requester_id = future taker (target); current_assignee_id =
  -- caller (loses task on approve). Same column semantic as TAKE
  -- direction for the resolution path; only direction differs.
  INSERT INTO public.task_reassign_requests (
    task_id, requester_id, current_assignee_id, direction, note
  ) VALUES (
    p_task_id, p_target_member_id, v_caller, 'transfer', v_clean_note
  )
  RETURNING * INTO v_request;

  SELECT display_name INTO v_caller_name FROM public.team_members WHERE id = v_caller;
  v_task_title := COALESCE(NULLIF(trim(v_task.title), ''), 'a task');

  -- Notify the target — the body shows the reason inline so they
  -- can decide without opening a separate modal.
  INSERT INTO public.assignment_notifications (
    recipient_id,
    notification_type,
    title,
    body,
    task_reassign_request_id
  ) VALUES (
    p_target_member_id,
    'task_reassign_requested',
    COALESCE(v_caller_name, 'A team member') || ' wants to give you "' || v_task_title || '"',
    'Reason: ' || v_clean_note,
    v_request.id
  );

  RETURN to_jsonb(v_request);
END;
$fn$;

REVOKE ALL ON FUNCTION public.submit_task_transfer_request(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_task_transfer_request(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_task_transfer_request(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.submit_task_transfer_request(uuid, uuid, text) IS
  'Owner offers to transfer one of their own member-scope tasks to a teammate. Reason required. Target accepts via approve_task_reassignment.';

-- ─── approve_task_reassignment — dispatch on direction ─────────────
CREATE OR REPLACE FUNCTION public.approve_task_reassignment(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_caller         uuid := auth.uid();
  v_request        public.task_reassign_requests%ROWTYPE;
  v_task           public.assigned_tasks%ROWTYPE;
  v_team           uuid;
  v_owner_name     text;   -- current_assignee_id display name (initiator on TRANSFER)
  v_taker_name     text;   -- requester_id     display name (initiator on TAKE)
  v_task_title     text;
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
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request already resolved' USING ERRCODE = '22023';
  END IF;

  -- Approver depends on direction:
  --   TAKE     → current_assignee_id approves (or admin)
  --   TRANSFER → requester_id        approves (or admin)
  IF v_request.direction = 'transfer' THEN
    IF v_caller <> v_request.requester_id AND NOT public.is_team_admin() THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF v_caller <> v_request.current_assignee_id AND NOT public.is_team_admin() THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Race-safety from PR #38: if the task's current assignee no
  -- longer matches the request's snapshot, auto-cancel instead of
  -- silently moving an unrelated reassignment forward.
  SELECT * INTO v_task FROM public.assigned_tasks WHERE id = v_request.task_id;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'task not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_task.assigned_to IS DISTINCT FROM v_request.current_assignee_id THEN
    UPDATE public.task_reassign_requests
       SET status = 'cancelled',
           resolved_at = now(),
           resolver_id = v_caller
     WHERE id = p_request_id;
    RAISE EXCEPTION 'task assignee changed since the request was submitted'
      USING ERRCODE = '22023';
  END IF;

  -- Move the task: current_assignee → requester (same for both
  -- directions; the distinction is who fired the original RPC).
  UPDATE public.assigned_tasks
     SET assigned_to = v_request.requester_id,
         updated_at  = now()
   WHERE id = v_request.task_id
   RETURNING * INTO v_task;

  UPDATE public.task_reassign_requests
     SET status      = 'approved',
         resolved_at = now(),
         resolver_id = v_caller
   WHERE id = p_request_id
   RETURNING * INTO v_request;

  SELECT display_name INTO v_owner_name FROM public.team_members WHERE id = v_request.current_assignee_id;
  SELECT display_name INTO v_taker_name FROM public.team_members WHERE id = v_request.requester_id;
  v_task_title := COALESCE(NULLIF(trim(v_task.title), ''), 'Untitled task');

  IF v_request.direction = 'transfer' THEN
    -- Notify the original transferer (current_assignee_id is the
    -- initiator on transfer).
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body, task_reassign_request_id
    ) VALUES (
      v_request.current_assignee_id,
      'task_reassign_approved',
      COALESCE(v_taker_name, 'The teammate') || ' accepted your transfer of "' || v_task_title || '"',
      'It is theirs now.',
      v_request.id
    );

    -- Admin loop-in. Per user spec: admin gets a passive
    -- notification so they're aware of the move; not in the
    -- approval path.
    SELECT team_id INTO v_team FROM public.team_members WHERE id = v_request.current_assignee_id;
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body, task_reassign_request_id
    )
    SELECT tm.id,
           'task_reassign_approved',
           COALESCE(v_owner_name, 'A teammate') || ' transferred "' || v_task_title || '" to ' || COALESCE(v_taker_name, 'a teammate'),
           CASE WHEN v_request.note IS NOT NULL AND length(v_request.note) > 0
                THEN 'Reason: ' || v_request.note
                ELSE 'No reason recorded.'
           END,
           v_request.id
      FROM public.team_members tm
     WHERE tm.role = 'admin'
       AND tm.team_id = v_team
       AND tm.id <> v_request.current_assignee_id
       AND tm.id <> v_request.requester_id;
  ELSE
    -- TAKE direction — preserve PR #38's notification verbatim.
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body, task_reassign_request_id
    ) VALUES (
      v_request.requester_id,
      'task_reassign_approved',
      COALESCE(v_owner_name, 'The assignee') || ' handed over "' || v_task_title || '"',
      'It is yours now — show up in your My Tasks.',
      v_request.id
    );
  END IF;

  RETURN to_jsonb(v_request);
END;
$fn$;

-- ─── decline_task_reassignment — dispatch on direction ─────────────
CREATE OR REPLACE FUNCTION public.decline_task_reassignment(
  p_request_id uuid,
  p_note       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_caller       uuid := auth.uid();
  v_request      public.task_reassign_requests%ROWTYPE;
  v_owner_name   text;
  v_taker_name   text;
  v_task_title   text;
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
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request already resolved' USING ERRCODE = '22023';
  END IF;

  IF v_request.direction = 'transfer' THEN
    IF v_caller <> v_request.requester_id AND NOT public.is_team_admin() THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF v_caller <> v_request.current_assignee_id AND NOT public.is_team_admin() THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.task_reassign_requests
     SET status      = 'declined',
         resolved_at = now(),
         resolver_id = v_caller,
         note        = COALESCE(p_note, note)
   WHERE id = p_request_id
   RETURNING * INTO v_request;

  SELECT display_name INTO v_owner_name FROM public.team_members WHERE id = v_request.current_assignee_id;
  SELECT display_name INTO v_taker_name FROM public.team_members WHERE id = v_request.requester_id;
  SELECT title INTO v_task_title FROM public.assigned_tasks WHERE id = v_request.task_id;
  v_task_title := COALESCE(NULLIF(trim(v_task_title), ''), 'the task');

  IF v_request.direction = 'transfer' THEN
    -- Notify the original transferer that the target declined.
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body, task_reassign_request_id
    ) VALUES (
      v_request.current_assignee_id,
      'task_reassign_declined',
      COALESCE(v_taker_name, 'The teammate') || ' declined your transfer of "' || v_task_title || '"',
      CASE WHEN p_note IS NOT NULL AND length(p_note) > 0
           THEN p_note
           ELSE 'They prefer not to take it on right now.' END,
      v_request.id
    );
  ELSE
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body, task_reassign_request_id
    ) VALUES (
      v_request.requester_id,
      'task_reassign_declined',
      COALESCE(v_owner_name, 'The assignee') || ' kept "' || v_task_title || '"',
      CASE WHEN p_note IS NOT NULL AND length(p_note) > 0
           THEN p_note
           ELSE 'They decided to keep it for now.' END,
      v_request.id
    );
  END IF;

  RETURN to_jsonb(v_request);
END;
$fn$;

COMMIT;
