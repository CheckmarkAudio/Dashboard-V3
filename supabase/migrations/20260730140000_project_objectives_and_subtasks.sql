-- Project hierarchy: Project -> checkable objective -> checkable subtasks.

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  sort_order integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_objectives_project_sort_idx
  ON public.project_objectives (project_id, sort_order, created_at);

ALTER TABLE public.assigned_tasks
  ADD COLUMN IF NOT EXISTS project_objective_id uuid
  REFERENCES public.project_objectives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assigned_tasks_project_objective_idx
  ON public.assigned_tasks (project_objective_id, is_completed, sort_order);

ALTER TABLE public.project_objectives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_objectives_team_select ON public.project_objectives;
CREATE POLICY project_objectives_team_select ON public.project_objectives
  FOR SELECT TO authenticated
  USING (team_id = public.get_my_team_id());

CREATE OR REPLACE FUNCTION public.create_project_with_objectives(
  p_title text,
  p_description text DEFAULT NULL,
  p_target_date date DEFAULT NULL,
  p_objectives jsonb DEFAULT '[]'::jsonb
) RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_actor_id uuid := auth.uid();
  v_title text := btrim(COALESCE(p_title, ''));
  v_description text := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_project public.projects;
  v_objective text;
  v_sort integer := 0;
BEGIN
  IF v_actor_id IS NULL OR v_team_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF length(v_title) = 0 THEN
    RAISE EXCEPTION 'Project name is required';
  END IF;
  IF jsonb_typeof(COALESCE(p_objectives, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Objectives must be an array';
  END IF;

  INSERT INTO public.projects (
    team_id, name, title, project_type, assigned_to, owner_id,
    notes, objective, due_date, target_date, status
  )
  VALUES (
    v_team_id, v_title, v_title, 'internal', v_actor_id, v_actor_id,
    v_description, v_description, p_target_date, p_target_date, 'active'
  )
  RETURNING * INTO v_project;

  FOR v_objective IN
    SELECT btrim(value #>> '{}')
    FROM jsonb_array_elements(COALESCE(p_objectives, '[]'::jsonb))
  LOOP
    IF length(v_objective) > 0 THEN
      INSERT INTO public.project_objectives
        (team_id, project_id, title, sort_order)
      VALUES
        (v_team_id, v_project.id, v_objective, v_sort);
      v_sort := v_sort + 1;
    END IF;
  END LOOP;

  RETURN v_project;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_project_objective(
  p_project_id uuid,
  p_title text
) RETURNS public.project_objectives
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_actor_id uuid := auth.uid();
  v_objective public.project_objectives;
  v_sort integer;
BEGIN
  IF v_actor_id IS NULL OR v_team_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND team_id = v_team_id AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF length(btrim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'Objective title is required';
  END IF;

  SELECT COALESCE(max(sort_order) + 1, 0) INTO v_sort
  FROM public.project_objectives
  WHERE project_id = p_project_id;

  INSERT INTO public.project_objectives
    (team_id, project_id, title, sort_order)
  VALUES
    (v_team_id, p_project_id, btrim(p_title), v_sort)
  RETURNING * INTO v_objective;

  UPDATE public.projects SET updated_at = now() WHERE id = p_project_id;
  RETURN v_objective;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_project_objective_task(
  p_project_id uuid,
  p_objective_id uuid,
  p_title text,
  p_due_date date DEFAULT NULL
) RETURNS public.assigned_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_actor_id uuid := auth.uid();
  v_task public.assigned_tasks;
BEGIN
  IF v_actor_id IS NULL OR v_team_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.project_objectives
    WHERE id = p_objective_id
      AND project_id = p_project_id
      AND team_id = v_team_id
  ) THEN
    RAISE EXCEPTION 'Objective not found in this project';
  END IF;
  IF length(btrim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'Subtask title is required';
  END IF;

  INSERT INTO public.assigned_tasks (
    team_id, assigned_to, scope, title, due_date, source_type,
    visible_on_overview, project_id, project_objective_id
  )
  VALUES (
    v_team_id, v_actor_id, 'member', btrim(p_title), p_due_date, 'custom',
    true, p_project_id, p_objective_id
  )
  RETURNING * INTO v_task;

  UPDATE public.projects SET updated_at = now() WHERE id = p_project_id;
  RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_project_objective(
  p_objective_id uuid,
  p_is_completed boolean
) RETURNS public.project_objectives
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_actor_id uuid := auth.uid();
  v_objective public.project_objectives;
  v_task_count integer;
  v_incomplete_count integer;
BEGIN
  IF v_actor_id IS NULL OR v_team_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_objective
  FROM public.project_objectives
  WHERE id = p_objective_id AND team_id = v_team_id
  FOR UPDATE;
  IF v_objective.id IS NULL THEN
    RAISE EXCEPTION 'Objective not found';
  END IF;

  IF p_is_completed THEN
    SELECT count(*), count(*) FILTER (WHERE NOT is_completed)
    INTO v_task_count, v_incomplete_count
    FROM public.assigned_tasks
    WHERE project_objective_id = p_objective_id;

    IF v_task_count = 0 THEN
      RAISE EXCEPTION 'Add at least one subtask before completing this objective';
    END IF;
    IF v_incomplete_count > 0 THEN
      RAISE EXCEPTION 'Complete every subtask before completing this objective';
    END IF;
  END IF;

  UPDATE public.project_objectives
  SET
    is_completed = p_is_completed,
    completed_at = CASE WHEN p_is_completed THEN now() ELSE NULL END,
    completed_by = CASE WHEN p_is_completed THEN v_actor_id ELSE NULL END,
    updated_at = now()
  WHERE id = p_objective_id
  RETURNING * INTO v_objective;

  UPDATE public.projects SET updated_at = now()
  WHERE id = v_objective.project_id;

  RETURN v_objective;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project_with_objectives(text, text, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_objective(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_objective_task(uuid, uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_project_objective(uuid, boolean) TO authenticated;

COMMIT;
