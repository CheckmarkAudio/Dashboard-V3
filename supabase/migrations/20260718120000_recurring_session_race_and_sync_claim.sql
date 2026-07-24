-- Fix a data-integrity race in recurring booking spawn + close a matching
-- race in the outbound Google Calendar push.
--
-- Root cause (recurring bookings): spawn_recurring_session_instances() is
-- called from two independent places — a daily cron tick AND directly from
-- CreateBookingModal right after a recurring booking is saved (PR #157).
-- Before this migration there was no unique constraint on
-- (recurrence_parent_id, session_date) and no lock, so two overlapping
-- calls could both compute the same "next date" and both insert a session
-- row for it — a duplicate booking, which the outbound Google sync then
-- faithfully pushed as two separate calendar events.
--
-- Root cause (Google push): syncSessionToConnection() reads
-- google_event_id, decides create-vs-update, then writes the new
-- google_event_id back — a read-decide-write window with no claim step.
-- Two near-simultaneous invocations for the same session (e.g. once the
-- push is triggered automatically instead of by a manual button click)
-- could both see google_event_id = null and both create a Google event.

-- 1) Make duplicate recurring instances structurally impossible, not just
--    unlikely. NULL recurrence_parent_id (the template rows themselves)
--    are treated as distinct by a UNIQUE constraint, so templates never
--    collide with each other — only same-series/same-date children do.
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_recurrence_parent_date_unique
  UNIQUE (recurrence_parent_id, session_date);

-- 2) Claim-before-send column for the Google push. A session is "claimed"
--    while google_sync_status = 'syncing'; a stale claim (crashed/timed-out
--    invocation) expires after 2 minutes so it isn't stuck forever.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS google_sync_claimed_at timestamptz;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_google_sync_status_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_google_sync_status_check
  CHECK (google_sync_status IN ('pending', 'syncing', 'synced', 'error'));

-- 3) Harden the spawn function: lock the template row so concurrent calls
--    for the SAME series serialize instead of racing, and add
--    ON CONFLICT DO NOTHING as a defense-in-depth backstop against the
--    new unique constraint (belt + suspenders — the lock should make this
--    branch unreachable in practice, the constraint guarantees it either
--    way).
CREATE OR REPLACE FUNCTION public.spawn_recurring_session_instances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_template     RECORD;
  v_freq         text;
  v_interval     int;
  v_latest_date  date;
  v_next_date    date;
  v_today        date := (now() AT TIME ZONE 'America/Denver')::date;
  v_horizon      int  := 30;
  v_new_id       uuid;
  v_processed    int := 0;
  v_failed       int := 0;
  v_loop_guard   int;
  v_start        timestamptz := clock_timestamp();
  v_notes        text := '';
BEGIN
  FOR v_template IN
    SELECT *
      FROM public.sessions
     WHERE recurrence_spec IS NOT NULL
       AND recurrence_parent_id IS NULL
  LOOP
    BEGIN
      -- Serialize concurrent spawn calls against this SAME template
      -- (cron tick vs. the booking-modal's immediate ad-hoc call) so
      -- they can't both read the same "latest date" and both insert it.
      PERFORM 1 FROM public.sessions WHERE id = v_template.id FOR UPDATE;

      v_freq     := v_template.recurrence_spec->>'frequency';
      v_interval := COALESCE((v_template.recurrence_spec->>'interval')::int, 1);
      IF v_interval < 1 THEN v_interval := 1; END IF;

      -- Loop guard — at horizon=30 days, weekly cadence yields ≤5
      -- spawns; monthly yields 1. Cap the inner loop at 12 to defend
      -- against a malformed spec (e.g. zero interval that slipped past
      -- the COALESCE clamp).
      v_loop_guard := 0;
      LOOP
        v_loop_guard := v_loop_guard + 1;
        IF v_loop_guard > 12 THEN EXIT; END IF;

        SELECT max(session_date) INTO v_latest_date
          FROM public.sessions
         WHERE id = v_template.id OR recurrence_parent_id = v_template.id;

        v_next_date := CASE v_freq
          WHEN 'weekly'  THEN v_latest_date + (v_interval * INTERVAL '1 week')
          WHEN 'monthly' THEN v_latest_date + (v_interval * INTERVAL '1 month')
          ELSE NULL
        END;
        IF v_next_date IS NULL THEN EXIT; END IF;
        IF (v_next_date - v_today) > v_horizon THEN EXIT; END IF;

        v_new_id := NULL;

        INSERT INTO public.sessions (
          project_id, client_name, session_date, start_time, end_time,
          session_type, status, room, notes, created_by, team_id,
          assigned_to, client_id,
          google_sync_status,
          recurrence_parent_id
        ) VALUES (
          v_template.project_id,
          v_template.client_name,
          v_next_date,
          v_template.start_time,
          v_template.end_time,
          v_template.session_type,
          'pending',
          v_template.room,
          v_template.notes,
          v_template.created_by,
          v_template.team_id,
          v_template.assigned_to,
          v_template.client_id,
          'pending',
          v_template.id
        )
        ON CONFLICT (recurrence_parent_id, session_date) DO NOTHING
        RETURNING id INTO v_new_id;

        IF v_new_id IS NOT NULL THEN
          v_processed := v_processed + 1;
        END IF;
      END LOOP;

      -- Stamp the template once after the inner loop, regardless of
      -- how many instances were spawned (or zero).
      UPDATE public.sessions
         SET recurrence_last_spawned_at = now()
       WHERE id = v_template.id;

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_notes := v_notes || format(E'template %s: %s\n', v_template.id, SQLERRM);
    END;
  END LOOP;

  INSERT INTO public.cron_run_log (
    job_name, frequency, users_processed, users_failed, notes, duration_ms
  ) VALUES (
    'spawn-recurring-sessions',
    'daily',
    v_processed,
    v_failed,
    NULLIF(v_notes, ''),
    extract(milliseconds FROM clock_timestamp() - v_start)::int
  );
END;
$function$;
