-- PR #62 — Tier 2 / Members > Clock Data follow-up to PR #50.
--
-- Backfills the "shift history" admin view that PR #58 reserved a
-- left-rail slot for in TeamManager. PR #50 only shipped the live
-- "currently on the clock" Hub widget; this RPC powers the historical
-- table on /admin/my-team → Clock Data.
--
-- Scope:
--   - One RPC: admin_list_clock_entries(p_member_id?, p_limit?)
--   - Admin-only (is_team_admin) and team-scoped (team_id filter)
--   - Returns: entry_id, member_id, member_name, clocked_in_at,
--     clocked_out_at, duration_minutes, notes
--   - Open shifts have clocked_out_at = NULL and duration_minutes = NULL
--     so the UI can render an "ON SHIFT" pill instead of a duration.

CREATE OR REPLACE FUNCTION public.admin_list_clock_entries(
  p_member_id uuid DEFAULT NULL,
  p_limit     int  DEFAULT 100
)
RETURNS TABLE (
  entry_id          uuid,
  member_id         uuid,
  member_name       text,
  clocked_in_at     timestamptz,
  clocked_out_at    timestamptz,
  duration_minutes  int,
  notes             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_limit   int  := GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Only team admins may read this'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    e.id              AS entry_id,
    tm.id             AS member_id,
    tm.display_name   AS member_name,
    e.clocked_in_at   AS clocked_in_at,
    e.clocked_out_at  AS clocked_out_at,
    CASE
      WHEN e.clocked_out_at IS NULL THEN NULL
      ELSE GREATEST(0, EXTRACT(EPOCH FROM (e.clocked_out_at - e.clocked_in_at))::int / 60)
    END               AS duration_minutes,
    e.notes           AS notes
  FROM public.time_clock_entries e
  JOIN public.team_members tm ON tm.id = e.user_id
  WHERE e.team_id = v_team_id
    AND (p_member_id IS NULL OR e.user_id = p_member_id)
  ORDER BY e.clocked_in_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_clock_entries(uuid, int) TO authenticated;
