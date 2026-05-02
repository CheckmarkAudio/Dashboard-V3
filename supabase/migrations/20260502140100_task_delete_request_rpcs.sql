-- Member request-to-delete RPC + approve_task_request dispatch on kind.
--
-- Companion to 20260502140000_task_requests_kind_target.sql which
-- added the `kind` + `target_task_id` columns. This migration:
--
--   1. Adds submit_task_delete_request(p_task_id, p_reason?) so any
--      member can request that admin delete one of their own tasks.
--   2. Replaces approve_task_request — the canonical 2-arg shape
--      (p_request_id, p_category) — to dispatch on kind:
--        kind='create' → existing materialize-new-task logic, unchanged
--        kind='delete' → deletes target_task_id, sets status=approved
--        kind='edit'   → RAISE 'unsupported' (lands in next PR)
--      Drops the legacy 1-arg overload to leave one signature for
--      PostgREST to resolve.
--   3. Replaces get_pending_task_requests + get_my_task_requests +
--      admin_recent_approvals to include `kind` + `target_task_id` so
--      the admin queue + log widgets can render kind-specific copy.
--
-- Member auth model: any signed-in member can submit a delete request
-- for a task whose `assigned_to = auth.uid()`. Studio-scope tasks
-- (assigned_to IS NULL, scope='studio') have no single owner — admin
-- direct-delete is the only path; submit_task_delete_request rejects
-- them. Cross-team task ids return 'task not found' (no info leak).
--
-- Reject already kind-agnostic — no changes.

BEGIN;

-- ─── submit_task_delete_request ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_task_delete_request(
  p_task_id uuid,
  p_reason  text DEFAULT NULL
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
  v_request_id   uuid;
  v_notif_count  integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Team-scoped lookup so cross-team ids return 'not found' (no leak).
  -- Studio rows (no single owner) require admin direct-delete; member
  -- can only request delete for tasks they own.
  SELECT * INTO v_task
    FROM public.assigned_tasks
   WHERE id = p_task_id
     AND team_id = v_team;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'task not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_task.scope <> 'member' OR v_task.assigned_to IS NULL THEN
    RAISE EXCEPTION 'studio tasks require admin direct delete' USING ERRCODE = '22023';
  END IF;
  IF v_task.assigned_to <> v_caller THEN
    RAISE EXCEPTION 'can only request delete for your own tasks' USING ERRCODE = '42501';
  END IF;

  -- Snapshot the title so the admin queue still reads naturally
  -- after the target row is deleted (target_task_id CASCADE clears).
  -- p_reason flows into description — admin sees it in the queue card.
  INSERT INTO public.task_requests (
    requester_id, title, description, status, kind, target_task_id
  )
  VALUES (
    v_caller,
    COALESCE(NULLIF(trim(v_task.title), ''), 'Task'),
    NULLIF(trim(p_reason), ''),
    'pending',
    'delete',
    v_task.id
  )
  RETURNING id INTO v_request_id;

  -- Notify every admin on the caller's team (skip self if caller is admin).
  WITH ins AS (
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body,
      task_request_id, batch_id, session_id, is_read, created_at
    )
    SELECT tm.id,
           'task_request_submitted',
           'Delete request',
           (SELECT display_name FROM public.team_members WHERE id = v_caller)
             || ' wants to delete: ' || COALESCE(NULLIF(trim(v_task.title), ''), 'a task'),
           v_request_id,
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

  RETURN jsonb_build_object(
    'request_id', v_request_id,
    'notification_count', v_notif_count
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.submit_task_delete_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_task_delete_request(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_task_delete_request(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.submit_task_delete_request(uuid, text) IS
  'Member submits a request to delete one of their own assigned tasks. Admin approves via approve_task_request which dispatches on kind.';

-- ─── approve_task_request — consolidated 2-arg, kind-dispatching ────
-- Drop the legacy 1-arg overload so PostgREST has only one signature
-- to resolve. The 2-arg version is what the client calls (see
-- src/lib/queries/taskRequests.ts approveTaskRequest); legacy 1-arg
-- predated PR #17's category override.
DROP FUNCTION IF EXISTS public.approve_task_request(uuid);

CREATE OR REPLACE FUNCTION public.approve_task_request(
  p_request_id uuid,
  p_category   text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_caller        uuid := auth.uid();
  v_request       public.task_requests%ROWTYPE;
  v_batch_id      uuid;
  v_recipient_id  uuid;
  v_task_id       uuid;
  v_notif_id      uuid;
  v_category      text;
  v_deleted_count integer;
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

  v_category := COALESCE(NULLIF(p_category, ''), v_request.category);

  IF v_request.kind = 'create' THEN
    -- Existing PR #17 logic — preserved verbatim including category
    -- override + is_required carryover.
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
      v_request.is_required, v_request.due_date, true
    )
    RETURNING id INTO v_task_id;

  ELSIF v_request.kind = 'delete' THEN
    -- Defensive: if target was already deleted (CASCADE clears
    -- target_task_id to NULL), treat as zero-deleted success.
    IF v_request.target_task_id IS NULL THEN
      v_deleted_count := 0;
    ELSE
      WITH del AS (
        DELETE FROM public.assigned_tasks
         WHERE id = v_request.target_task_id
        RETURNING id
      )
      SELECT count(*) INTO v_deleted_count FROM del;
    END IF;
    -- v_task_id stays NULL for delete — there's nothing to "jump to."

  ELSIF v_request.kind = 'edit' THEN
    RAISE EXCEPTION 'edit-request approval not yet supported' USING ERRCODE = '0A000';

  ELSE
    RAISE EXCEPTION 'unknown request kind: %', v_request.kind USING ERRCODE = '22023';
  END IF;

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
    CASE v_request.kind
      WHEN 'create' THEN 'Your task request was approved'
      WHEN 'delete' THEN 'Your delete request was approved'
      ELSE 'Your task request was approved'
    END,
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
    'notification_id', v_notif_id,
    'deleted_count',   v_deleted_count
  );
END;
$fn$;

-- ─── get_pending_task_requests — include kind + target_task_id ──────
CREATE OR REPLACE FUNCTION public.get_pending_task_requests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE v_team_id uuid := public.get_my_team_id();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',             r.id,
        'requester_id',   r.requester_id,
        'requester_name', u.display_name,
        'title',          r.title,
        'description',    r.description,
        'category',       r.category,
        'due_date',       r.due_date,
        'status',         r.status,
        'kind',           r.kind,
        'target_task_id', r.target_task_id,
        'created_at',     r.created_at
      ) ORDER BY r.created_at DESC
    )
    FROM public.task_requests r
    JOIN public.team_members u ON u.id = r.requester_id
    WHERE r.status = 'pending'
      AND u.team_id = v_team_id
  ), '[]'::jsonb);
END;
$fn$;

-- ─── get_my_task_requests — include kind ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_task_requests(
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 20; END IF;
  IF p_limit > 200 THEN p_limit := 200; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',               r.id,
        'title',            r.title,
        'description',      r.description,
        'category',         r.category,
        'due_date',         r.due_date,
        'status',           r.status,
        'kind',             r.kind,
        'target_task_id',   r.target_task_id,
        'reviewer_note',    r.reviewer_note,
        'reviewed_at',      r.reviewed_at,
        'approved_task_id', r.approved_task_id,
        'created_at',       r.created_at
      ) ORDER BY r.created_at DESC
    )
    FROM (
      SELECT *
      FROM public.task_requests
      WHERE requester_id = v_caller
      ORDER BY created_at DESC
      LIMIT p_limit
    ) r
  ), '[]'::jsonb);
END;
$fn$;

-- ─── admin_recent_approvals — include kind ─────────────────────────
CREATE OR REPLACE FUNCTION public.admin_recent_approvals(
  p_limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    WHERE tr.status IN ('approved', 'rejected')
      AND (
        requester.team_id = v_team
        OR reviewer.team_id = v_team
      )
    LIMIT p_limit
  ), '[]'::jsonb);
END;
$fn$;

COMMIT;
