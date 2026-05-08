-- Phase 2 — inbound Google/Apple edits for already-linked bookings.
--
-- This migration is intentionally additive:
--   - Phase 1 outbound sync remains unchanged
--   - inbound sync state lives on the connection row
--   - session rows gain lightweight audit metadata only

ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS google_sync_token text,
  ADD COLUMN IF NOT EXISTS inbound_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS inbound_last_sync_error text,
  ADD COLUMN IF NOT EXISTS inbound_last_sync_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS calendar_last_changed_source text NOT NULL DEFAULT 'checkmark',
  ADD COLUMN IF NOT EXISTS calendar_last_changed_at timestamptz;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_calendar_last_changed_source_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_calendar_last_changed_source_check
  CHECK (calendar_last_changed_source IN ('checkmark', 'google'));

CREATE INDEX IF NOT EXISTS sessions_calendar_last_changed_idx
  ON public.sessions (calendar_last_changed_at DESC);
