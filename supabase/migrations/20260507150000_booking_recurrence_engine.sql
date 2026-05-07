-- Recurring bookings — sister to assigned_tasks recurrence engine
-- (migration 20260507120000). Same template + instances design;
-- bookings spawn weekly / monthly only (daily bookings are not a
-- meaningful business case here — admin-confirmed scope).
--
-- Design recap:
--   • Original session row (with non-null recurrence_spec) = template.
--   • Each spawn = new sessions row, copies content, sets
--     `recurrence_parent_id` to template, recurrence_spec=NULL.
--   • Spawn date = max(session_date in series) + interval.
--   • Cron fires daily at 11:00 UTC; only spawns when the next
--     instance falls within the next 30 days (so admin sees them
--     populating the calendar a month out).

-- 1. Schema additions ───────────────────────────────────────────────
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS recurrence_spec jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_recurrence_spec_check'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_recurrence_spec_check CHECK (
        recurrence_spec IS NULL
        OR (
          jsonb_typeof(recurrence_spec) = 'object'
          AND recurrence_spec ? 'frequency'
          AND recurrence_spec->>'frequency' = ANY (ARRAY['weekly','monthly'])
        )
      );
  END IF;
END $$;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid
    REFERENCES public.sessions(id) ON DELETE SET NULL;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS recurrence_last_spawned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sessions_recurrence_template
  ON public.sessions (recurrence_last_spawned_at)
  WHERE recurrence_spec IS NOT NULL
    AND recurrence_parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_recurrence_parent
  ON public.sessions (recurrence_parent_id, session_date)
  WHERE recurrence_parent_id IS NOT NULL;

-- 2. spawn_recurring_session_instances() ────────────────────────────
-- Spawn condition: the NEXT instance (latest series date + interval)
-- falls within 30 days of today. That gives admins / clients a month
-- of forward visibility on the calendar without spamming the table.
CREATE OR REPLACE FUNCTION public.spawn_recurring_session_instances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_template     RECORD;
  v_freq         text;
  v_interval     int;
  v_latest_date  date;
  v_next_date    date;
  v_today        date := (now() AT TIME ZONE 'America/Denver')::date;
  v_horizon      int  := 30;  -- days
  v_new_id       uuid;
  v_processed    int := 0;
  v_failed       int := 0;
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

      -- The latest occurrence in this series — either a previously
      -- spawned child or the template itself.
      SELECT max(session_date) INTO v_latest_date
        FROM public.sessions
       WHERE id = v_template.id OR recurrence_parent_id = v_template.id;

      v_next_date := CASE v_freq
        WHEN 'weekly'  THEN v_latest_date + (v_interval * INTERVAL '1 week')
        WHEN 'monthly' THEN v_latest_date + (v_interval * INTERVAL '1 month')
        ELSE NULL
      END;

      IF v_next_date IS NULL THEN
        CONTINUE;
      END IF;

      -- Only spawn when the next session is within the visibility
      -- horizon. This keeps the table size sane on long-running
      -- recurring bookings (one row per cycle, generated lazily).
      IF (v_next_date - v_today) > v_horizon THEN
        CONTINUE;
      END IF;

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
        'pending',                     -- always start pending; admin
                                        -- can confirm / reschedule.
        v_template.room,
        v_template.notes,
        v_template.created_by,
        v_template.team_id,
        v_template.assigned_to,
        v_template.client_id,
        'pending',                     -- google sync re-fires per row.
        v_template.id
      )
      RETURNING id INTO v_new_id;

      UPDATE public.sessions
         SET recurrence_last_spawned_at = now()
       WHERE id = v_template.id;

      v_processed := v_processed + 1;
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
$$;

COMMENT ON FUNCTION public.spawn_recurring_session_instances() IS
  'Called by pg_cron daily at 11:00 UTC. Scans sessions for recurring templates whose NEXT instance is within 30 days, inserts that instance with status=pending. Logs to cron_run_log.';

REVOKE ALL ON FUNCTION public.spawn_recurring_session_instances() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.spawn_recurring_session_instances() FROM anon;
GRANT EXECUTE ON FUNCTION public.spawn_recurring_session_instances() TO authenticated;

-- 3. pg_cron schedule ───────────────────────────────────────────────
-- Same 11:00 UTC slot as the task spawner + checklist materializer.
SELECT cron.unschedule('spawn-recurring-sessions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'spawn-recurring-sessions');

SELECT cron.schedule(
  'spawn-recurring-sessions',
  '0 11 * * *',
  $cron$SELECT public.spawn_recurring_session_instances();$cron$
);
