-- Keep assigned_tasks.team_id populated for every write path.
--
-- The admin delete RPC is intentionally team-scoped by
-- assigned_tasks.team_id. Some older/newer request-approval paths
-- inserted member tasks without team_id, which made those rows visible
-- in Assign via assigned_to but undeletable by admin_delete_assigned_tasks
-- ("Deleted 0 tasks"). This migration backfills existing rows and adds
-- one centralized guard so future RPCs do not each need to remember the
-- denormalized column.

BEGIN;

-- Backfill member rows directly from their assignee.
UPDATE public.assigned_tasks t
   SET team_id = m.team_id
  FROM public.team_members m
 WHERE t.team_id IS NULL
   AND t.assigned_to = m.id;

-- Backfill any remaining member/template rows from the assignment chain.
UPDATE public.assigned_tasks t
   SET team_id = admin.team_id
  FROM public.assignment_recipients ar
  JOIN public.task_assignment_batches b ON b.id = ar.batch_id
  JOIN public.team_members admin ON admin.id = b.assigned_by
 WHERE t.team_id IS NULL
   AND t.recipient_assignment_id = ar.id;

CREATE OR REPLACE FUNCTION public.fill_assigned_task_team_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team uuid;
BEGIN
  IF NEW.team_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS NOT NULL THEN
    SELECT team_id INTO v_team
      FROM public.team_members
     WHERE id = NEW.assigned_to;
  END IF;

  IF v_team IS NULL AND NEW.recipient_assignment_id IS NOT NULL THEN
    SELECT admin.team_id INTO v_team
      FROM public.assignment_recipients ar
      JOIN public.task_assignment_batches b ON b.id = ar.batch_id
      JOIN public.team_members admin ON admin.id = b.assigned_by
     WHERE ar.id = NEW.recipient_assignment_id;
  END IF;

  IF v_team IS NULL THEN
    v_team := public.get_my_team_id();
  END IF;

  NEW.team_id := v_team;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fill_assigned_task_team_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fill_assigned_task_team_id() FROM anon;
REVOKE ALL ON FUNCTION public.fill_assigned_task_team_id() FROM authenticated;

DROP TRIGGER IF EXISTS trg_fill_assigned_task_team_id ON public.assigned_tasks;
CREATE TRIGGER trg_fill_assigned_task_team_id
BEFORE INSERT OR UPDATE OF assigned_to, recipient_assignment_id, team_id
ON public.assigned_tasks
FOR EACH ROW
EXECUTE FUNCTION public.fill_assigned_task_team_id();

COMMIT;
