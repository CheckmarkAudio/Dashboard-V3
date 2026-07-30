-- Projects foundation.
--
-- Projects are durable outcomes. Their checkable work continues to live in
-- assigned_tasks; progress notes live in project_updates and are mirrored to
-- flywheel_events so the existing activity timeline can display them.

BEGIN;

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  objective text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('planned', 'active', 'paused', 'completed', 'archived')),
  target_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS projects_team_status_idx
  ON public.projects (team_id, status, updated_at DESC);

ALTER TABLE public.assigned_tasks
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assigned_tasks_project_idx
  ON public.assigned_tasks (project_id, is_completed, sort_order);

CREATE TABLE IF NOT EXISTS public.project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.assigned_tasks(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE RESTRICT,
  note text NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_updates_project_created_idx
  ON public.project_updates (project_id, created_at DESC);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_team_select ON public.projects;
CREATE POLICY projects_team_select ON public.projects
  FOR SELECT TO authenticated
  USING (team_id = public.get_my_team_id());

DROP POLICY IF EXISTS project_updates_team_select ON public.project_updates;
CREATE POLICY project_updates_team_select ON public.project_updates
  FOR SELECT TO authenticated
  USING (team_id = public.get_my_team_id());

-- Writes intentionally go through the small RPC surface below. It resolves
-- team/actor identity server-side and prevents cross-team relationships.

CREATE OR REPLACE FUNCTION public.create_project(
  p_title text,
  p_objective text DEFAULT NULL,
  p_target_date date DEFAULT NULL
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
  IF v_actor_id IS NULL OR v_team_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'Project title is required';
  END IF;

  INSERT INTO public.projects (team_id, owner_id, title, objective, target_date)
  VALUES (
    v_team_id,
    v_actor_id,
    btrim(p_title),
    NULLIF(btrim(COALESCE(p_objective, '')), ''),
    p_target_date
  )
  RETURNING * INTO v_project;

  RETURN v_project;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_project_task(
  p_project_id uuid,
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
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND team_id = v_team_id AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF length(btrim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'Task title is required';
  END IF;

  INSERT INTO public.assigned_tasks (
    team_id, assigned_to, scope, title, due_date, source_type,
    visible_on_overview, project_id
  )
  VALUES (
    v_team_id, v_actor_id, 'member', btrim(p_title), p_due_date, 'custom',
    true, p_project_id
  )
  RETURNING * INTO v_task;

  UPDATE public.projects SET updated_at = now() WHERE id = p_project_id;
  RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_project_progress_note(
  p_project_id uuid,
  p_task_id uuid,
  p_note text
) RETURNS public.project_updates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid := public.get_my_team_id();
  v_actor_id uuid := auth.uid();
  v_project_title text;
  v_task_title text;
  v_update public.project_updates;
BEGIN
  IF v_actor_id IS NULL OR v_team_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(p_note, ''))) = 0 THEN
    RAISE EXCEPTION 'Progress note is required';
  END IF;

  SELECT title INTO v_project_title
  FROM public.projects
  WHERE id = p_project_id AND team_id = v_team_id;
  IF v_project_title IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  IF p_task_id IS NOT NULL THEN
    SELECT title INTO v_task_title
    FROM public.assigned_tasks
    WHERE id = p_task_id AND project_id = p_project_id AND team_id = v_team_id;
    IF v_task_title IS NULL THEN
      RAISE EXCEPTION 'Task not found in this project';
    END IF;
  END IF;

  INSERT INTO public.project_updates (team_id, project_id, task_id, author_id, note)
  VALUES (v_team_id, p_project_id, p_task_id, v_actor_id, btrim(p_note))
  RETURNING * INTO v_update;

  UPDATE public.projects SET updated_at = now() WHERE id = p_project_id;

  PERFORM public.record_flywheel_event(
    'workflow',
    'project_progress',
    v_update.id,
    v_actor_id,
    jsonb_build_object(
      'title', left(btrim(p_note), 120),
      'note', btrim(p_note),
      'project_id', p_project_id,
      'project_title', v_project_title,
      'task_id', p_task_id,
      'task_title', v_task_title
    ),
    v_update.created_at
  );

  RETURN v_update;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project(text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_task(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_progress_note(uuid, uuid, text) TO authenticated;

COMMIT;
