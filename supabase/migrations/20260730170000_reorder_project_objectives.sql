-- Keep project objectives in a user-controlled checklist order.

BEGIN;

CREATE OR REPLACE FUNCTION public.reorder_project_objectives(
  p_project_id uuid,
  p_objective_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_actor_id uuid := auth.uid();
  v_expected_count integer;
  v_unique_count integer;
BEGIN
  IF v_actor_id IS NULL OR v_team_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = p_project_id
      AND team_id = v_team_id
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  SELECT count(*) INTO v_expected_count
  FROM public.project_objectives
  WHERE project_id = p_project_id
    AND team_id = v_team_id;

  SELECT count(DISTINCT requested_id) INTO v_unique_count
  FROM unnest(COALESCE(p_objective_ids, ARRAY[]::uuid[])) AS requested(requested_id);

  IF cardinality(COALESCE(p_objective_ids, ARRAY[]::uuid[])) <> v_expected_count
    OR v_unique_count <> v_expected_count
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p_objective_ids, ARRAY[]::uuid[])) AS requested(requested_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.project_objectives o
        WHERE o.id = requested.requested_id
          AND o.project_id = p_project_id
          AND o.team_id = v_team_id
      )
    )
  THEN
    RAISE EXCEPTION 'Objective order must include every project objective exactly once';
  END IF;

  UPDATE public.project_objectives AS objective
  SET
    sort_order = requested.sort_order,
    updated_at = now()
  FROM (
    SELECT objective_id, ordinal - 1 AS sort_order
    FROM unnest(p_objective_ids) WITH ORDINALITY AS ordered(objective_id, ordinal)
  ) AS requested
  WHERE objective.id = requested.objective_id;

  UPDATE public.projects
  SET updated_at = now()
  WHERE id = p_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_project_objectives(uuid, uuid[]) TO authenticated;

COMMIT;
