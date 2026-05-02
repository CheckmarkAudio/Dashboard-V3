-- Return deleted assigned_task ids from the admin delete RPC.
--
-- The first version returned only deleted_count, which made the UI
-- wait for a refetch before it could know exactly which rows left the
-- table. Returning ids lets Assign remove confirmed-deleted rows
-- immediately while still refreshing from the server afterward.

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
  v_caller        uuid := auth.uid();
  v_team          uuid := public.get_my_team_id();
  v_deleted_count integer;
  v_deleted_ids   jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_task_ids IS NULL OR array_length(p_task_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('deleted_count', 0, 'deleted_ids', '[]'::jsonb);
  END IF;

  WITH target AS (
    SELECT t.id
      FROM public.assigned_tasks t
      LEFT JOIN public.team_members assignee
        ON assignee.id = t.assigned_to
      LEFT JOIN public.assignment_recipients ar
        ON ar.id = t.recipient_assignment_id
      LEFT JOIN public.task_assignment_batches b
        ON b.id = ar.batch_id
      LEFT JOIN public.team_members batch_admin
        ON batch_admin.id = b.assigned_by
     WHERE t.id = ANY(p_task_ids)
       AND (
         t.team_id = v_team
         OR (t.team_id IS NULL AND assignee.team_id = v_team)
         OR (t.team_id IS NULL AND batch_admin.team_id = v_team)
       )
  ),
  del AS (
    DELETE FROM public.assigned_tasks
     WHERE id IN (SELECT id FROM target)
    RETURNING id
  )
  SELECT
    count(*),
    COALESCE(jsonb_agg(id), '[]'::jsonb)
  INTO v_deleted_count, v_deleted_ids
  FROM del;

  RETURN jsonb_build_object(
    'deleted_count', v_deleted_count,
    'deleted_ids', v_deleted_ids
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_assigned_tasks(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_assigned_tasks(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_assigned_tasks(uuid[]) TO authenticated;

COMMIT;
