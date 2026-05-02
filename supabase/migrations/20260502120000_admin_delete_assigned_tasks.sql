-- Admin direct-delete for assigned tasks.
--
-- WHY: Admins on /admin/templates need to remove tasks (mistakenly
-- assigned, no longer relevant, etc.). Today there's a per-row Edit
-- and complete-toggle but no way to delete; the only recourse is
-- marking complete which leaves the row in the data and skews
-- per-member counts.
--
-- Single bulk RPC takes a uuid[] so per-row delete (one id) and bulk
-- select-and-delete (N ids) hit the same code path. Mirrors the
-- shape of admin_delete_session: SECURITY DEFINER, admin-guarded via
-- is_team_admin(), team-scoped via team_id = get_my_team_id() so a
-- cross-team UUID is silently filtered (no information leak).
--
-- Cascade behavior verified before writing:
--   - task_reassign_requests.task_id → ON DELETE CASCADE (in-flight
--     reassign requests vanish, intended)
--   - task_requests.approved_task_id → ON DELETE SET NULL (approval
--     log entry survives, loses pointer — intended)
--   - No FKs from notifications/batches/recipients to assigned_tasks
--     (notifications key on batch_id, not task_id)
--
-- No notification side effect in this RPC. Admin direct-delete is
-- the explicit choice of the team admin; if member-side wants to
-- request a delete (per the agreed model: members request, admins
-- approve), that will be a separate flow with its own notification
-- surface in a follow-up PR.
--
-- Rollback: DROP FUNCTION public.admin_delete_assigned_tasks(uuid[]);

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
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_task_ids IS NULL OR array_length(p_task_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('deleted_count', 0);
  END IF;

  -- Team-scoped delete. Cross-team ids in the array are silently
  -- ignored — same shape as admin_delete_session: no error, no
  -- information leak about whether the row exists in another team.
  WITH del AS (
    DELETE FROM public.assigned_tasks
     WHERE id = ANY(p_task_ids)
       AND team_id = v_team
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM del;

  RETURN jsonb_build_object('deleted_count', v_deleted_count);
END;
$function$;

-- Lock executor to authenticated only (matches harden_security_surface
-- canonical pattern). Without explicit revokes, default Postgres grants
-- EXECUTE to PUBLIC, which the linter flags as anon-callable.
REVOKE ALL ON FUNCTION public.admin_delete_assigned_tasks(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_assigned_tasks(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_assigned_tasks(uuid[]) TO authenticated;

COMMIT;
