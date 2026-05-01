-- PR #61 — Tier 2 / Clock In/Out v2: admin shift log.
--
-- Reuses the table + RLS from
-- `supabase/migrations/20260429000000_time_clock_entries.sql`
-- (PR #50). That migration only exposed two read paths:
--   - `get_my_open_clock_entry()`        — caller's open shift
--   - `admin_currently_clocked_in()`     — every team member who is
--                                          on the clock right now
--
-- The Members > Clock Data admin section needs *historical* shifts —
-- closed and open — across every team member, optionally filtered to
-- one member. Add `admin_list_clock_entries(p_member_id, p_limit)` for
-- that view.
--
-- Returns one row per shift, joined to `team_members` for the
-- display name. `duration_minutes` is null for open shifts (so the UI
-- renders "ON SHIFT" instead of a duration), and computed at query
-- time for closed shifts.

CREATE OR REPLACE FUNCTION public.admin_list_clock_entries(
  p_member_id uuid    DEFAULT NULL,
  p_limit     integer DEFAULT 100
)
RETURNS TABLE (
  entry_id          uuid,
  member_id         uuid,
  member_name       text,
  clocked_in_at     timestamptz,
  clocked_out_at    timestamptz,
  duration_minutes  integer,
  notes             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Only team admins may read this'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 100; END IF;
  IF p_limit > 500 THEN p_limit := 500; END IF;

  RETURN QUERY
  SELECT
    e.id                                                AS entry_id,
    tm.id                                               AS member_id,
    tm.display_name                                     AS member_name,
    e.clocked_in_at                                     AS clocked_in_at,
    e.clocked_out_at                                    AS clocked_out_at,
    CASE
      WHEN e.clocked_out_at IS NULL THEN NULL
      ELSE GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (e.clocked_out_at - e.clocked_in_at)) / 60.0)::integer
      )
    END                                                 AS duration_minutes,
    e.notes                                             AS notes
  FROM public.time_clock_entries e
  JOIN public.team_members tm ON tm.id = e.user_id
  WHERE e.team_id = v_team_id
    AND (p_member_id IS NULL OR e.user_id = p_member_id)
  ORDER BY e.clocked_in_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_clock_entries(uuid, integer)
  TO authenticated;
