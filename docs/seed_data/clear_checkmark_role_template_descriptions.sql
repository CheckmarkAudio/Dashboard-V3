-- docs/seed_data/clear_checkmark_role_template_descriptions.sql
--
-- Clears visible template/item description text for the Checkmark role
-- templates created by checkmark_role_task_templates.sql.
--
-- This is intentionally narrow: it only touches the exact template
-- names + role tags listed below. It does not delete templates, items,
-- assigned tasks, members, bookings, or historical assignments.

BEGIN;

UPDATE public.task_templates t
SET description = NULL,
    updated_at = now()
WHERE (t.name, t.role_tag) IN (
  ('Engineer Shift Readiness', 'engineer'),
  ('Marketing Content + Outreach', 'marketing'),
  ('Media Capture + Asset Prep', 'media'),
  ('Intern Studio Support', 'intern'),
  ('Dev Dashboard Maintenance', 'dev'),
  ('Admin Daily Operations', 'admin'),
  ('Ops Studio Readiness', 'ops')
);

UPDATE public.task_template_items i
SET description = NULL,
    updated_at = now()
FROM public.task_templates t
WHERE i.template_id = t.id
  AND (t.name, t.role_tag) IN (
    ('Engineer Shift Readiness', 'engineer'),
    ('Marketing Content + Outreach', 'marketing'),
    ('Media Capture + Asset Prep', 'media'),
    ('Intern Studio Support', 'intern'),
    ('Dev Dashboard Maintenance', 'dev'),
    ('Admin Daily Operations', 'admin'),
    ('Ops Studio Readiness', 'ops')
  );

COMMIT;

SELECT
  t.role_tag,
  t.name,
  t.description AS template_description,
  count(i.id) FILTER (WHERE i.description IS NOT NULL) AS items_with_descriptions
FROM public.task_templates t
LEFT JOIN public.task_template_items i ON i.template_id = t.id
WHERE (t.name, t.role_tag) IN (
  ('Engineer Shift Readiness', 'engineer'),
  ('Marketing Content + Outreach', 'marketing'),
  ('Media Capture + Asset Prep', 'media'),
  ('Intern Studio Support', 'intern'),
  ('Dev Dashboard Maintenance', 'dev'),
  ('Admin Daily Operations', 'admin'),
  ('Ops Studio Readiness', 'ops')
)
GROUP BY t.role_tag, t.name, t.description
ORDER BY t.role_tag, t.name;
