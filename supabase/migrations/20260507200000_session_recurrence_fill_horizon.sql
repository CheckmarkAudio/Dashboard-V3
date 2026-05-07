-- Recurring bookings — make the spawn function fill the entire 30-day
-- horizon in one call instead of spawning a single instance per call.
--
-- Bug behavior before: cron runs once daily; each tick spawns at most
-- ONE instance per template. So a fresh weekly recurring booking would
-- only show its first child after tomorrow's cron, with subsequent
-- children dripping out one per day. User navigates to "next week" and
-- the recurring instance doesn't appear → looks broken.
--
-- Fix: inner loop per template that keeps spawning while
-- `next_date - today <= horizon`. Now a single call (cron OR ad-hoc
-- from the booking modal save) immediately materializes every
-- instance within the visibility window.

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
        RETURNING id INTO v_new_id;

        v_processed := v_processed + 1;
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
