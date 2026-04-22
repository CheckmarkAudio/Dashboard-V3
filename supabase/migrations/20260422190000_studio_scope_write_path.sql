-- PR #14 — Studio scope write-path + scope-aware completion guard.
--
-- Depends on:
--   20260422180053 (assigned_task_scope_foundation) — adds `scope`
--   and relaxes `assigned_to` NOT NULL. This migration builds on that
--   by (1) relaxing recipient_assignment_id NOT NULL (studio tasks
--   have no recipient row), (2) threading `p_scope` through
--   assign_custom_task_to_members, and (3) teaching
--   complete_assigned_task the new rules.

BEGIN;

-- ─── 1. Allow recipient_assignment_id to be NULL ───────────────────
-- Studio tasks don't belong to a per-member recipient row. The batch
-- still exists (admin can audit + cancel), but the task stands alone
-- without a recipient.
ALTER TABLE public.assigned_tasks
  ALTER COLUMN recipient_assignment_id DROP NOT NULL;

-- ─── 2. Rewrite assign_custom_task_to_members to accept p_scope ────
-- Backwards-compat: p_scope defaults to 'member', so existing callers
-- (adminHubWidgets, QuickAssignWidget pre-update) keep working.
--
-- scope='member': original behavior — batch + per-member recipient
--   rows + per-member task rows + per-member notifications.
--
-- scope='studio': single-row task with no recipient, no assignee, no
--   notifications. Batch is still created so admin can cancel later
--   via the existing cancel_assignment_batch flow. p_member_ids is
--   ignored (no assignees).

CREATE OR REPLACE FUNCTION public.assign_custom_task_to_members(
  p_member_ids       uuid[],
  p_title            text,
  p_description      text    DEFAULT NULL,
  p_category         text    DEFAULT NULL,
  p_due_date         date    DEFAULT NULL,
  p_is_required      boolean DEFAULT false,
  p_show_on_overview boolean DEFAULT true,
  p_scope            text    DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_batch_id        uuid;
  v_recipient_count integer := 0;
  v_task_count      integer := 0;
  v_notif_count     integer := 0;
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'p_title must not be empty' USING ERRCODE = '22023';
  END IF;
  IF p_scope NOT IN ('member', 'studio') THEN
    RAISE EXCEPTION 'p_scope must be member or studio (got %)', p_scope
      USING ERRCODE = '22023';
  END IF;
  IF p_scope = 'member' AND (p_member_ids IS NULL OR array_length(p_member_ids, 1) IS NULL) THEN
    RAISE EXCEPTION 'p_member_ids must not be empty for member scope' USING ERRCODE = '22023';
  END IF;

  -- Batch row always created — admin can audit + cancel both scopes.
  INSERT INTO task_assignment_batches (
    assignment_type, title, description, due_date, assigned_by
  )
  VALUES ('custom_task', p_title, p_description, p_due_date, auth.uid())
  RETURNING id INTO v_batch_id;

  IF p_scope = 'studio' THEN
    -- Single task row: no recipient, no assignee, scope='studio'.
    -- The XOR constraint from PR #12 forbids assigned_to IS NOT NULL
    -- for scope='studio'.
    INSERT INTO assigned_tasks (
      recipient_assignment_id, assigned_to, scope, source_type,
      title, description, category, sort_order,
      is_required, due_date, visible_on_overview
    )
    VALUES (
      NULL, NULL, 'studio', 'custom',
      p_title, p_description, p_category, 0,
      p_is_required, p_due_date, p_show_on_overview
    );
    v_task_count := 1;
    -- No notifications for studio — the team sees the row land in
    -- their Studio Tasks widget on next refresh.
  ELSE
    -- Member scope — original behavior.
    WITH ins AS (
      INSERT INTO assignment_recipients (batch_id, recipient_id)
      SELECT v_batch_id, DISTINCT_mid
      FROM (SELECT DISTINCT unnest(p_member_ids) AS DISTINCT_mid) s
      ON CONFLICT (batch_id, recipient_id) DO NOTHING
      RETURNING id, recipient_id
    )
    SELECT COUNT(*) INTO v_recipient_count FROM ins;

    WITH ins AS (
      INSERT INTO assigned_tasks (
        recipient_assignment_id, assigned_to, scope, source_type,
        title, description, category, sort_order,
        is_required, due_date, visible_on_overview
      )
      SELECT ar.id, ar.recipient_id, 'member', 'custom',
             p_title, p_description, p_category, 0,
             p_is_required, p_due_date, p_show_on_overview
      FROM assignment_recipients ar
      WHERE ar.batch_id = v_batch_id
      RETURNING id
    )
    SELECT COUNT(*) INTO v_task_count FROM ins;

    WITH ins AS (
      INSERT INTO assignment_notifications (
        batch_id, recipient_id, notification_type, title, body
      )
      SELECT v_batch_id, ar.recipient_id, 'task_assigned',
             p_title,
             COALESCE(p_description, 'New task assigned to you.')
      FROM assignment_recipients ar
      WHERE ar.batch_id = v_batch_id
      RETURNING id
    )
    SELECT COUNT(*) INTO v_notif_count FROM ins;
  END IF;

  RETURN jsonb_build_object(
    'batch_id',           v_batch_id,
    'recipient_count',    v_recipient_count,
    'task_count',         v_task_count,
    'notification_count', v_notif_count,
    'scope',              p_scope
  );
END;
$function$;

-- ─── 3. complete_assigned_task — scope-aware guard ─────────────────
-- member scope: assignee or admin only
-- studio scope: any authenticated team member (single-team app) or admin
-- Both paths now record completed_by so we can audit "who checked this
-- off" — especially useful for studio tasks where many people share
-- the same pool.

CREATE OR REPLACE FUNCTION public.complete_assigned_task(
  p_assigned_task_id uuid,
  p_is_completed     boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_task assigned_tasks%ROWTYPE;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task FROM assigned_tasks WHERE id = p_assigned_task_id;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'task not found: %', p_assigned_task_id USING ERRCODE = 'P0002';
  END IF;

  IF v_task.scope = 'studio' THEN
    -- Studio task: any authenticated user on the team can toggle.
    -- Single-team-per-app model makes this effectively "anyone signed
    -- in." When multi-team arrives we'll add a team-match check here.
    NULL;  -- pass
  ELSE
    -- Member task: only the assignee or an admin.
    IF v_caller <> v_task.assigned_to AND NOT public.is_team_admin() THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE assigned_tasks
  SET is_completed  = p_is_completed,
      completed_at  = CASE WHEN p_is_completed THEN now() ELSE NULL END,
      completed_by  = CASE WHEN p_is_completed THEN v_caller ELSE NULL END,
      updated_at    = now()
  WHERE id = p_assigned_task_id
  RETURNING * INTO v_task;

  RETURN to_jsonb(v_task);
END;
$function$;

COMMIT;
