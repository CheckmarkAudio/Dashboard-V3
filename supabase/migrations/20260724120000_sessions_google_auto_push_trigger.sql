-- Auto-push bookings to Google Calendar the moment they're created or
-- edited, instead of requiring an admin to click "Push pending bookings."
-- This replaces a manual sweep with an event-driven trigger, per the
-- director's stated priority (workspace -> Google matters more than
-- Google -> workspace right now; two-way sync stays deferred).
--
-- Mechanism: a Postgres trigger on `sessions` calls the existing
-- `google-calendar-sync` edge function (via pg_net, async — does not
-- block the booking write) using a shared secret stored in Supabase
-- Vault. The edge function verifies that secret via its own service-role
-- Postgres access before treating the call as a trusted system call
-- (bypassing the normal per-user-JWT auth path, since a database trigger
-- has no "calling user").
--
-- This migration builds on `20260718120000_recurring_session_race_and_
-- sync_claim.sql` (unique constraint on recurring spawns + claim-before-
-- send on the push itself) — both are prerequisites so this automation
-- can't create duplicate bookings or duplicate Google events.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1) Shared secret, generated once and stored only in Vault. Never
--    written to a migration file, an edge function secret, or anywhere
--    else — both sides (the trigger and the edge function) read it
--    fresh from Vault at call time, so nothing sensitive needs to be
--    manually configured or rotated by a human.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'calendar_webhook_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'calendar_webhook_secret',
      'Shared secret verifying sessions-table auto-push trigger calls into google-calendar-sync'
    );
  END IF;
END $$;

-- 2) Service-role-only accessor so the edge function (which talks to
--    Postgres over PostgREST, not raw SQL) can fetch the same secret the
--    trigger uses, to verify an incoming system-call request. Nothing
--    else may execute this — it would defeat the purpose of the secret.
CREATE OR REPLACE FUNCTION public.get_calendar_webhook_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'vault', 'pg_temp'
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'calendar_webhook_secret' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_calendar_webhook_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calendar_webhook_secret() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_webhook_secret() TO service_role;

-- 3) Trigger function. Fires an async POST to google-calendar-sync with
--    action=auto_upsert_session. pg_net requests are queued and sent
--    after the transaction commits, so this never blocks or fails the
--    booking write itself, even if Google or the edge function is slow
--    or briefly down.
CREATE OR REPLACE FUNCTION public.notify_session_google_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'vault', 'pg_temp'
AS $$
DECLARE
  v_secret text;
BEGIN
  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'calendar_webhook_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  -- The Authorization header carries the project's anon (publishable)
  -- key -- not a secret, it already ships in every browser bundle --
  -- solely so Supabase's platform gateway (verify_jwt: true on this
  -- function) accepts the request as a valid signed JWT. It grants no
  -- special privilege by itself; `x-calendar-webhook-secret` below is
  -- what the function actually checks before treating this as trusted.
  PERFORM net.http_post(
    url := 'https://ncljfjdcyswoeitsooty.supabase.co/functions/v1/google-calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbGpmamRjeXN3b2VpdHNvb3R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjE4ODMsImV4cCI6MjA5MTIzNzg4M30.bwQj5llGUCBZiE7cFYUbwu6gOqK6G8cOhzm28sUkoxs',
      'x-calendar-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'action', 'auto_upsert_session',
      'session_id', NEW.id,
      'team_id', NEW.team_id
    ),
    timeout_milliseconds := 8000
  );
  RETURN NEW;
END;
$$;

-- 4) Two triggers rather than one combined INSERT/UPDATE trigger, so
--    there's no ambiguity around OLD not existing on INSERT. Both call
--    the same function.
--
--    Guard clause shared by both: skip firing when this row's own change
--    was just SOURCED FROM Google (calendar_last_changed_source =
--    'google', written by the existing manual inbound-pull path) — an
--    auto-push that immediately re-pushes a change Google just sent us
--    would be wasted work, and could bounce against the claim logic.

CREATE TRIGGER trg_sessions_google_auto_push_insert
AFTER INSERT ON public.sessions
FOR EACH ROW
WHEN (NEW.calendar_last_changed_source IS DISTINCT FROM 'google')
EXECUTE FUNCTION public.notify_session_google_sync();

CREATE TRIGGER trg_sessions_google_auto_push_update
AFTER UPDATE ON public.sessions
FOR EACH ROW
WHEN (
  NEW.calendar_last_changed_source IS DISTINCT FROM 'google'
  AND (
    NEW.client_name IS DISTINCT FROM OLD.client_name OR
    NEW.session_date IS DISTINCT FROM OLD.session_date OR
    NEW.start_time IS DISTINCT FROM OLD.start_time OR
    NEW.end_time IS DISTINCT FROM OLD.end_time OR
    NEW.session_type IS DISTINCT FROM OLD.session_type OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.room IS DISTINCT FROM OLD.room OR
    NEW.notes IS DISTINCT FROM OLD.notes OR
    NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
  )
)
EXECUTE FUNCTION public.notify_session_google_sync();
