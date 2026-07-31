-- Project and objective names may contain as much context as the team needs.
-- Keep the non-blank requirement while removing maximum character counts.

BEGIN;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_title_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_title_required_check
  CHECK (length(btrim(title)) >= 1);

ALTER TABLE public.project_objectives
  DROP CONSTRAINT IF EXISTS project_objectives_title_check;

ALTER TABLE public.project_objectives
  ADD CONSTRAINT project_objectives_title_required_check
  CHECK (length(btrim(title)) >= 1);

COMMIT;
