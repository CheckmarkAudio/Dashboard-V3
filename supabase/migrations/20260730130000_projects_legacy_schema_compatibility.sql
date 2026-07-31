-- Reconcile the focused Projects workflow with the pre-existing studio
-- projects table.
--
-- Production already had:
--   name, client_name, project_type, assigned_to, notes, due_date
--
-- The focused workflow adds:
--   title, objective, owner_id, target_date, completed_at
--
-- Keep both shapes populated during the transition so the old project data
-- and any older clients remain readable. This migration is additive and does
-- not rename or delete legacy columns.

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.team_members(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill the focused fields from the legacy equivalents.
UPDATE public.projects
SET
  title = COALESCE(NULLIF(btrim(title), ''), name),
  objective = COALESCE(objective, notes),
  owner_id = COALESCE(owner_id, assigned_to),
  target_date = COALESCE(target_date, due_date)
WHERE
  title IS NULL
  OR objective IS NULL
  OR owner_id IS NULL
  OR target_date IS NULL;

CREATE INDEX IF NOT EXISTS projects_team_status_updated_idx
  ON public.projects (team_id, status, updated_at DESC);

-- On the legacy table, name and project_type are required. Populate both the
-- legacy and focused columns for every new project.
CREATE OR REPLACE FUNCTION public.create_project(
  p_title text,
  p_objective text DEFAULT NULL,
  p_target_date date DEFAULT NULL
) RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_actor_id uuid := auth.uid();
  v_title text := btrim(COALESCE(p_title, ''));
  v_objective text := NULLIF(btrim(COALESCE(p_objective, '')), '');
  v_project public.projects;
BEGIN
  IF v_actor_id IS NULL OR v_team_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF length(v_title) = 0 THEN
    RAISE EXCEPTION 'Project title is required';
  END IF;

  INSERT INTO public.projects (
    team_id,
    name,
    title,
    project_type,
    assigned_to,
    owner_id,
    notes,
    objective,
    due_date,
    target_date,
    status
  )
  VALUES (
    v_team_id,
    v_title,
    v_title,
    'internal',
    v_actor_id,
    v_actor_id,
    v_objective,
    v_objective,
    p_target_date,
    p_target_date,
    'active'
  )
  RETURNING * INTO v_project;

  RETURN v_project;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project(text, text, date) TO authenticated;

COMMIT;
