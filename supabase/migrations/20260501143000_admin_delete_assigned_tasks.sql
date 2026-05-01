-- Admin bulk delete for Assign page tasks.
--
-- Deletes only tasks inside the caller's team. This powers both
-- per-row delete and top-bar selected delete on the member-centric
-- Assign page.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_delete_assigned_tasks(
  p_task_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller      uuid := auth.uid();
  v_team        uuid := public.get_my_team_id();
  v_deleted_ids uuid[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_task_ids IS NULL OR cardinality(p_task_ids) = 0 THEN
    RETURN jsonb_build_object(
      'deleted_count', 0,
      'deleted_ids', '[]'::jsonb
    );
  END IF;

  WITH deleted AS (
    DELETE FROM public.assigned_tasks t
     WHERE t.id = ANY(p_task_ids)
       AND t.team_id = v_team
     RETURNING t.id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_deleted_ids
    FROM deleted;

  RETURN jsonb_build_object(
    'deleted_count', COALESCE(array_length(v_deleted_ids, 1), 0),
    'deleted_ids', COALESCE(to_jsonb(v_deleted_ids), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_assigned_tasks(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_assigned_tasks(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_assigned_tasks(uuid[]) TO authenticated;

COMMIT;
