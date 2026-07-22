-- Member Activity & Presence PR1.
--
-- Persists a lightweight heartbeat for each signed-in team member. Presence
-- sessions are opened and extended only through SECURITY DEFINER RPCs; members
-- can read their own history and admins can read history for their team.

-- ─── Table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.member_presence_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  team_id       uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  source        text NOT NULL DEFAULT 'heartbeat',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_presence_sessions_end_after_start
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS member_presence_sessions_member_idx
  ON public.member_presence_sessions(member_id, started_at DESC);
CREATE INDEX IF NOT EXISTS member_presence_sessions_team_idx
  ON public.member_presence_sessions(team_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS member_presence_sessions_one_open_per_member
  ON public.member_presence_sessions(member_id) WHERE ended_at IS NULL;

-- updated_at trigger (matches time_clock_entries).
CREATE OR REPLACE FUNCTION public.member_presence_sessions_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_presence_sessions_set_updated_at_trg
  ON public.member_presence_sessions;
CREATE TRIGGER member_presence_sessions_set_updated_at_trg
  BEFORE UPDATE ON public.member_presence_sessions
  FOR EACH ROW EXECUTE FUNCTION public.member_presence_sessions_set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.member_presence_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own presence sessions"
  ON public.member_presence_sessions;
CREATE POLICY "members read own presence sessions"
  ON public.member_presence_sessions
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

DROP POLICY IF EXISTS "admins read team presence sessions"
  ON public.member_presence_sessions;
CREATE POLICY "admins read team presence sessions"
  ON public.member_presence_sessions
  FOR SELECT
  TO authenticated
  USING (public.is_team_admin() AND team_id = public.get_my_team_id());

-- Authenticated callers may read only the rows allowed by RLS. All writes go
-- through the RPCs below; there are no direct write policies.
GRANT SELECT ON TABLE public.member_presence_sessions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.member_presence_sessions
  FROM authenticated, anon;

-- ─── RPCs ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.presence_ping(p_idle_minutes int DEFAULT 10)
RETURNS public.member_presence_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team_id uuid;
  v_open public.member_presence_sessions;
  v_result public.member_presence_sessions;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be signed in'
      USING ERRCODE = '28000';
  END IF;

  IF p_idle_minutes IS NULL OR p_idle_minutes < 1 THEN
    RAISE EXCEPTION 'p_idle_minutes must be at least 1'
      USING ERRCODE = '22023';
  END IF;

  -- Lock the member row for this short transaction. Concurrent heartbeats for
  -- the same member then serialize before checking/inserting the open session,
  -- preserving the one-open-session partial unique index without races.
  SELECT team_id INTO v_team_id
  FROM public.team_members
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'No team_members row for caller %', v_user_id
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO v_open
  FROM public.member_presence_sessions
  WHERE member_id = v_user_id
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_open.id IS NOT NULL
     AND now() - v_open.last_seen_at > p_idle_minutes * interval '1 minute' THEN
    UPDATE public.member_presence_sessions
    SET ended_at = last_seen_at
    WHERE id = v_open.id;

    INSERT INTO public.member_presence_sessions (member_id, team_id)
    VALUES (v_user_id, v_team_id)
    RETURNING * INTO v_result;

    RETURN v_result;
  END IF;

  IF v_open.id IS NOT NULL THEN
    UPDATE public.member_presence_sessions
    SET last_seen_at = now()
    WHERE id = v_open.id
    RETURNING * INTO v_result;

    RETURN v_result;
  END IF;

  INSERT INTO public.member_presence_sessions (member_id, team_id)
  VALUES (v_user_id, v_team_id)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_close()
RETURNS public.member_presence_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result public.member_presence_sessions;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be signed in'
      USING ERRCODE = '28000';
  END IF;

  UPDATE public.member_presence_sessions
  SET ended_at = now()
  WHERE member_id = v_user_id
    AND ended_at IS NULL
  RETURNING * INTO v_result;

  -- A NULL composite is the no-op-safe result when no session is open.
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.presence_ping(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.presence_close() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.presence_ping(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.presence_close() TO authenticated;
