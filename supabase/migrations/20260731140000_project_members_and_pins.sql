-- Collaborative projects: independent personal pins and explicit project membership.

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_members (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.project_pins (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, member_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_members_team_select ON public.project_members
  FOR SELECT TO authenticated USING (team_id = public.get_my_team_id());
CREATE POLICY project_pins_own_select ON public.project_pins
  FOR SELECT TO authenticated USING (team_id = public.get_my_team_id() AND member_id = auth.uid());

INSERT INTO public.project_members (project_id, member_id, team_id, added_by)
SELECT p.id, COALESCE(p.owner_id, p.assigned_to), p.team_id, COALESCE(p.owner_id, p.assigned_to)
FROM public.projects p
WHERE COALESCE(p.owner_id, p.assigned_to) IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.add_project_owner_as_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_members (project_id, member_id, team_id, added_by)
  VALUES (NEW.id, COALESCE(NEW.owner_id, NEW.assigned_to), NEW.team_id, COALESCE(NEW.owner_id, NEW.assigned_to))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_owner_membership ON public.projects;
CREATE TRIGGER project_owner_membership
AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.add_project_owner_as_member();

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid, p_member_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.member_id = p_member_id
      AND pm.team_id = public.get_my_team_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.set_project_pin(p_project_id uuid, p_is_pinned boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team_id uuid := public.get_my_team_id(); v_actor_id uuid := auth.uid();
BEGIN
  IF v_actor_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND team_id = v_team_id) THEN
    RAISE EXCEPTION 'Project not found or forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_is_pinned THEN
    INSERT INTO public.project_pins(project_id, member_id, team_id) VALUES (p_project_id, v_actor_id, v_team_id)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.project_pins WHERE project_id = p_project_id AND member_id = v_actor_id;
  END IF;
  RETURN p_is_pinned;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_project_member(p_project_id uuid, p_member_id uuid, p_is_member boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team_id uuid := public.get_my_team_id(); v_actor_id uuid := auth.uid(); v_owner_id uuid;
BEGIN
  SELECT COALESCE(owner_id, assigned_to) INTO v_owner_id FROM public.projects
  WHERE id = p_project_id AND team_id = v_team_id;
  IF v_actor_id IS NULL OR v_owner_id IS NULL OR (v_actor_id <> v_owner_id AND NOT public.is_team_admin()) THEN
    RAISE EXCEPTION 'Only the project owner or an admin can manage the project team' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE id = p_member_id AND team_id = v_team_id AND status = 'active') THEN
    RAISE EXCEPTION 'Active team member not found';
  END IF;
  IF NOT p_is_member AND p_member_id = v_owner_id THEN RAISE EXCEPTION 'The project owner cannot be removed'; END IF;
  IF p_is_member THEN
    INSERT INTO public.project_members(project_id, member_id, team_id, added_by)
    VALUES (p_project_id, p_member_id, v_team_id, v_actor_id) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.project_members WHERE project_id = p_project_id AND member_id = p_member_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_project_task(p_task_id uuid, p_is_completed boolean)
RETURNS public.assigned_tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_task public.assigned_tasks; v_actor_id uuid := auth.uid();
BEGIN
  SELECT t.* INTO v_task FROM public.assigned_tasks t WHERE t.id = p_task_id AND t.team_id = public.get_my_team_id() FOR UPDATE;
  IF v_actor_id IS NULL OR v_task.id IS NULL OR v_task.project_id IS NULL OR NOT public.is_project_member(v_task.project_id, v_actor_id) THEN
    RAISE EXCEPTION 'Only project members can complete this task' USING ERRCODE = '42501';
  END IF;
  UPDATE public.assigned_tasks SET is_completed = p_is_completed,
    completed_at = CASE WHEN p_is_completed THEN now() ELSE NULL END,
    completed_by = CASE WHEN p_is_completed THEN v_actor_id ELSE NULL END,
    updated_at = now()
  WHERE id = p_task_id RETURNING * INTO v_task;
  RETURN v_task;
END;
$$;

-- Add membership enforcement to the existing objective and project completion functions.
CREATE OR REPLACE FUNCTION public.assert_project_member(p_project_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_project_member(p_project_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only project members can complete project work' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_project_completion_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_project_id uuid;
BEGIN
  v_project_id := CASE WHEN TG_TABLE_NAME = 'projects' THEN NEW.id ELSE NEW.project_id END;
  PERFORM public.assert_project_member(v_project_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_tasks_members_only ON public.assigned_tasks;
CREATE TRIGGER project_tasks_members_only
BEFORE UPDATE OF is_completed ON public.assigned_tasks
FOR EACH ROW WHEN (OLD.is_completed IS DISTINCT FROM NEW.is_completed AND NEW.project_id IS NOT NULL)
EXECUTE FUNCTION public.enforce_project_completion_membership();

DROP TRIGGER IF EXISTS project_objectives_members_only ON public.project_objectives;
CREATE TRIGGER project_objectives_members_only
BEFORE UPDATE OF is_completed ON public.project_objectives
FOR EACH ROW WHEN (OLD.is_completed IS DISTINCT FROM NEW.is_completed)
EXECUTE FUNCTION public.enforce_project_completion_membership();

DROP TRIGGER IF EXISTS projects_completion_members_only ON public.projects;
CREATE TRIGGER projects_completion_members_only
BEFORE UPDATE OF status ON public.projects
FOR EACH ROW WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  AND (NEW.status = 'completed' OR (OLD.status = 'completed' AND NEW.status = 'active'))
)
EXECUTE FUNCTION public.enforce_project_completion_membership();

GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_project_pin(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_project_member(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_project_task(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_project_member(uuid) TO authenticated;

COMMIT;
