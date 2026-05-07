-- Recurring task engine — daily cron that spawns fresh instances of
-- any assigned_task whose `recurrence_spec` cadence has elapsed since
-- the last spawn (or since creation).
--
-- Design:
--   • The ORIGINAL row (the one created with a non-null recurrence_spec)
--     is the "template". Templates have `recurrence_parent_id IS NULL`.
--   • Each fired instance is a new row that COPIES the template's
--     content + carries `recurrence_parent_id = template.id` and a
--     null recurrence_spec (instances don't recur themselves).
--   • The template tracks `recurrence_last_spawned_at`; the cron uses
--     this + the spec frequency to decide whether it's time to fire.
--   • The template stays editable (admins can change its title /
--     description / cadence) — every future spawn picks up the change.
--
-- Cadence math:
--   • daily   → next_due = last_spawned + (interval days)
--   • weekly  → next_due = last_spawned + (interval weeks)
--   • monthly → next_due = last_spawned + (interval months)
-- If `recurrence_last_spawned_at IS NULL` (never fired), the template
-- spawns immediately on next cron run.
--
-- Cron: 11:00 UTC daily (5am MDT / 4am MST), pinned to the same slot
-- as cron_materialize_checklists so the morning batch lands together.

-- 1. Schema additions ───────────────────────────────────────────────
ALTER TABLE public.assigned_tasks
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid
    REFERENCES public.assigned_tasks(id) ON DELETE SET NULL;

ALTER TABLE public.assigned_tasks
  ADD COLUMN IF NOT EXISTS recurrence_last_spawned_at timestamptz;

-- Partial index so the cron's "find templates due to spawn" scan is
-- fast even on large task tables. Only templates carry recurrence_spec
-- AND have recurrence_parent_id NULL, so this matches exactly the
-- rows the engine considers each tick.
CREATE INDEX IF NOT EXISTS idx_assigned_tasks_recurrence_template
  ON public.assigned_tasks (recurrence_last_spawned_at)
  WHERE recurrence_spec IS NOT NULL
    AND recurrence_parent_id IS NULL;

-- 2. spawn_recurring_task_instances() — main worker ─────────────────
CREATE OR REPLACE FUNCTION public.spawn_recurring_task_instances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_template     RECORD;
  v_freq         text;
  v_interval     int;
  v_baseline     timestamptz;
  v_next_fire_at timestamptz;
  v_now          timestamptz := now();
  v_today        date := (v_now AT TIME ZONE 'America/Denver')::date;
  v_new_id       uuid;
  v_processed    int := 0;
  v_failed       int := 0;
  v_start        timestamptz := clock_timestamp();
  v_notes        text := '';
BEGIN
  -- Iterate every active template — the partial index keeps this cheap.
  FOR v_template IN
    SELECT *
      FROM public.assigned_tasks
     WHERE recurrence_spec IS NOT NULL
       AND recurrence_parent_id IS NULL
  LOOP
    BEGIN
      v_freq     := v_template.recurrence_spec->>'frequency';
      v_interval := COALESCE((v_template.recurrence_spec->>'interval')::int, 1);
      IF v_interval < 1 THEN v_interval := 1; END IF;

      -- "Time elapsed since last fire" — fall back to created_at when
      -- the template has never spawned.
      v_baseline := COALESCE(v_template.recurrence_last_spawned_at, v_template.created_at);

      v_next_fire_at := CASE v_freq
        WHEN 'daily'   THEN v_baseline + (v_interval * INTERVAL '1 day')
        WHEN 'weekly'  THEN v_baseline + (v_interval * INTERVAL '1 week')
        WHEN 'monthly' THEN v_baseline + (v_interval * INTERVAL '1 month')
        ELSE NULL
      END;

      -- Skip if frequency is unknown (defensive — CHECK constraint
      -- already filters daily|weekly|monthly) or it's not yet time.
      IF v_next_fire_at IS NULL THEN
        CONTINUE;
      END IF;
      IF v_now < v_next_fire_at THEN
        CONTINUE;
      END IF;

      -- Spawn — copy every content column the assignment write paths
      -- use, reset completion + recurrence (instances are leaf rows),
      -- set the new due_date to today (matches the "checklist for
      -- today" mental model — admins can override later).
      INSERT INTO public.assigned_tasks (
        recipient_assignment_id, assigned_to, scope, source_type,
        title, description, category, sort_order,
        is_required, due_date, visible_on_overview, team_id,
        studio_space,
        recurrence_parent_id
      ) VALUES (
        v_template.recipient_assignment_id,
        v_template.assigned_to,
        v_template.scope,
        v_template.source_type,
        v_template.title,
        v_template.description,
        v_template.category,
        v_template.sort_order,
        v_template.is_required,
        v_today,
        v_template.visible_on_overview,
        v_template.team_id,
        v_template.studio_space,
        v_template.id
      )
      RETURNING id INTO v_new_id;

      -- Mark template as fired so the next tick uses this as baseline.
      UPDATE public.assigned_tasks
         SET recurrence_last_spawned_at = v_now
       WHERE id = v_template.id;

      -- Notify the assignee (member scope only — studio rows are a
      -- shared pool with no specific recipient).
      IF v_template.scope = 'member' AND v_template.assigned_to IS NOT NULL THEN
        INSERT INTO public.assignment_notifications (
          recipient_id, notification_type, title, body
        ) VALUES (
          v_template.assigned_to,
          'task_assigned',
          v_template.title,
          'Recurring task — fresh instance ready in your queue.'
        );
      END IF;

      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_notes := v_notes || format(E'template %s: %s\n', v_template.id, SQLERRM);
    END;
  END LOOP;

  -- Observability — same `cron_run_log` table the checklist
  -- materializer writes to. `users_processed` repurposed as
  -- "templates fired" since the table doesn't have a generic counter
  -- column.
  INSERT INTO public.cron_run_log (
    job_name, frequency, users_processed, users_failed, notes, duration_ms
  ) VALUES (
    'spawn-recurring-tasks',
    'daily',
    v_processed,
    v_failed,
    NULLIF(v_notes, ''),
    extract(milliseconds FROM clock_timestamp() - v_start)::int
  );
END;
$$;

COMMENT ON FUNCTION public.spawn_recurring_task_instances() IS
  'Called by pg_cron daily at 11:00 UTC. Scans assigned_tasks for templates whose cadence has elapsed and inserts fresh instances. Logs to cron_run_log. Safe to run manually for ad-hoc spawn.';

REVOKE ALL ON FUNCTION public.spawn_recurring_task_instances() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.spawn_recurring_task_instances() FROM anon;
-- pg_cron runs as the postgres superuser so it doesn't need GRANT here;
-- exposing it to authenticated lets admins manually trigger via RPC if
-- they want to test without waiting for the cron tick.
GRANT EXECUTE ON FUNCTION public.spawn_recurring_task_instances() TO authenticated;

-- 3. pg_cron schedule ───────────────────────────────────────────────
-- Same 11:00 UTC slot as cron_materialize_checklists so the morning
-- batch lands together. Idempotent re-run safe.
SELECT cron.unschedule('spawn-recurring-tasks')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'spawn-recurring-tasks');

SELECT cron.schedule(
  'spawn-recurring-tasks',
  '0 11 * * *',
  $cron$SELECT public.spawn_recurring_task_instances();$cron$
);
