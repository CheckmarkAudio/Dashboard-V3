-- PR #40 — notification type emitted when an admin edits a task via
-- the Edit Tasks modal. Uses batch_id as the polymorphic subject
-- ref so the click can route through the existing highlight-task
-- handler.
ALTER TYPE public.assignment_notification_type ADD VALUE IF NOT EXISTS 'task_edited';
