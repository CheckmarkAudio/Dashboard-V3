-- docs/seed_data/task_assignment_phase_1_seed.sql
--
-- Recovery script: recreates the smoke-test seed data introduced during
-- Phase 1 assignment-system rollout (PR #6, 2026-04-21). Safe to run
-- multiple times — each run creates NEW rows (templates + batches), it
-- does not update existing ones.
--
-- When to run this:
--   - Someone accidentally wiped the assignment tables
--   - You want fresh seed data in a staging environment
--   - Codex's frontend PR needs realistic rows to render against
--
-- How to run:
--   1. Log into Supabase SQL editor as a user with admin role
--      (e.g., Checkmark Admin — id 3abdc3a8-f5d7-429e-b974-7915b41e5b38)
--   2. OR run via Supabase MCP with JWT impersonation of an admin
--   3. Paste this whole file and execute
--
-- What it creates:
--   - 1 task_templates row: "Marketing Onboarding" (4 items, onboarding=true)
--   - 1 full-template assignment to Gavin Hammond
--   - 1 custom-task "Call vendor re: Q2 campaign" to Gavin + Matthan Bow
--   - 1 partial-template assignment (items 1 + 2) to Matthan
--   - Total: 4 recipients, 8 tasks, 4 notifications
--
-- Requires:
--   - All Phase 1 RPCs deployed (task_assignment_system_phase_1_rpcs migration)
--   - Caller must have team_members.role = 'admin' in the DB
--   - Target members (Gavin, Matthan) must exist in team_members

-- Re-create the Marketing Onboarding template + items.
WITH new_template AS (
  SELECT (public.create_task_template(
    p_name          := 'Marketing Onboarding',
    p_description   := 'Standard onboarding for new marketing hires',
    p_role_tag      := 'marketing',
    p_is_onboarding := true
  ) ->> 'id')::uuid AS id
)
SELECT
  public.add_task_template_item(
    p_template_id             := (SELECT id FROM new_template),
    p_title                   := 'Set up profile photo',
    p_description             := 'Upload a professional headshot to your profile',
    p_category                := 'Profile',
    p_sort_order              := 0,
    p_is_required             := true,
    p_default_due_offset_days := 1
  ) AS item_1,
  public.add_task_template_item(
    p_template_id             := (SELECT id FROM new_template),
    p_title                   := 'Read brand guide',
    p_category                := 'Brand Knowledge',
    p_sort_order              := 1,
    p_is_required             := true,
    p_default_due_offset_days := 2
  ) AS item_2,
  public.add_task_template_item(
    p_template_id             := (SELECT id FROM new_template),
    p_title                   := 'Connect to content calendar',
    p_category                := 'Tools',
    p_sort_order              := 2,
    p_default_due_offset_days := 3
  ) AS item_3,
  public.add_task_template_item(
    p_template_id             := (SELECT id FROM new_template),
    p_title                   := 'Shadow two client sessions',
    p_category                := 'Training',
    p_sort_order              := 3,
    p_default_due_offset_days := 7
  ) AS item_4;

-- Full-template assign to Gavin Hammond (id: 895ac283-e7f6-462e-8968-2ffea1eb5843)
WITH t AS (
  SELECT id FROM public.task_templates
  WHERE name = 'Marketing Onboarding'
  ORDER BY created_at DESC LIMIT 1
)
SELECT public.assign_template_to_members(
  p_template_id := (SELECT id FROM t),
  p_member_ids  := ARRAY['895ac283-e7f6-462e-8968-2ffea1eb5843'::uuid]
);

-- Custom task to Gavin + Matthan Bow (id: ce0c669f-a96c-471b-b1c9-5896d1aaf026)
SELECT public.assign_custom_task_to_members(
  p_member_ids  := ARRAY[
    '895ac283-e7f6-462e-8968-2ffea1eb5843'::uuid,
    'ce0c669f-a96c-471b-b1c9-5896d1aaf026'::uuid
  ],
  p_title       := 'Call vendor re: Q2 campaign',
  p_description := 'Follow up on the pending quote',
  p_category    := 'Outreach',
  p_due_date    := CURRENT_DATE + 2,
  p_is_required := true
);

-- Partial-template assign (first 2 items) to Matthan
WITH t AS (
  SELECT id FROM public.task_templates
  WHERE name = 'Marketing Onboarding'
  ORDER BY created_at DESC LIMIT 1
),
items AS (
  SELECT array_agg(id ORDER BY sort_order) FILTER (WHERE sort_order IN (0, 1)) AS partial_ids
  FROM public.task_template_items
  WHERE template_id = (SELECT id FROM t)
)
SELECT public.assign_template_items_to_members(
  p_template_id       := (SELECT id FROM t),
  p_template_item_ids := (SELECT partial_ids FROM items),
  p_member_ids        := ARRAY['ce0c669f-a96c-471b-b1c9-5896d1aaf026'::uuid]
);
