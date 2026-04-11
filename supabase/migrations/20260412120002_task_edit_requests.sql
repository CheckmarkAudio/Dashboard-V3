-- ============================================================================
-- Migration: 20260412_task_edit_requests
--
-- STATUS: APPLIED to production (project ncljfjdcyswoeitsooty) on 2026-04-12
--
-- PURPOSE
--   Phase 5.1 of the Team Orchestration plan. Adds the approval queue that
--   lets team members propose structural edits (add / rename / delete) to
--   their own checklist items and lets admins approve those edits, with the
--   option to mirror the change back to the source report_templates.fields
--   so the edit persists for the next cycle.
--
--   Completion toggles do NOT go through this queue — they stay instant.
--
-- SURFACE
--   * New enums: task_edit_change_type, task_edit_status
--   * New table: task_edit_requests (+ indexes, team_id auto-fill trigger)
--   * RLS policies:
--     - select: any team member sees team requests
--     - insert: self-only, status must be 'pending'
--     - update/delete: admin-only
--   * New RPC: approve_task_edit_request(uuid, boolean) SECURITY DEFINER
--     Applies a pending edit to intern_checklist_items and, if requested,
--     mirrors the change back to report_templates.fields (jsonb).
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE task_edit_change_type AS ENUM ('add', 'rename', 'delete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_edit_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS task_edit_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           uuid,
  instance_id       uuid NOT NULL REFERENCES intern_checklist_instances(id) ON DELETE CASCADE,
  item_id           uuid REFERENCES intern_checklist_items(id) ON UPDATE CASCADE ON DELETE CASCADE,
  proposed_text     text,
  previous_text     text,
  proposed_category text,
  change_type       task_edit_change_type NOT NULL,
  status            task_edit_status NOT NULL DEFAULT 'pending',
  requested_by      uuid NOT NULL REFERENCES intern_users(id) ON UPDATE CASCADE,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  apply_to_template boolean NOT NULL DEFAULT true,
  reviewer_id       uuid REFERENCES intern_users(id) ON UPDATE CASCADE,
  reviewed_at       timestamptz,
  reject_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_edit_requests_instance_idx     ON task_edit_requests(instance_id);
CREATE INDEX IF NOT EXISTS task_edit_requests_pending_idx      ON task_edit_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS task_edit_requests_requested_by_idx ON task_edit_requests(requested_by);

DROP TRIGGER IF EXISTS set_team_id ON task_edit_requests;
CREATE TRIGGER set_team_id BEFORE INSERT ON task_edit_requests
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

ALTER TABLE task_edit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_edit_requests_select"       ON task_edit_requests;
DROP POLICY IF EXISTS "task_edit_requests_insert_own"   ON task_edit_requests;
DROP POLICY IF EXISTS "task_edit_requests_update_admin" ON task_edit_requests;
DROP POLICY IF EXISTS "task_edit_requests_delete_admin" ON task_edit_requests;

CREATE POLICY "task_edit_requests_select" ON task_edit_requests
  FOR SELECT TO authenticated
  USING (team_id = get_my_team_id());

CREATE POLICY "task_edit_requests_insert_own" ON task_edit_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id = get_my_team_id()
    AND requested_by = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "task_edit_requests_update_admin" ON task_edit_requests
  FOR UPDATE TO authenticated
  USING (team_id = get_my_team_id() AND is_team_admin())
  WITH CHECK (team_id = get_my_team_id() AND is_team_admin());

CREATE POLICY "task_edit_requests_delete_admin" ON task_edit_requests
  FOR DELETE TO authenticated
  USING (team_id = get_my_team_id() AND is_team_admin());


-- ============================================================================
-- approve_task_edit_request(request_id, apply_to_template)
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_task_edit_request(
  p_request_id        uuid,
  p_apply_to_template boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  req            task_edit_requests;
  new_item_id    uuid;
  existing_item  intern_checklist_items;
  tmpl_id        uuid;
  tmpl_fields    jsonb;
  new_field      jsonb;
  idx            integer;
  field_elem     jsonb;
BEGIN
  IF NOT is_team_admin() THEN
    RAISE EXCEPTION 'Only team admins can approve task edit requests';
  END IF;

  SELECT * INTO req
  FROM   task_edit_requests
  WHERE  id = p_request_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already reviewed';
  END IF;

  IF req.change_type = 'add' THEN
    INSERT INTO intern_checklist_items (
      instance_id, category, item_text, is_completed, sort_order, template_id
    )
    SELECT req.instance_id,
           COALESCE(req.proposed_category, 'Member added'),
           req.proposed_text,
           false,
           COALESCE(MAX(sort_order) + 1, 0),
           NULL
    FROM   intern_checklist_items
    WHERE  instance_id = req.instance_id
    RETURNING id INTO new_item_id;

    UPDATE task_edit_requests SET item_id = new_item_id WHERE id = p_request_id;

  ELSIF req.change_type = 'rename' THEN
    SELECT * INTO existing_item FROM intern_checklist_items WHERE id = req.item_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Checklist item no longer exists';
    END IF;
    UPDATE intern_checklist_items SET item_text = req.proposed_text WHERE id = req.item_id;

  ELSIF req.change_type = 'delete' THEN
    SELECT * INTO existing_item FROM intern_checklist_items WHERE id = req.item_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Checklist item no longer exists';
    END IF;
    DELETE FROM intern_checklist_items WHERE id = req.item_id;
  END IF;

  IF p_apply_to_template THEN
    IF req.change_type = 'add' THEN
      SELECT ta.template_id INTO tmpl_id
      FROM   task_assignments ta
      JOIN   intern_checklist_instances ici ON ici.id = req.instance_id
      JOIN   report_templates rt ON rt.id = ta.template_id
      WHERE  ta.is_active
        AND  (
          ta.intern_id = ici.intern_id
          OR ta.position = (SELECT position FROM intern_users WHERE id = ici.intern_id)
        )
        AND  rt.type = ici.frequency
      ORDER  BY ta.created_at DESC
      LIMIT  1;
    ELSE
      tmpl_id := existing_item.template_id;
    END IF;

    IF tmpl_id IS NOT NULL THEN
      SELECT fields INTO tmpl_fields FROM report_templates WHERE id = tmpl_id FOR UPDATE;

      IF req.change_type = 'add' THEN
        new_field := jsonb_build_object(
          'label',       req.proposed_text,
          'type',        'checkbox',
          'is_critical', false
        );
        UPDATE report_templates
        SET    fields     = tmpl_fields || jsonb_build_array(new_field),
               updated_at = now()
        WHERE  id = tmpl_id;

        UPDATE intern_checklist_items SET template_id = tmpl_id WHERE id = new_item_id;

      ELSE
        idx := -1;
        FOR i IN 0 .. COALESCE(jsonb_array_length(tmpl_fields), 0) - 1 LOOP
          field_elem := tmpl_fields -> i;
          IF field_elem ->> 'label' = req.previous_text THEN
            idx := i;
            EXIT;
          END IF;
        END LOOP;

        IF idx >= 0 THEN
          IF req.change_type = 'rename' THEN
            UPDATE report_templates
            SET    fields     = jsonb_set(tmpl_fields, ARRAY[idx::text, 'label'], to_jsonb(req.proposed_text)),
                   updated_at = now()
            WHERE  id = tmpl_id;
          ELSE
            UPDATE report_templates
            SET    fields     = tmpl_fields - idx,
                   updated_at = now()
            WHERE  id = tmpl_id;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  UPDATE task_edit_requests
  SET    status      = 'approved',
         reviewer_id = auth.uid(),
         reviewed_at = now()
  WHERE  id = p_request_id;
END;
$fn$;

REVOKE ALL ON FUNCTION approve_task_edit_request(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_task_edit_request(uuid, boolean) TO authenticated;
