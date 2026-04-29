-- PR #51 — Tier 2 / Clients foundation (Lean 2 prep).
--
-- Stand up the `clients` table + supporting RPCs so booking flows
-- can pick a real client (with email captured) instead of typing
-- a freeform string. Required foundation for the upcoming EmailJS
-- booking-confirmation flow (PR #52) — we can't email a client we
-- haven't captured.
--
-- Scope:
--   - One table (`clients`)
--   - One column added to `sessions` (`client_id` nullable FK)
--   - 5 RPCs: create / update / archive / list / search
--   - RLS: any authenticated team member can READ; admins write via
--     SECURITY DEFINER RPCs only
--
-- Backfill / legacy: existing `sessions` rows keep their freeform
-- `client_name` text. New bookings populate BOTH `client_id` (FK)
-- and `client_name` (for read-path simplicity until we sweep). A
-- future PR will reconcile distinct `client_name` strings into
-- `clients` rows + link the bookings.

-- ─── Table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clients (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name                text NOT NULL,
  email               text,
  phone               text,
  notes               text,
  -- Per-client Google review link, used by the upcoming review-ask
  -- flow (Tier 3). NULL = use the team-wide default link from
  -- settings (also tbd).
  google_review_link  text,
  archived            boolean NOT NULL DEFAULT false,
  created_by          uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Defensive: prevent obviously empty names.
  CONSTRAINT clients_name_not_blank CHECK (length(btrim(name)) > 0)
);

-- Hot-path indexes:
--   - by team (the only filter; clients are team-scoped)
--   - case-insensitive name search (typeahead in the booking modal)
--   - by email so EmailJS reminders can find the right row fast
CREATE INDEX IF NOT EXISTS clients_team_idx
  ON public.clients(team_id, archived, name);
CREATE INDEX IF NOT EXISTS clients_name_lower_idx
  ON public.clients(team_id, lower(name));
CREATE INDEX IF NOT EXISTS clients_email_idx
  ON public.clients(team_id, lower(email))
  WHERE email IS NOT NULL;

-- updated_at trigger.
CREATE OR REPLACE FUNCTION public.clients_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_set_updated_at_trg ON public.clients;
CREATE TRIGGER clients_set_updated_at_trg
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Any authenticated team member can SELECT — engineers and members
-- need to see clients on their bookings, plus the booking modal's
-- typeahead picker is used by everyone who can book a session.
DROP POLICY IF EXISTS "team members read clients" ON public.clients;
CREATE POLICY "team members read clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (team_id = public.get_my_team_id());

-- Writes go through SECURITY DEFINER RPCs only; no INSERT / UPDATE /
-- DELETE policies → access denied by default.

-- ─── sessions.client_id column ───────────────────────────────────────

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessions_client_id_idx
  ON public.sessions(client_id) WHERE client_id IS NOT NULL;

-- ─── RPCs ────────────────────────────────────────────────────────────

-- Create a client. Admin-only — members shouldn't be able to mint
-- new client rows ad-hoc; the booking modal calls this server-side
-- when the admin types a brand-new name.
CREATE OR REPLACE FUNCTION public.create_client(
  p_name               text,
  p_email              text DEFAULT NULL,
  p_phone              text DEFAULT NULL,
  p_notes              text DEFAULT NULL,
  p_google_review_link text DEFAULT NULL
)
RETURNS public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team_id uuid := public.get_my_team_id();
  v_row     public.clients;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be signed in'
      USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Only team admins may add clients'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no team_id'
      USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.clients (
    team_id, name, email, phone, notes, google_review_link, created_by
  )
  VALUES (
    v_team_id,
    btrim(p_name),
    NULLIF(btrim(p_email), ''),
    NULLIF(btrim(p_phone), ''),
    NULLIF(btrim(p_notes), ''),
    NULLIF(btrim(p_google_review_link), ''),
    v_user_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Partial-update a client. Admin-only. Pass NULL on a column to keep
-- it; pass empty string to clear it.
CREATE OR REPLACE FUNCTION public.update_client(
  p_id                 uuid,
  p_name               text DEFAULT NULL,
  p_email              text DEFAULT NULL,
  p_phone              text DEFAULT NULL,
  p_notes              text DEFAULT NULL,
  p_google_review_link text DEFAULT NULL,
  p_archived           boolean DEFAULT NULL
)
RETURNS public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_row     public.clients;
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Only team admins may edit clients'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.clients
  SET name               = COALESCE(NULLIF(btrim(p_name), ''), name),
      email              = CASE WHEN p_email IS NULL THEN email
                                ELSE NULLIF(btrim(p_email), '') END,
      phone              = CASE WHEN p_phone IS NULL THEN phone
                                ELSE NULLIF(btrim(p_phone), '') END,
      notes              = CASE WHEN p_notes IS NULL THEN notes
                                ELSE NULLIF(btrim(p_notes), '') END,
      google_review_link = CASE WHEN p_google_review_link IS NULL THEN google_review_link
                                ELSE NULLIF(btrim(p_google_review_link), '') END,
      archived           = COALESCE(p_archived, archived)
  WHERE id = p_id AND team_id = v_team_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'No client found with id % in caller team', p_id
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_row;
END;
$$;

-- Convenience: archive (soft-delete). Past bookings keep their
-- client_id intact (FK); the row is just hidden from default lists.
CREATE OR REPLACE FUNCTION public.archive_client(p_id uuid)
RETURNS public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN public.update_client(p_id, NULL, NULL, NULL, NULL, NULL, true);
END;
$$;

-- List every client in the caller's team. By default returns active
-- only; admins can pass `p_include_archived := true` to see archived
-- rows too. Sorted by name asc for stable display.
CREATE OR REPLACE FUNCTION public.get_clients(
  p_include_archived boolean DEFAULT false
)
RETURNS SETOF public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be signed in'
      USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.clients
  WHERE team_id = v_team_id
    AND (p_include_archived OR archived = false)
  ORDER BY lower(name) ASC;
END;
$$;

-- Typeahead search. Case-insensitive prefix-or-substring match on
-- name + email. Limit 12 keeps the dropdown render cheap.
CREATE OR REPLACE FUNCTION public.search_clients(p_query text)
RETURNS SETOF public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_q       text  := lower(btrim(COALESCE(p_query, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be signed in'
      USING ERRCODE = '28000';
  END IF;

  -- Empty query → return the most-recently-used 12 (best-effort
  -- "browse" mode for the picker on first focus).
  IF v_q = '' THEN
    RETURN QUERY
    SELECT *
    FROM public.clients
    WHERE team_id = v_team_id AND archived = false
    ORDER BY updated_at DESC
    LIMIT 12;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.clients
  WHERE team_id = v_team_id
    AND archived = false
    AND (lower(name) LIKE v_q || '%'
         OR lower(name) LIKE '%' || v_q || '%'
         OR lower(COALESCE(email, '')) LIKE v_q || '%')
  ORDER BY
    -- Prefix matches first, then substring matches. Within each
    -- bucket, alphabetical by name.
    CASE WHEN lower(name) LIKE v_q || '%' THEN 0 ELSE 1 END,
    lower(name)
  LIMIT 12;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_client(text, text, text, text, text)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_client(uuid, text, text, text, text, text, boolean)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_client(uuid)                                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clients(boolean)                                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_clients(text)                                            TO authenticated;
