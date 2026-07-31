-- Director: "we do need to remove this especially since not all
-- objectives will have subtasks... I need to be able to check
-- standalone objectives off that dont have subtasks."
--
-- complete_project_objective() blocked completion entirely when an
-- objective had zero subtasks (RAISE EXCEPTION 'Add at least one
-- subtask before completing this objective'). The frontend gate was
-- already relaxed to match (PR #337), but this server-side check is
-- the one actually rejecting the write -- redefining it here so the
-- two agree. An objective with subtasks still requires them all done
-- first; only the zero-subtask block is removed.

BEGIN;

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
    SELECT count(*) FILTER (WHERE NOT is_completed)
    INTO v_incomplete_count
    FROM public.assigned_tasks
    WHERE project_objective_id = p_objective_id;

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

GRANT EXECUTE ON FUNCTION public.complete_project_objective(uuid, boolean) TO authenticated;

COMMIT;
