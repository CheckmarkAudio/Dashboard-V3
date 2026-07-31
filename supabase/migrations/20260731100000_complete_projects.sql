-- Explicit project completion, guarded by objective completion.

BEGIN;

CREATE OR REPLACE FUNCTION public.complete_project(
  p_project_id uuid,
  p_is_completed boolean
) RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_actor_id uuid := auth.uid();
  v_project public.projects;
  v_objective_count integer;
  v_incomplete_count integer;
BEGIN
  IF v_actor_id IS NULL OR v_team_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT p.* INTO v_project
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.team_id = v_team_id
    AND p.status <> 'archived'
  FOR UPDATE;

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  IF p_is_completed THEN
    SELECT count(*), count(*) FILTER (WHERE NOT is_completed)
    INTO v_objective_count, v_incomplete_count
    FROM public.project_objectives
    WHERE project_id = p_project_id;

    IF v_objective_count = 0 THEN
      RAISE EXCEPTION 'Add at least one objective before completing this project';
    END IF;
    IF v_incomplete_count > 0 THEN
      RAISE EXCEPTION 'Complete every objective before completing this project';
    END IF;
  END IF;

  UPDATE public.projects
  SET
    status = CASE WHEN p_is_completed THEN 'completed' ELSE 'active' END,
    completed_at = CASE WHEN p_is_completed THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_project_id
  RETURNING * INTO v_project;

  RETURN v_project;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_project_when_objective_reopens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_completed AND NOT NEW.is_completed THEN
    UPDATE public.projects
    SET status = 'active', completed_at = NULL, updated_at = now()
    WHERE id = NEW.project_id AND status = 'completed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_objective_reopens_project ON public.project_objectives;
CREATE TRIGGER project_objective_reopens_project
AFTER UPDATE OF is_completed ON public.project_objectives
FOR EACH ROW
EXECUTE FUNCTION public.reopen_project_when_objective_reopens();

GRANT EXECUTE ON FUNCTION public.complete_project(uuid, boolean) TO authenticated;

COMMIT;
