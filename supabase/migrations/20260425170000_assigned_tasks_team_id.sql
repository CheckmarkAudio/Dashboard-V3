-- PR #44 fix — denormalize team_id onto assigned_tasks.
--
-- Studio-scope tasks have no `recipient_assignment_id`, so the
-- get_studio_assigned_tasks + get_team_assigned_tasks fetchers (which
-- joined the recipient chain to scope by team) silently dropped
-- every studio row from their results. Adding `team_id` directly on
-- the task lets both fetchers filter by team without the chain.

ALTER TABLE public.assigned_tasks
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;

-- Backfill 1: member-scope rows resolve via the recipient chain.
UPDATE public.assigned_tasks t
SET team_id = admin.team_id
FROM public.assignment_recipients ar
JOIN public.task_assignment_batches b ON b.id = ar.batch_id
JOIN public.team_members admin ON admin.id = b.assigned_by
WHERE t.team_id IS NULL
  AND t.recipient_assignment_id = ar.id;

-- Backfill 2: studio-scope rows that happen to have an assignee.
UPDATE public.assigned_tasks t
SET team_id = m.team_id
FROM public.team_members m
WHERE t.team_id IS NULL
  AND t.assigned_to = m.id;

CREATE INDEX IF NOT EXISTS idx_assigned_tasks_team_id_scope
  ON public.assigned_tasks (team_id, scope, is_completed);
