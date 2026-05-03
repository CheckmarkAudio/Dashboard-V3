-- Member-side request-to-edit flow (sibling of submit_task_delete_request).
-- Closes the Delete + Transfer + Edit triad started in PR #82-#85.
--
-- MCP-APPLIED: 2026-05-03 to ncljfjdcyswoeitsooty as
-- migration `task_edit_request_rpcs`. ADVISOR-VERIFIED: 0 ERRORS.
--
-- Adds a `proposed` jsonb column to task_requests so members can propose
-- edits to a target task without admins having to interpret prose. The
-- approve_task_request dispatcher gains an 'edit' branch that applies
-- only the keys present in `proposed` (absent key = unchanged; explicit
-- null/empty string = clear). Allowed keys: title, description, category,
-- due_date — mirrors the admin SingleTaskEditModal surface.

-- 1. Schema: proposed jsonb (only valid + required for kind='edit').
ALTER TABLE public.task_requests
  ADD COLUMN IF NOT EXISTS proposed jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_requests_kind_proposed_check'
      AND conrelid = 'public.task_requests'::regclass
  ) THEN
    ALTER TABLE public.task_requests
      ADD CONSTRAINT task_requests_kind_proposed_check CHECK (
        (kind = 'edit'  AND proposed IS NOT NULL AND jsonb_typeof(proposed) = 'object')
     OR (kind <> 'edit' AND proposed IS NULL)
      );
  END IF;
END $$;

-- 2. submit_task_edit_request — member-only entry point.
CREATE OR REPLACE FUNCTION public.submit_task_edit_request(
  p_task_id uuid,
  p_proposed jsonb,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_team         uuid := public.get_my_team_id();
  v_task         public.assigned_tasks%ROWTYPE;
  v_request_id   uuid;
  v_notif_count  integer := 0;
  v_filtered     jsonb;
  v_allowed_keys text[] := ARRAY['title','description','category','due_date'];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task
    FROM public.assigned_tasks
   WHERE id = p_task_id
     AND team_id = v_team;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'task not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_task.scope <> 'member' OR v_task.assigned_to IS NULL THEN
    RAISE EXCEPTION 'studio tasks require admin direct edit' USING ERRCODE = '22023';
  END IF;
  IF v_task.assigned_to <> v_caller THEN
    RAISE EXCEPTION 'can only request edit for your own tasks' USING ERRCODE = '42501';
  END IF;

  IF p_proposed IS NULL OR jsonb_typeof(p_proposed) <> 'object' THEN
    RAISE EXCEPTION 'proposed must be a json object' USING ERRCODE = '22023';
  END IF;

  -- Filter to known editable keys only — silently drops anything else
  -- so future schema additions on the client don't slip through.
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
    INTO v_filtered
  FROM jsonb_each(p_proposed)
  WHERE key = ANY(v_allowed_keys);

  IF v_filtered = '{}'::jsonb THEN
    RAISE EXCEPTION 'proposed must contain at least one of: title, description, category, due_date'
      USING ERRCODE = '22023';
  END IF;

  IF v_filtered ? 'title' THEN
    IF jsonb_typeof(v_filtered->'title') <> 'string' THEN
      RAISE EXCEPTION 'title must be a string' USING ERRCODE = '22023';
    END IF;
    IF length(trim(v_filtered->>'title')) = 0 THEN
      RAISE EXCEPTION 'title cannot be empty' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_filtered ? 'description' AND jsonb_typeof(v_filtered->'description') NOT IN ('string','null') THEN
    RAISE EXCEPTION 'description must be a string or null' USING ERRCODE = '22023';
  END IF;
  IF v_filtered ? 'category' AND jsonb_typeof(v_filtered->'category') NOT IN ('string','null') THEN
    RAISE EXCEPTION 'category must be a string or null' USING ERRCODE = '22023';
  END IF;
  IF v_filtered ? 'due_date' THEN
    IF jsonb_typeof(v_filtered->'due_date') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'due_date must be a string or null' USING ERRCODE = '22023';
    END IF;
    IF v_filtered->>'due_date' IS NOT NULL AND length(v_filtered->>'due_date') > 0 THEN
      BEGIN
        PERFORM (v_filtered->>'due_date')::date;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'due_date must be a valid YYYY-MM-DD date' USING ERRCODE = '22023';
      END;
    END IF;
  END IF;

  INSERT INTO public.task_requests (
    requester_id, title, description, status, kind, target_task_id, proposed
  )
  VALUES (
    v_caller,
    COALESCE(NULLIF(trim(v_task.title), ''), 'Task'),
    NULLIF(trim(p_reason), ''),
    'pending',
    'edit',
    v_task.id,
    v_filtered
  )
  RETURNING id INTO v_request_id;

  WITH ins AS (
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body,
      task_request_id, batch_id, session_id, is_read, created_at
    )
    SELECT tm.id,
           'task_request_submitted',
           'Edit request',
           (SELECT display_name FROM public.team_members WHERE id = v_caller)
             || ' wants to edit: ' || COALESCE(NULLIF(trim(v_task.title), ''), 'a task'),
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
$$;

REVOKE ALL ON FUNCTION public.submit_task_edit_request(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_task_edit_request(uuid, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_task_edit_request(uuid, jsonb, text) TO authenticated;

-- 3. approve_task_request — extend with 'edit' branch.
CREATE OR REPLACE FUNCTION public.approve_task_request(p_request_id uuid, p_category text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_request       public.task_requests%ROWTYPE;
  v_batch_id      uuid;
  v_recipient_id  uuid;
  v_task_id       uuid;
  v_notif_id      uuid;
  v_category      text;
  v_deleted_count integer;
  v_updated_count integer;
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

  ELSIF v_request.kind = 'edit' THEN
    -- Apply only keys present in proposed; absent = unchanged. Explicit
    -- null/empty string maps to clearing the field (NULL in DB) for
    -- description, category, due_date. Title cannot be cleared (NOT NULL
    -- + length>0 CHECK on assigned_tasks); empty/whitespace title in
    -- proposed falls back to existing title via NULLIF.
    IF v_request.target_task_id IS NULL THEN
      RAISE EXCEPTION 'edit request lost target task' USING ERRCODE = 'P0002';
    END IF;
    IF v_request.proposed IS NULL OR jsonb_typeof(v_request.proposed) <> 'object' THEN
      RAISE EXCEPTION 'edit request missing proposed payload' USING ERRCODE = '22023';
    END IF;

    WITH upd AS (
      UPDATE public.assigned_tasks t
         SET title = CASE
                       WHEN v_request.proposed ? 'title'
                         THEN COALESCE(NULLIF(trim(v_request.proposed->>'title'), ''), t.title)
                         ELSE t.title
                     END,
             description = CASE
                             WHEN v_request.proposed ? 'description'
                               THEN NULLIF(v_request.proposed->>'description', '')
                               ELSE t.description
                           END,
             category = CASE
                          WHEN v_request.proposed ? 'category'
                            THEN NULLIF(v_request.proposed->>'category', '')
                            ELSE t.category
                        END,
             due_date = CASE
                          WHEN v_request.proposed ? 'due_date'
                            THEN NULLIF(v_request.proposed->>'due_date', '')::date
                            ELSE t.due_date
                        END
       WHERE t.id = v_request.target_task_id
       RETURNING t.id
    )
    SELECT count(*) INTO v_updated_count FROM upd;

    IF v_updated_count = 0 THEN
      RAISE EXCEPTION 'target task no longer exists' USING ERRCODE = 'P0002';
    END IF;
    v_task_id := v_request.target_task_id;

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
      WHEN 'edit'   THEN 'Your edit request was approved'
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
    'deleted_count',   v_deleted_count,
    'updated_count',   v_updated_count
  );
END;
$$;

-- 4. get_pending_task_requests — surface proposed + a snapshot of current
-- editable fields so the admin queue can render a Current → Proposed diff
-- without an extra round-trip per row.
CREATE OR REPLACE FUNCTION public.get_pending_task_requests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
        'proposed',       r.proposed,
        'current',        CASE
          WHEN r.kind = 'edit' AND r.target_task_id IS NOT NULL THEN (
            SELECT jsonb_build_object(
              'title',       t.title,
              'description', t.description,
              'category',    t.category,
              'due_date',    t.due_date
            )
            FROM public.assigned_tasks t
            WHERE t.id = r.target_task_id
          )
          ELSE NULL
        END,
        'created_at',     r.created_at
      ) ORDER BY r.created_at DESC
    )
    FROM public.task_requests r
    JOIN public.team_members u ON u.id = r.requester_id
    WHERE r.status = 'pending'
      AND u.team_id = v_team_id
  ), '[]'::jsonb);
END;
$$;

-- 5. get_my_task_requests — surface proposed for the member's own history.
CREATE OR REPLACE FUNCTION public.get_my_task_requests(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
        'proposed',         r.proposed,
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
$$;
