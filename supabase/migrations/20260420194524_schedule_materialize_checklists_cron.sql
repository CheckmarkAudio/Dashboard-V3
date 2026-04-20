-- Phase 1 Step 2B — schedule the materializer via pg_cron.
-- 11:00 UTC daily = 5am MDT (summer) / 4am MST (winter). Both are
-- before any active team member touches the app.
--
-- cron.schedule is idempotent per unique job name, but unschedule
-- first so re-running this migration is safe even if the job already
-- exists (e.g. during dev / rollback flows).

SELECT cron.unschedule('materialize-checklists')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'materialize-checklists');

SELECT cron.schedule(
  'materialize-checklists',
  '0 11 * * *',
  $cron$SELECT public.cron_materialize_checklists();$cron$
);
