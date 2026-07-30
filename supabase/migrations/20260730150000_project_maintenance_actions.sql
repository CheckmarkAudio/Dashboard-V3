-- Project maintenance actions: edit/archive projects, and edit/delete
-- objectives and their nested subtasks.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_project_details(
  p_project_id uuid,
  p_title text,
  p_description text DEFAULT NULL,
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
  v_description text := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_project public.projects;
BEGIN
  IF length(v_title) = 0 THEN RAISE EXCEPTION 'Project name is required'; END IF;

  SELECT * INTO v_project FROM public.projects
  WHERE id = p_project_id AND team_id = v_team_id;
  IF v_actor_id IS NULL OR v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_project.owner_id IS DISTINCT FROM v_actor_id
    AND v_project.assigned_to IS DISTINCT FROM v_actor_id
    AND NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Only the project owner or an admin can edit this project'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
  SET
    name = v_title,
    title = v_title,
    notes = v_description,
    objective = v_description,
    due_date = p_target_date,
    target_date = p_target_date,
    updated_at = now()
  WHERE id = p_project_id
  RETURNING * INTO v_project;
  RETURN v_project;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_project(
  p_project_id uuid
) RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_actor_id uuid := auth.uid();
  v_project public.projects;
BEGIN
  SELECT * INTO v_project FROM public.projects
  WHERE id = p_project_id AND team_id = v_team_id;
  IF v_actor_id IS NULL OR v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_project.owner_id IS DISTINCT FROM v_actor_id
    AND v_project.assigned_to IS DISTINCT FROM v_actor_id
    AND NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Only the project owner or an admin can archive this project'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
  SET status = 'archived', updated_at = now()
  WHERE id = p_project_id
  RETURNING * INTO v_project;
  RETURN v_project;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_project_objective(
  p_objective_id uuid,
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
  v_owner_id uuid;
  v_assigned_to uuid;
BEGIN
  IF length(btrim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'Objective name is required';
  END IF;
  SELECT o.* INTO v_objective
  FROM public.project_objectives o
  WHERE o.id = p_objective_id AND o.team_id = v_team_id;
  IF v_actor_id IS NULL OR v_objective.id IS NULL THEN
    RAISE EXCEPTION 'Objective not found or forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT owner_id, assigned_to INTO v_owner_id, v_assigned_to
  FROM public.projects WHERE id = v_objective.project_id;
  IF v_owner_id IS DISTINCT FROM v_actor_id
    AND v_assigned_to IS DISTINCT FROM v_actor_id
    AND NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Only the project owner or an admin can edit this objective'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.project_objectives
  SET title = btrim(p_title), updated_at = now()
  WHERE id = p_objective_id
  RETURNING * INTO v_objective;
  RETURN v_objective;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_project_objective(
  p_objective_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_actor_id uuid := auth.uid();
  v_project_id uuid;
  v_owner_id uuid;
  v_assigned_to uuid;
  v_deleted_tasks integer := 0;
BEGIN
  SELECT o.project_id, p.owner_id, p.assigned_to
  INTO v_project_id, v_owner_id, v_assigned_to
  FROM public.project_objectives o
  JOIN public.projects p ON p.id = o.project_id
  WHERE o.id = p_objective_id AND o.team_id = v_team_id;
  IF v_actor_id IS NULL OR v_project_id IS NULL THEN
    RAISE EXCEPTION 'Objective not found or forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_owner_id IS DISTINCT FROM v_actor_id
    AND v_assigned_to IS DISTINCT FROM v_actor_id
    AND NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Only the project owner or an admin can delete this objective'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.assigned_tasks
  WHERE project_objective_id = p_objective_id;
  GET DIAGNOSTICS v_deleted_tasks = ROW_COUNT;

  DELETE FROM public.project_objectives WHERE id = p_objective_id;
  UPDATE public.projects SET updated_at = now() WHERE id = v_project_id;
  RETURN v_deleted_tasks;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_project_task(
  p_task_id uuid,
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
  v_owner_id uuid;
BEGIN
  IF length(btrim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'Subtask name is required';
  END IF;
  SELECT t.* INTO v_task
  FROM public.assigned_tasks t
  WHERE t.id = p_task_id AND t.team_id = v_team_id AND t.project_id IS NOT NULL;
  IF v_actor_id IS NULL OR v_task.id IS NULL THEN
    RAISE EXCEPTION 'Subtask not found or forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT owner_id INTO v_owner_id FROM public.projects WHERE id = v_task.project_id;
  IF v_task.assigned_to IS DISTINCT FROM v_actor_id
    AND v_owner_id IS DISTINCT FROM v_actor_id
    AND NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Only the task assignee, project owner, or an admin can edit this subtask'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.assigned_tasks
  SET title = btrim(p_title), due_date = p_due_date, updated_at = now()
  WHERE id = p_task_id
  RETURNING * INTO v_task;
  RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_project_task(
  p_task_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_actor_id uuid := auth.uid();
  v_task public.assigned_tasks;
  v_owner_id uuid;
BEGIN
  SELECT t.* INTO v_task
  FROM public.assigned_tasks t
  WHERE t.id = p_task_id AND t.team_id = v_team_id AND t.project_id IS NOT NULL;
  IF v_actor_id IS NULL OR v_task.id IS NULL THEN
    RAISE EXCEPTION 'Subtask not found or forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT owner_id INTO v_owner_id FROM public.projects WHERE id = v_task.project_id;
  IF v_task.assigned_to IS DISTINCT FROM v_actor_id
    AND v_owner_id IS DISTINCT FROM v_actor_id
    AND NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Only the task assignee, project owner, or an admin can delete this subtask'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.assigned_tasks WHERE id = p_task_id;
  UPDATE public.projects SET updated_at = now() WHERE id = v_task.project_id;
  RETURN p_task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_project_details(uuid, text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_project_objective(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_project_objective(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_project_task(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_project_task(uuid) TO authenticated;

COMMIT;
