-- Phase 1 Step 2B — materialize today's checklists ahead of first login.
--
-- Runs the existing `intern_generate_checklist` RPC for every active
-- team member. Daily checklists materialize every day; weekly
-- checklists only on Monday (the RPC already handles period_date math).
-- Errors for one user do not block others — each is wrapped in its own
-- BEGIN/EXCEPTION block. Results land in public.cron_run_log so admins
-- can verify the cron ran and catch silent failures.
--
-- Timezone note: `now() AT TIME ZONE 'America/Denver'` pins "today" to
-- Albuquerque-local regardless of the cron's UTC scheduling. In winter
-- (MST, UTC-7) the 11:00 UTC schedule fires at 4am local; in summer
-- (MDT, UTC-6) it fires at 5am. Both are before anyone opens the app.

CREATE OR REPLACE FUNCTION public.cron_materialize_checklists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member RECORD;
  v_today date := (now() AT TIME ZONE 'America/Denver')::date;
  v_is_monday boolean := extract(isodow FROM v_today) = 1;
  v_processed int := 0;
  v_failed int := 0;
  v_start timestamptz := clock_timestamp();
  v_notes text := '';
BEGIN
  FOR v_member IN
    SELECT id FROM public.team_members WHERE status = 'active'
  LOOP
    BEGIN
      PERFORM public.intern_generate_checklist(v_member.id, 'daily', v_today);
      IF v_is_monday THEN
        PERFORM public.intern_generate_checklist(v_member.id, 'weekly', v_today);
      END IF;
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_notes := v_notes || format(E'user %s: %s\n', v_member.id, SQLERRM);
    END;
  END LOOP;

  INSERT INTO public.cron_run_log (
    job_name, frequency, users_processed, users_failed, notes, duration_ms
  ) VALUES (
    'materialize-checklists',
    CASE WHEN v_is_monday THEN 'daily+weekly' ELSE 'daily' END,
    v_processed,
    v_failed,
    NULLIF(v_notes, ''),
    extract(milliseconds FROM clock_timestamp() - v_start)::int
  );
END;
$$;

COMMENT ON FUNCTION public.cron_materialize_checklists() IS
  'Called by pg_cron daily at 11:00 UTC (5am MDT / 4am MST). Calls intern_generate_checklist for every active team member, logs result to cron_run_log. Safe to run manually ad-hoc.';
