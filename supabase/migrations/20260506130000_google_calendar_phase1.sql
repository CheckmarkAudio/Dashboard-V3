-- Phase 1 — Google Calendar outbound sync.
--
-- Adds:
--   - per-team Google Calendar OAuth connection storage
--   - short-lived OAuth state storage for callback verification
--   - session-level Google event tracking + sync diagnostics

CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  team_id uuid PRIMARY KEY,
  google_email text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  encrypted_refresh_token text NOT NULL,
  refresh_token_iv text NOT NULL,
  token_scope text[] NOT NULL DEFAULT '{}'::text[],
  token_type text NOT NULL DEFAULT 'Bearer',
  connected_by uuid REFERENCES public.team_members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_tested_at timestamptz,
  last_sync_error text
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  state text PRIMARY KEY,
  team_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES public.team_members(id),
  redirect_to text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);

ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS google_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_sync_error text;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_google_sync_status_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_google_sync_status_check
  CHECK (google_sync_status IN ('pending', 'synced', 'error'));

CREATE INDEX IF NOT EXISTS sessions_google_event_id_idx
  ON public.sessions (google_event_id)
  WHERE google_event_id IS NOT NULL;
