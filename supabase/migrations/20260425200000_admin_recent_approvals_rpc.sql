-- PR #45 — Approval Log widget feed.
--
-- Returns recent resolved task_requests (both approved and declined)
-- for the admin's team, ordered by review recency. Both requester +
-- reviewer team scopes match so resolutions across team members
-- surface to all admins.
--
-- The DB column is `reviewed_at`; the JSON key is `resolved_at` to
-- read more naturally on the client.

CREATE OR REPLACE FUNCTION public.admin_recent_approvals(
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
        'id',             tr.id,
        'status',         tr.status,
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
