-- PR #44 — Assign Log widget feed.
--
-- Returns interleaved task and session assignment rows for the
-- admin's team. Each row represents one (subject, assignee) pair,
-- so a task batch with N recipients produces N log rows.
--
-- Shape per row:
--   kind            'task' | 'session'
--   ref_id          assigned_tasks.id or sessions.id
--   title           task.title or session.client_name
--   assignee_id     intern_users id
--   assignee_name   intern_users.display_name
--   target_date     due_date (tasks) or session_date (sessions)
--   created_at      assignment time (drives ordering)

CREATE OR REPLACE FUNCTION public.admin_recent_assignments(
  p_limit integer DEFAULT 30
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
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 30; END IF;
  IF p_limit > 200 THEN p_limit := 200; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_jsonb(r))
    FROM (
      SELECT
        kind,
        ref_id,
        title,
        assignee_id,
        assignee_name,
        target_date,
        created_at
      FROM (
        SELECT
          'task'::text                  AS kind,
          t.id                          AS ref_id,
          t.title                       AS title,
          t.assigned_to                 AS assignee_id,
          assignee.display_name         AS assignee_name,
          t.due_date                    AS target_date,
          t.created_at                  AS created_at
        FROM public.assigned_tasks t
        JOIN public.assignment_recipients ar ON ar.id = t.recipient_assignment_id
        JOIN public.task_assignment_batches b ON b.id = ar.batch_id
        JOIN public.team_members admin ON admin.id = b.assigned_by
        LEFT JOIN public.team_members assignee ON assignee.id = t.assigned_to
        WHERE admin.team_id = v_team
          AND ar.status = 'active'
          AND t.scope = 'member'
          AND t.assigned_to IS NOT NULL
        UNION ALL
        SELECT
          'session'::text               AS kind,
          s.id                          AS ref_id,
          COALESCE(s.client_name, 'Session') AS title,
          s.assigned_to                 AS assignee_id,
          eng.display_name              AS assignee_name,
          s.session_date                AS target_date,
          s.created_at                  AS created_at
        FROM public.sessions s
        LEFT JOIN public.team_members eng ON eng.id = s.assigned_to
        WHERE s.team_id = v_team
          AND s.assigned_to IS NOT NULL
      ) u
      ORDER BY u.created_at DESC NULLS LAST
      LIMIT p_limit
    ) r
  ), '[]'::jsonb);
END;
$fn$;
