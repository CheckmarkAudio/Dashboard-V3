-- 2026-05-19 — Recurring tasks: one active instance at a time.
--
-- Behavior change per user direction (with screenshot of Apple
-- Reminders as the reference): recurring tasks should NOT keep
-- re-populating on every cron tick. There should be AT MOST ONE
-- active (uncompleted) child instance per recurring template at any
-- moment. A missed instance STAYS on the list — the UI shows a small
-- "Yesterday / N days ago" red label so the user knows it's overdue,
-- but the cron doesn't keep stacking new copies on top.
--
-- When the user completes the active instance (on time or late), a
-- trigger bumps the template's `recurrence_last_spawned_at` to NOW so
-- the next cron tick treats today as the new baseline — daily next
-- fires tomorrow; weekly next fires +7d; monthly +1mo. This matches
-- the user's choice in the planning question ("Tomorrow" — completion
-- resets the clock rather than holding to the original schedule).
--
-- Two coordinated SQL changes:
--   1. `spawn_recurring_task_instances` learns to SKIP a template when
--      it already has an active (`is_completed = false`) child.
--   2. New trigger `bump_recurrence_template_on_complete` fires on
--      every assigned_tasks UPDATE — when a child instance flips from
--      incomplete → complete, it bumps the parent template's
--      `recurrence_last_spawned_at` so the cadence math restarts from
--      the completion moment instead of the original spawn moment.
--
-- The trigger sits OUTSIDE the `complete_assigned_task` RPC so it
-- catches every completion path (manual SQL, admin RPC, future bulk
-- ops). The RPC body itself is unchanged.

-- ─── 1. spawn_recurring_task_instances: skip-if-active ──────────────

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
  v_skipped      int := 0;
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
      -- 2026-05-19 — Skip if this template already has an active
      -- (uncompleted) child. That instance is either still in the
      -- user's queue waiting to be completed today, or it was missed
      -- and is showing the "overdue" badge in the UI. Either way we
      -- don't want to stack another copy on top.
      IF EXISTS (
        SELECT 1 FROM public.assigned_tasks
         WHERE recurrence_parent_id = v_template.id
           AND is_completed = false
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_freq     := v_template.recurrence_spec->>'frequency';
      v_interval := COALESCE((v_template.recurrence_spec->>'interval')::int, 1);
      IF v_interval < 1 THEN v_interval := 1; END IF;

      -- "Time elapsed since last fire" — fall back to created_at when
      -- the template has never spawned. The completion trigger below
      -- also bumps this value on each completion, so the cadence math
      -- naturally restarts from the most recent completion.
      v_baseline := COALESCE(v_template.recurrence_last_spawned_at, v_template.created_at);

      v_next_fire_at := CASE v_freq
        WHEN 'daily'   THEN v_baseline + (v_interval * INTERVAL '1 day')
        WHEN 'weekly'  THEN v_baseline + (v_interval * INTERVAL '1 week')
        WHEN 'monthly' THEN v_baseline + (v_interval * INTERVAL '1 month')
        ELSE NULL
      END;

      IF v_next_fire_at IS NULL THEN
        CONTINUE;
      END IF;
      IF v_now < v_next_fire_at THEN
        CONTINUE;
      END IF;

      -- Spawn — same body as the original migration; only the
      -- skip-if-active guard above is new.
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

      UPDATE public.assigned_tasks
         SET recurrence_last_spawned_at = v_now
       WHERE id = v_template.id;

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

  -- Append the skipped count to notes for observability — handy when
  -- triaging "why didn't my recurring task spawn today?" ("because
  -- yesterday's is still open").
  IF v_skipped > 0 THEN
    v_notes := v_notes || format(E'%s template(s) skipped — active instance still open.\n', v_skipped);
  END IF;

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
  'Called by pg_cron daily at 11:00 UTC. Skips templates that already have an active child instance (one-active-at-a-time model, per 2026-05-19). Logs spawn + skip counts to cron_run_log.';

-- ─── 2. Trigger: bump recurrence_last_spawned_at on completion ──────

CREATE OR REPLACE FUNCTION public.bump_recurrence_template_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only act when a recurring CHILD instance flips from incomplete →
  -- complete. Templates have NULL recurrence_parent_id; non-recurring
  -- tasks have NULL parent too — neither needs the bump.
  IF NEW.recurrence_parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.is_completed IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF OLD.is_completed IS TRUE THEN
    -- Already completed; this UPDATE didn't flip the flag (probably
    -- an edit to title/notes/etc). Don't re-bump.
    RETURN NEW;
  END IF;

  -- Bump the template's cadence baseline to now. Next cron tick will
  -- compute next_fire_at relative to this moment, so:
  --   daily   → next instance appears tomorrow
  --   weekly  → next instance appears +7 days from completion
  --   monthly → next instance appears +1 month from completion
  -- Matches user's "Tomorrow" choice in the planning question.
  UPDATE public.assigned_tasks
     SET recurrence_last_spawned_at = now()
   WHERE id = NEW.recurrence_parent_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assigned_tasks_bump_recurrence_on_complete
  ON public.assigned_tasks;

CREATE TRIGGER assigned_tasks_bump_recurrence_on_complete
  AFTER UPDATE OF is_completed ON public.assigned_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_recurrence_template_on_complete();

COMMENT ON TRIGGER assigned_tasks_bump_recurrence_on_complete ON public.assigned_tasks IS
  'Bumps the parent template''s recurrence_last_spawned_at to now() whenever a recurring child instance flips from incomplete to complete. Pairs with the skip-if-active guard in spawn_recurring_task_instances() to give Apple-Reminders-style "one active instance, completion resets the clock" behavior.';
