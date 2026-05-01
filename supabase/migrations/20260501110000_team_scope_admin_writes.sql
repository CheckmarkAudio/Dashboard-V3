-- Team-scope hardening for three admin write/delete RPCs.
--
-- WHY: Tier 1 RPC audit (2026-05-01) found that admin_delete_session,
-- admin_update_session, and admin_update_assigned_task all key their
-- SELECT-FOR-UPDATE / DELETE / UPDATE statements on the row id alone,
-- with no `team_id` predicate. The is_team_admin() guard correctly
-- rejects non-admin callers, but it does NOT prevent an admin from
-- one team from acting on rows in another team if they know the UUID.
--
-- This is NOT exploitable today — the app is single-tenant and every
-- existing row already belongs to the one team — but it would become
-- a real cross-team write surface the moment multi-tenant lands.
-- Cheap to future-proof now: add `AND team_id = public.get_my_team_id()`
-- to every lookup/write predicate so the function physically cannot
-- touch a row outside the caller's team.
--
-- Behavior change vs. live today:
--   - Single-tenant: ZERO. Every row's team_id already matches the
--     caller's team_id, so the new predicates always evaluate true
--     and the SELECT/UPDATE/DELETE hit exactly the same rows.
--   - Multi-tenant (future): cross-team UUIDs return "session/task
--     not found" instead of silently mutating. Same error code as
--     the existing "doesn't exist" path — no information leak about
--     whether the row exists in another team.
--
-- What this migration does NOT do:
--   - No grant changes (per audit recommendation: do not broad-revoke).
--   - No security_invoker flips.
--   - No signature changes — argument lists, return types, default
--     values all preserved exactly.
--   - No removal of the existing notification side effects.
--
-- Out of scope (deferred until the multi-tenant decision):
--   - admin_recent_approvals OR-scope tightening.
--   - get_clients / search_clients admin-tier requirement (product
--     decision — engineers/marketing may legitimately need read).
--
-- Rollback: re-apply the prior function definitions captured in
-- supabase/migrations/20260425030225_admin_edit_sessions_rpcs.sql
-- (sessions) + 20260424193727_admin_edit_tasks_rpcs.sql (tasks).

BEGIN;

-- ─── admin_delete_session ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_session(
  p_session_id uuid,
  p_cancel_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller     uuid := auth.uid();
  v_team       uuid := public.get_my_team_id();
  v_session    public.sessions%ROWTYPE;
  v_admin_name text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Team-scoped lookup: a cross-team UUID returns NULL → "not found"
  -- instead of leaking that the row exists elsewhere.
  SELECT * INTO v_session
    FROM public.sessions
   WHERE id = p_session_id
     AND team_id = v_team;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
  END IF;

  -- Notification side effect preserved verbatim from the prior
  -- definition. Best-effort; failures swallowed so the delete still
  -- proceeds. The session_id FK on assignment_notifications is
  -- ON DELETE CASCADE so the notification cleans up if the row goes.
  IF v_session.assigned_to IS NOT NULL AND v_session.assigned_to <> v_caller THEN
    BEGIN
      SELECT display_name INTO v_admin_name
        FROM public.team_members WHERE id = v_caller;
      INSERT INTO public.assignment_notifications (
        recipient_id, notification_type, title, body, session_id
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

  -- Team-scoped delete — defense-in-depth against any future code
  -- path that bypasses the SELECT above.
  DELETE FROM public.sessions
   WHERE id = p_session_id
     AND team_id = v_team;

  RETURN jsonb_build_object('deleted_session_id', p_session_id);
END;
$function$;

-- ─── admin_update_session ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_session(
  p_session_id          uuid,
  p_client_name         text                  DEFAULT NULL::text,
  p_session_date        date                  DEFAULT NULL::date,
  p_start_time          time without time zone DEFAULT NULL::time without time zone,
  p_end_time            time without time zone DEFAULT NULL::time without time zone,
  p_session_type        text                  DEFAULT NULL::text,
  p_status              text                  DEFAULT NULL::text,
  p_room                text                  DEFAULT NULL::text,
  p_notes               text                  DEFAULT NULL::text,
  p_assigned_to         uuid                  DEFAULT NULL::uuid,
  p_clear_client_name   boolean               DEFAULT false,
  p_clear_room          boolean               DEFAULT false,
  p_clear_notes         boolean               DEFAULT false,
  p_clear_assigned_to   boolean               DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller       uuid := auth.uid();
  v_team         uuid := public.get_my_team_id();
  v_session      public.sessions%ROWTYPE;
  v_old_engineer uuid;
  v_new_engineer uuid;
  v_admin_name   text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Team-scoped lookup + lock.
  SELECT * INTO v_session
    FROM public.sessions
   WHERE id = p_session_id
     AND team_id = v_team
   FOR UPDATE;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
  END IF;

  v_old_engineer := v_session.assigned_to;

  -- Team-scoped update.
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
     AND team_id = v_team
   RETURNING * INTO v_session;

  v_new_engineer := v_session.assigned_to;

  -- Notification side effect preserved verbatim: notify NEW engineer
  -- when the assignment changed and isn't self-assignment.
  IF v_new_engineer IS NOT NULL
     AND v_new_engineer IS DISTINCT FROM v_old_engineer
     AND v_new_engineer <> v_caller THEN
    SELECT display_name INTO v_admin_name
      FROM public.team_members WHERE id = v_caller;
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body, session_id
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
$function$;

-- ─── admin_update_assigned_task ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_assigned_task(
  p_task_id            uuid,
  p_title              text    DEFAULT NULL::text,
  p_description        text    DEFAULT NULL::text,
  p_category           text    DEFAULT NULL::text,
  p_due_date           date    DEFAULT NULL::date,
  p_clear_due          boolean DEFAULT false,
  p_clear_description  boolean DEFAULT false,
  p_clear_category     boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller     uuid := auth.uid();
  v_team       uuid := public.get_my_team_id();
  v_task       public.assigned_tasks%ROWTYPE;
  v_admin_name text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Team-scoped lookup + lock. assigned_tasks.team_id was added in
  -- migration 20260425054217_assigned_tasks_team_id.sql and is
  -- backfilled on every existing row.
  SELECT * INTO v_task
    FROM public.assigned_tasks
   WHERE id = p_task_id
     AND team_id = v_team
   FOR UPDATE;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'task not found' USING ERRCODE = 'P0002';
  END IF;

  -- Team-scoped update.
  UPDATE public.assigned_tasks
     SET title       = COALESCE(NULLIF(p_title, ''), title),
         description = CASE
                         WHEN p_clear_description THEN NULL
                         WHEN p_description IS NOT NULL THEN p_description
                         ELSE description
                       END,
         category    = CASE
                         WHEN p_clear_category THEN NULL
                         WHEN p_category IS NOT NULL THEN p_category
                         ELSE category
                       END,
         due_date    = CASE
                         WHEN p_clear_due THEN NULL
                         WHEN p_due_date IS NOT NULL THEN p_due_date
                         ELSE due_date
                       END,
         updated_at  = now()
   WHERE id = p_task_id
     AND team_id = v_team
   RETURNING * INTO v_task;

  -- Notify the current assignee (member-scope tasks only).
  -- Studio-scope tasks have no assignee, so we skip the notification.
  IF v_task.scope = 'member'
     AND v_task.assigned_to IS NOT NULL
     AND v_task.assigned_to <> v_caller THEN
    SELECT display_name INTO v_admin_name
      FROM public.team_members WHERE id = v_caller;
    INSERT INTO public.assignment_notifications (
      recipient_id, notification_type, title, body, batch_id
    )
    SELECT
      v_task.assigned_to,
      'task_edited',
      COALESCE(v_admin_name, 'An admin') || ' updated "'
        || COALESCE(v_task.title, 'a task') || '"',
      'Check the details — due date, description, or stage may have changed.',
      ar.batch_id
    FROM public.assignment_recipients ar
    WHERE ar.id = v_task.recipient_assignment_id;
  END IF;

  RETURN to_jsonb(v_task);
END;
$function$;

COMMIT;
