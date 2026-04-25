-- PR #44 fix — Assign Log surfaces studio tasks. Studio rows have
-- no assignee but they're admin-initiated activity worth showing.
-- The widget renders a "Studio pool" label in lieu of an assignee.
--
-- PR #44 fix2 — explicit `jsonb_build_object` projection (was
-- `row_to_jsonb(r)` over a subquery, which fails on some Postgres
-- configurations with "function row_to_jsonb(record) does not
-- exist"). Matches the projection style of every other RPC.

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
    SELECT jsonb_agg(
      jsonb_build_object(
        'kind',          u.kind,
        'ref_id',        u.ref_id,
        'title',         u.title,
        'assignee_id',   u.assignee_id,
        'assignee_name', u.assignee_name,
        'target_date',   u.target_date,
        'created_at',    u.created_at
      )
      ORDER BY u.created_at DESC NULLS LAST
    )
    FROM (
      SELECT
        'task'::text          AS kind,
        t.id                  AS ref_id,
        t.title               AS title,
        t.assigned_to         AS assignee_id,
        assignee.display_name AS assignee_name,
        t.due_date            AS target_date,
        t.created_at          AS created_at
      FROM public.assigned_tasks t
      LEFT JOIN public.team_members assignee ON assignee.id = t.assigned_to
      WHERE t.team_id = v_team
        AND t.scope = 'member'
        AND t.assigned_to IS NOT NULL
      UNION ALL
      SELECT
        'studio'::text, t.id, t.title, NULL::uuid, NULL::text, t.due_date, t.created_at
      FROM public.assigned_tasks t
      WHERE t.team_id = v_team
        AND t.scope = 'studio'
      UNION ALL
      SELECT
        'session'::text, s.id, COALESCE(s.client_name, 'Session'), s.assigned_to,
        eng.display_name, s.session_date, s.created_at
      FROM public.sessions s
      LEFT JOIN public.team_members eng ON eng.id = s.assigned_to
      WHERE s.team_id = v_team
        AND s.assigned_to IS NOT NULL
      ORDER BY 7 DESC NULLS LAST
      LIMIT p_limit
    ) u
  ), '[]'::jsonb);
END;
$fn$;
