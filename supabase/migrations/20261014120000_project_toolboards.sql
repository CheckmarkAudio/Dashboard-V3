-- Project tools beta. Additive; existing objectives/tasks remain authoritative.
-- NOT APPLIED by creating this file. Apply separately after approval.
BEGIN;
CREATE TABLE public.project_toolboards (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{"version":1,"tools":[]}',
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  CONSTRAINT project_toolboards_size CHECK (octet_length(content::text) <= 1000000)
);
CREATE INDEX project_toolboards_team_idx ON public.project_toolboards(team_id);
ALTER TABLE public.project_toolboards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_toolboards FROM anon, authenticated;
GRANT SELECT ON public.project_toolboards TO authenticated;
CREATE POLICY project_toolboards_team_read ON public.project_toolboards FOR SELECT TO authenticated
  USING (team_id = public.get_my_team_id() AND EXISTS (
    SELECT 1 FROM public.team_members tm WHERE tm.id = auth.uid() AND tm.team_id = project_toolboards.team_id AND tm.status = 'active'
  ) AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.team_id = public.get_my_team_id()
  ));

CREATE FUNCTION public.save_project_toolboard(p_project_id uuid, p_revision integer, p_content jsonb)
RETURNS public.project_toolboards LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_project public.projects; v_board public.project_toolboards;
  t jsonb; e jsonb; s jsonb; point jsonb; dimension text;
  tool_ids text[] := '{}'; entry_ids text[] := '{}'; item_ids text[]; links text[] := '{}';
BEGIN
  -- Lock the project even before its first board exists: two initial saves cannot race.
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id AND team_id = public.get_my_team_id() FOR UPDATE;
  IF auth.uid() IS NULL OR v_project.id IS NULL OR v_project.status = 'archived'
    OR NOT EXISTS (SELECT 1 FROM public.team_members WHERE id = auth.uid() AND team_id = v_project.team_id AND status = 'active')
    OR NOT (public.is_project_member(p_project_id, auth.uid()) OR v_project.owner_id = auth.uid() OR public.is_team_admin()) THEN
    RAISE EXCEPTION 'Only project members, the owner, or team admins can edit this workspace' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_board FROM public.project_toolboards WHERE project_id = p_project_id;
  IF p_revision IS NULL OR p_revision <> COALESCE(v_board.revision, 0) THEN
    RAISE EXCEPTION 'Workspace changed; reload before saving' USING ERRCODE = '40001';
  END IF;
  IF p_content IS NULL OR jsonb_typeof(p_content) <> 'object' OR p_content->'version' IS DISTINCT FROM '1'::jsonb
    OR jsonb_typeof(p_content->'tools') IS DISTINCT FROM 'array' OR octet_length(p_content::text) > 1000000 THEN
    RAISE EXCEPTION 'Invalid workspace content';
  END IF;
  IF jsonb_array_length(p_content->'tools') > 40 THEN RAISE EXCEPTION 'Maximum 40 tools per project'; END IF;
  FOR t IN SELECT value FROM jsonb_array_elements(p_content->'tools') LOOP
    IF jsonb_typeof(t) <> 'object' OR jsonb_typeof(t->'id') IS DISTINCT FROM 'string'
      OR length(t->>'id') NOT BETWEEN 1 AND 100 OR t->>'id' = ANY(tool_ids)
      OR jsonb_typeof(t->'title') IS DISTINCT FROM 'string' OR length(btrim(t->>'title')) NOT BETWEEN 1 AND 160
      OR jsonb_typeof(t->'wide') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid tool'; END IF;
    tool_ids := array_append(tool_ids, t->>'id');
    CASE t->>'type'
    WHEN 'measurements' THEN
      IF jsonb_typeof(t->'entries') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid measurements'; END IF;
      IF jsonb_array_length(t->'entries') > 200 THEN RAISE EXCEPTION 'Maximum 200 measurements per tool'; END IF;
      FOR e IN SELECT value FROM jsonb_array_elements(t->'entries') LOOP
        IF jsonb_typeof(e->'id') IS DISTINCT FROM 'string' OR length(e->>'id') NOT BETWEEN 1 AND 100 OR e->>'id' = ANY(entry_ids)
          OR jsonb_typeof(e->'name') IS DISTINCT FROM 'string' OR length(btrim(e->>'name')) NOT BETWEEN 1 AND 160
          OR COALESCE(e->>'unit','') NOT IN ('in','cm') OR jsonb_typeof(e->'notes') IS DISTINCT FROM 'string' OR length(e->>'notes') > 4000 THEN RAISE EXCEPTION 'Invalid measurement'; END IF;
        entry_ids := array_append(entry_ids, e->>'id');
        FOREACH dimension IN ARRAY ARRAY['width','depth','height'] LOOP
          IF jsonb_typeof(e->dimension) IS DISTINCT FROM 'string' OR length(e->>dimension) > 24 THEN RAISE EXCEPTION 'Invalid dimension'; END IF;
          IF e->>dimension <> '' THEN
            IF (e->>dimension) !~ '^[0-9]+([.][0-9]+)?([eE][+-]?[0-9]{1,3})?$' THEN RAISE EXCEPTION 'Invalid dimension'; END IF;
            IF (e->>dimension)::numeric <= 0 OR (e->>dimension)::numeric > 100000 THEN RAISE EXCEPTION 'Dimension out of range'; END IF;
          END IF;
        END LOOP;
      END LOOP;
    WHEN 'shopping' THEN
      IF jsonb_typeof(t->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid shopping list'; END IF;
      IF jsonb_array_length(t->'items') > 200 THEN RAISE EXCEPTION 'Maximum 200 shopping items per tool'; END IF;
      item_ids := '{}';
      FOR e IN SELECT value FROM jsonb_array_elements(t->'items') LOOP
        IF jsonb_typeof(e->'id') IS DISTINCT FROM 'string' OR length(e->>'id') NOT BETWEEN 1 AND 100 OR e->>'id' = ANY(item_ids)
          OR jsonb_typeof(e->'name') IS DISTINCT FROM 'string' OR length(btrim(e->>'name')) NOT BETWEEN 1 AND 160
          OR jsonb_typeof(e->'done') IS DISTINCT FROM 'boolean' OR NOT (e ? 'measurementId')
          OR jsonb_typeof(e->'measurementId') NOT IN ('null','string') THEN RAISE EXCEPTION 'Invalid shopping item'; END IF;
        item_ids := array_append(item_ids, e->>'id');
        IF e->>'measurementId' IS NOT NULL THEN links := array_append(links, e->>'measurementId'); END IF;
      END LOOP;
    WHEN 'tasks' THEN
      IF NOT (t ? 'objectiveId') OR jsonb_typeof(t->'objectiveId') NOT IN ('null','string') THEN RAISE EXCEPTION 'Invalid task list'; END IF;
      IF t->>'objectiveId' IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.project_objectives WHERE id::text = t->>'objectiveId' AND project_id = p_project_id AND team_id = v_project.team_id
      ) THEN RAISE EXCEPTION 'Task list must belong to this project'; END IF;
    WHEN 'note', 'sketch' THEN
      IF jsonb_typeof(t->'text') IS DISTINCT FROM 'string' OR length(t->>'text') > 20000 THEN RAISE EXCEPTION 'Note is too long'; END IF;
      IF t->>'type' = 'sketch' THEN
        IF jsonb_typeof(t->'strokes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid drawing'; END IF;
        IF jsonb_array_length(t->'strokes') > 300 THEN RAISE EXCEPTION 'Maximum 300 strokes per sketchpad'; END IF;
        FOR s IN SELECT value FROM jsonb_array_elements(t->'strokes') LOOP
          IF jsonb_typeof(s->'width') IS DISTINCT FROM 'number' OR COALESCE(s->>'width','') NOT IN ('2','4','8') OR jsonb_typeof(s->'points') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid stroke'; END IF;
          IF jsonb_array_length(s->'points') NOT BETWEEN 1 AND 1500 THEN RAISE EXCEPTION 'Invalid stroke length'; END IF;
          FOR point IN SELECT value FROM jsonb_array_elements(s->'points') LOOP
            IF jsonb_typeof(point) <> 'array' THEN RAISE EXCEPTION 'Invalid point'; END IF;
            IF jsonb_array_length(point) <> 2 OR jsonb_typeof(point->0) <> 'number' OR jsonb_typeof(point->1) <> 'number' THEN RAISE EXCEPTION 'Invalid point'; END IF;
            IF (point->>0)::numeric NOT BETWEEN 0 AND 1000 OR (point->>1)::numeric NOT BETWEEN 0 AND 600 THEN RAISE EXCEPTION 'Point out of bounds'; END IF;
          END LOOP;
        END LOOP;
      END IF;
    ELSE RAISE EXCEPTION 'Unsupported project tool';
    END CASE;
  END LOOP;
  IF NOT links <@ entry_ids THEN RAISE EXCEPTION 'Measurements must belong to this workspace'; END IF;
  INSERT INTO public.project_toolboards(project_id, team_id, content, revision, updated_by)
  VALUES (p_project_id, v_project.team_id, p_content, 1, auth.uid())
  ON CONFLICT (project_id) DO UPDATE SET content = EXCLUDED.content,
    revision = project_toolboards.revision + 1, updated_at = now(), updated_by = auth.uid()
  RETURNING * INTO v_board;
  RETURN v_board;
END;
$$;
REVOKE ALL ON FUNCTION public.save_project_toolboard(uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_project_toolboard(uuid, integer, jsonb) TO authenticated;
COMMIT;
