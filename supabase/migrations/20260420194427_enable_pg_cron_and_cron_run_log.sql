-- Phase 1 Step 2B — backend-prepared checklist state.
-- Enable pg_cron and stand up an observability log for scheduled runs.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.cron_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  frequency text,
  users_processed int NOT NULL DEFAULT 0,
  users_failed int NOT NULL DEFAULT 0,
  notes text,
  duration_ms int
);

CREATE INDEX IF NOT EXISTS idx_cron_run_log_ran_at
  ON public.cron_run_log (ran_at DESC);

ALTER TABLE public.cron_run_log ENABLE ROW LEVEL SECURITY;

-- Admins can read the log (members have no need to see it).
-- Writes only happen from SECURITY DEFINER functions / cron (bypass RLS).
DROP POLICY IF EXISTS cron_run_log_admin_read ON public.cron_run_log;
CREATE POLICY cron_run_log_admin_read ON public.cron_run_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = auth.uid() AND tm.role = 'admin'
    )
  );

COMMENT ON TABLE public.cron_run_log IS
  'Observability for pg_cron scheduled jobs. Written by SECURITY DEFINER functions; read-only for admins via RLS. Rows retained indefinitely (small volume, ~1 row/day per job).';
