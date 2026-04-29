-- PR #50 — Tier 2 / Clock In/Out (Lean 1).
--
-- Persists the existing header "Clock In" button to the DB instead of
-- only local state. Each clock-in opens a row in time_clock_entries;
-- clock-out closes the most recent open row. One open shift per user
-- at a time — clocking in while already on the clock is a no-op (the
-- existing open row is returned).
--
-- Scope (deliberately minimal — payroll-grade tracking + breaks +
-- shift-templates can layer on later if needed):
--   - One table
--   - 4 RPCs: clock_in, clock_out, get_my_open_clock_entry,
--     admin_currently_clocked_in
--   - RLS: user reads own rows, admins read team-wide rows
--
-- Foundation for the "trackable" north-star outcome — admins can see
-- who's on the clock right now, members get visible feedback that
-- their hours are being recorded.

-- ─── Table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.time_clock_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  team_id         uuid NOT NULL REFERENCES public.teams(id)        ON DELETE CASCADE,
  clocked_in_at   timestamptz NOT NULL DEFAULT now(),
  clocked_out_at  timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Sanity: clocked_out_at must come after clocked_in_at when set.
  CONSTRAINT time_clock_entries_out_after_in
    CHECK (clocked_out_at IS NULL OR clocked_out_at >= clocked_in_at)
);

-- Hot-path indexes:
--   - by user (recent shifts)
--   - by team (admin "who's on the clock")
--   - partial index on currently-open shifts (the most-frequent query)
CREATE INDEX IF NOT EXISTS time_clock_entries_user_idx
  ON public.time_clock_entries(user_id, clocked_in_at DESC);
CREATE INDEX IF NOT EXISTS time_clock_entries_team_idx
  ON public.time_clock_entries(team_id, clocked_in_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS time_clock_entries_one_open_per_user
  ON public.time_clock_entries(user_id) WHERE clocked_out_at IS NULL;

-- updated_at trigger (matches the rest of the schema's pattern).
CREATE OR REPLACE FUNCTION public.time_clock_entries_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS time_clock_entries_set_updated_at_trg
  ON public.time_clock_entries;
CREATE TRIGGER time_clock_entries_set_updated_at_trg
  BEFORE UPDATE ON public.time_clock_entries
  FOR EACH ROW EXECUTE FUNCTION public.time_clock_entries_set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.time_clock_entries ENABLE ROW LEVEL SECURITY;

-- Members read their own shifts.
DROP POLICY IF EXISTS "members read own clock entries" ON public.time_clock_entries;
CREATE POLICY "members read own clock entries"
  ON public.time_clock_entries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins read every shift in their team.
DROP POLICY IF EXISTS "admins read team clock entries" ON public.time_clock_entries;
CREATE POLICY "admins read team clock entries"
  ON public.time_clock_entries
  FOR SELECT
  TO authenticated
  USING (public.is_team_admin() AND team_id = public.get_my_team_id());

-- Writes go through SECURITY DEFINER RPCs only; deny direct insert /
-- update / delete to plain authenticated callers.
-- (No INSERT/UPDATE/DELETE policies → access denied by default.)

-- ─── RPCs ────────────────────────────────────────────────────────────

-- Clock in. If the caller already has an open shift, return it
-- unchanged (no double-open). Otherwise create a new row.
CREATE OR REPLACE FUNCTION public.clock_in()
RETURNS public.time_clock_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team_id uuid;
  v_existing public.time_clock_entries;
  v_new public.time_clock_entries;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be signed in'
      USING ERRCODE = '28000';
  END IF;

  SELECT team_id INTO v_team_id
  FROM public.team_members
  WHERE id = v_user_id;
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'No team_members row for caller %', v_user_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotent: if already on the clock, return the existing row.
  SELECT * INTO v_existing
  FROM public.time_clock_entries
  WHERE user_id = v_user_id AND clocked_out_at IS NULL
  ORDER BY clocked_in_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.time_clock_entries (user_id, team_id, clocked_in_at)
  VALUES (v_user_id, v_team_id, now())
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

-- Clock out. Closes the caller's most recent open shift. Optional
-- `p_notes` is stored on the row (e.g. "back from lunch", though
-- we're not modeling breaks formally yet — see PR scope).
CREATE OR REPLACE FUNCTION public.clock_out(p_notes text DEFAULT NULL)
RETURNS public.time_clock_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.time_clock_entries;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be signed in'
      USING ERRCODE = '28000';
  END IF;

  UPDATE public.time_clock_entries
  SET clocked_out_at = now(),
      notes = COALESCE(p_notes, notes)
  WHERE user_id = v_user_id
    AND clocked_out_at IS NULL
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'No open shift to clock out of'
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_row;
END;
$$;

-- Get the caller's currently-open shift (if any). Cheap fast-path
-- the header button polls on mount to render its state correctly.
CREATE OR REPLACE FUNCTION public.get_my_open_clock_entry()
RETURNS public.time_clock_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.time_clock_entries;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be signed in'
      USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_row
  FROM public.time_clock_entries
  WHERE user_id = v_user_id AND clocked_out_at IS NULL
  ORDER BY clocked_in_at DESC
  LIMIT 1;

  -- Returning NULL composite is a clean "no open shift" signal.
  RETURN v_row;
END;
$$;

-- Admin view: list every team member who is currently clocked in.
-- Returns one row per open shift with display_name + clocked_in_at.
-- Used by the "Who's on the clock" Hub widget.
CREATE OR REPLACE FUNCTION public.admin_currently_clocked_in()
RETURNS TABLE (
  user_id        uuid,
  display_name   text,
  email          text,
  clocked_in_at  timestamptz,
  entry_id       uuid
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

  RETURN QUERY
  SELECT
    tm.id            AS user_id,
    tm.display_name  AS display_name,
    tm.email         AS email,
    e.clocked_in_at  AS clocked_in_at,
    e.id             AS entry_id
  FROM public.time_clock_entries e
  JOIN public.team_members tm ON tm.id = e.user_id
  WHERE e.clocked_out_at IS NULL
    AND e.team_id = v_team_id
  ORDER BY e.clocked_in_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clock_in()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_out(text)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_open_clock_entry()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_currently_clocked_in() TO authenticated;
