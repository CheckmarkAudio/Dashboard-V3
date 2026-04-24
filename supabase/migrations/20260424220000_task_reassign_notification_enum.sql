-- PR #38 — peer-to-peer task reassignment. Enum extension first so
-- migration B can insert notification rows of these types.
ALTER TYPE public.assignment_notification_type ADD VALUE IF NOT EXISTS 'task_reassign_requested';
ALTER TYPE public.assignment_notification_type ADD VALUE IF NOT EXISTS 'task_reassign_approved';
ALTER TYPE public.assignment_notification_type ADD VALUE IF NOT EXISTS 'task_reassign_declined';
