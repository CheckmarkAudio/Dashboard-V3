-- ============================================================================
-- Migration: 20260412_publish_daily_checklist_rpc
--
-- STATUS: APPLIED to production (project ncljfjdcyswoeitsooty) on 2026-04-12
--
-- PURPOSE
--   Phase 5.1.5 — the "Publish my task list to the team" feature. Takes an
--   admin caller's current daily checklist, snapshots it into templates
--   (one per category), assigns those templates to target members, and
--   regenerates each target's today-daily instance so the tasks appear on
--   their dashboard immediately.
--
--   Merge (default): inserts items the target doesn't already have.
--   Replace: wipes the matching category first, losing completion state.
--
-- SURFACE
--   publish_daily_checklist(
--     p_target_mode     text,       -- 'all_interns' | 'position' | 'specific'
--     p_target_position text,       -- used when mode = 'position'
--     p_target_ids      uuid[],     -- used when mode = 'specific'
--     p_replace         boolean     -- default false (merge)
--   ) returns jsonb
--
-- Returns: { target_count, items_added, template_count }
-- ============================================================================

CREATE OR REPLACE FUNCTION publish_daily_checklist(
  p_target_mode     text,
  p_target_position text   DEFAULT NULL,
  p_target_ids      uuid[] DEFAULT '{}',
  p_replace         boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  admin_id          uuid := auth.uid();
  admin_team        uuid;
  resolved_targets  uuid[];
  target_id         uuid;
  inst_id           uuid;
  cat               text;
  cat_fields        jsonb;
  tmpl_id           uuid;
  target_count      integer := 0;
  total_added       integer := 0;
  per_insert        integer;
BEGIN
  IF NOT is_team_admin() THEN
    RAISE EXCEPTION 'Only team admins can publish checklists';
  END IF;

  admin_team := get_my_team_id();

  IF p_target_mode = 'all_interns' THEN
    SELECT array_agg(id) INTO resolved_targets
    FROM   intern_users
    WHERE  team_id = admin_team
      AND  position = 'intern'
      AND  status = 'active'
      AND  id <> admin_id;

  ELSIF p_target_mode = 'position' THEN
    IF p_target_position IS NULL THEN
      RAISE EXCEPTION 'target_position is required when target_mode = position';
    END IF;
    SELECT array_agg(id) INTO resolved_targets
    FROM   intern_users
    WHERE  team_id = admin_team
      AND  position = p_target_position
      AND  status = 'active'
      AND  id <> admin_id;

  ELSIF p_target_mode = 'specific' THEN
    SELECT array_agg(id) INTO resolved_targets
    FROM   intern_users
    WHERE  team_id = admin_team
      AND  status = 'active'
      AND  id <> admin_id
      AND  id = ANY(p_target_ids);

  ELSE
    RAISE EXCEPTION 'Invalid target_mode: %. Expected all_interns | position | specific', p_target_mode;
  END IF;

  IF resolved_targets IS NULL OR cardinality(resolved_targets) = 0 THEN
    RETURN jsonb_build_object('target_count', 0, 'items_added', 0, 'template_count', 0);
  END IF;

  target_count := cardinality(resolved_targets);

  FOR cat IN
    SELECT DISTINCT items.category
    FROM   intern_checklist_items items
    JOIN   intern_checklist_instances inst ON inst.id = items.instance_id
    WHERE  inst.intern_id = admin_id
      AND  inst.frequency = 'daily'
      AND  inst.period_date = CURRENT_DATE
  LOOP
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('label', item_text, 'type', 'checkbox', 'is_critical', false)
        ORDER BY sort_order
      ),
      '[]'::jsonb
    )
    INTO   cat_fields
    FROM   intern_checklist_items items
    JOIN   intern_checklist_instances inst ON inst.id = items.instance_id
    WHERE  inst.intern_id = admin_id
      AND  inst.frequency = 'daily'
      AND  inst.period_date = CURRENT_DATE
      AND  items.category = cat;

    SELECT id INTO tmpl_id
    FROM   report_templates
    WHERE  name = cat
      AND  type = 'daily'
      AND  team_id = admin_team
    LIMIT  1;

    IF tmpl_id IS NULL THEN
      INSERT INTO report_templates (name, type, fields, is_default, team_id)
      VALUES (cat, 'daily', cat_fields, false, admin_team)
      RETURNING id INTO tmpl_id;
    ELSE
      UPDATE report_templates
      SET    fields     = cat_fields,
             updated_at = now()
      WHERE  id = tmpl_id;
    END IF;

    FOREACH target_id IN ARRAY resolved_targets LOOP
      IF EXISTS (
        SELECT 1 FROM task_assignments
        WHERE  template_id = tmpl_id AND intern_id = target_id
      ) THEN
        UPDATE task_assignments
        SET    is_active   = true,
               assigned_by = admin_id
        WHERE  template_id = tmpl_id AND intern_id = target_id;
      ELSE
        INSERT INTO task_assignments (template_id, intern_id, is_active, assigned_by, team_id)
        VALUES (tmpl_id, target_id, true, admin_id, admin_team);
      END IF;

      SELECT id INTO inst_id
      FROM   intern_checklist_instances
      WHERE  intern_id = target_id
        AND  frequency = 'daily'
        AND  period_date = CURRENT_DATE;

      IF inst_id IS NULL THEN
        INSERT INTO intern_checklist_instances (intern_id, frequency, period_date, team_id)
        VALUES (target_id, 'daily', CURRENT_DATE, admin_team)
        RETURNING id INTO inst_id;
      END IF;

      IF p_replace THEN
        DELETE FROM intern_checklist_items
        WHERE  instance_id = inst_id
          AND  category = cat;
      END IF;

      INSERT INTO intern_checklist_items (
        instance_id, category, item_text, is_completed, sort_order, template_id, team_id
      )
      SELECT inst_id,
             cat,
             (field->>'label')::text,
             false,
             (ord - 1)::int,
             tmpl_id,
             admin_team
      FROM   jsonb_array_elements(cat_fields) WITH ORDINALITY AS t(field, ord)
      WHERE  NOT EXISTS (
        SELECT 1 FROM intern_checklist_items existing
        WHERE  existing.instance_id = inst_id
          AND  existing.item_text   = (field->>'label')::text
      );

      GET DIAGNOSTICS per_insert = ROW_COUNT;
      total_added := total_added + per_insert;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'target_count', target_count,
    'items_added',  total_added,
    'template_count', (
      SELECT count(DISTINCT items.category)
      FROM   intern_checklist_items items
      JOIN   intern_checklist_instances inst ON inst.id = items.instance_id
      WHERE  inst.intern_id = admin_id
        AND  inst.frequency = 'daily'
        AND  inst.period_date = CURRENT_DATE
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION publish_daily_checklist(text, text, uuid[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_daily_checklist(text, text, uuid[], boolean) TO authenticated;
