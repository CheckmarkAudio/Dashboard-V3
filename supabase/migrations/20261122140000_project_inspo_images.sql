-- Inspiration images for a project, plus an RPC to set or clear cover art.
-- NOT APPLIED by creating this file. Do not run this migration against the
-- live Supabase project (ncljfjdcyswoeitsooty) until Bridget explicitly
-- approves it. The frontend hides upload and keeps catalog clip art if this
-- table or these functions are missing.
--
-- Depends on 20261122120000_project_cover_url.sql (cover_url column) and
-- 20261122130000_project_media_storage.sql (project-media bucket). The
-- cover_url column is also added here with IF NOT EXISTS so this file is
-- safe if the earlier migration is applied in the same batch.
BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cover_url text;

CREATE TABLE IF NOT EXISTS public.project_inspo_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  title text NOT NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_inspo_images_title_len CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT project_inspo_images_path_len CHECK (length(storage_path) BETWEEN 8 AND 1000),
  CONSTRAINT project_inspo_images_url_len CHECK (length(public_url) BETWEEN 8 AND 2000),
  CONSTRAINT project_inspo_images_path_unique UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS project_inspo_images_project_idx
  ON public.project_inspo_images (project_id, created_at);

COMMENT ON TABLE public.project_inspo_images IS
  'Inspiration reference images attached to a project. Files live in the project-media storage bucket.';

ALTER TABLE public.project_inspo_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_inspo_images FROM anon, authenticated;
GRANT SELECT ON public.project_inspo_images TO authenticated;

DROP POLICY IF EXISTS project_inspo_images_team_read ON public.project_inspo_images;
CREATE POLICY project_inspo_images_team_read ON public.project_inspo_images
  FOR SELECT TO authenticated
  USING (
    team_id = public.get_my_team_id()
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = auth.uid() AND tm.team_id = project_inspo_images.team_id AND tm.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.team_id = public.get_my_team_id()
    )
  );

CREATE OR REPLACE FUNCTION public.add_project_inspo_image(
  p_project_id uuid,
  p_title text,
  p_storage_path text,
  p_public_url text
) RETURNS public.project_inspo_images
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects;
  v_title text := btrim(COALESCE(p_title, ''));
  v_path text := btrim(COALESCE(p_storage_path, ''));
  v_url text := btrim(COALESCE(p_public_url, ''));
  v_row public.project_inspo_images;
BEGIN
  SELECT * INTO v_project FROM public.projects
    WHERE id = p_project_id AND team_id = public.get_my_team_id() FOR UPDATE;
  IF auth.uid() IS NULL OR v_project.id IS NULL OR v_project.status = 'archived'
    OR NOT EXISTS (SELECT 1 FROM public.team_members WHERE id = auth.uid() AND team_id = v_project.team_id AND status = 'active')
    OR NOT (public.is_project_member(p_project_id, auth.uid()) OR v_project.owner_id = auth.uid() OR public.is_team_admin()) THEN
    RAISE EXCEPTION 'Only project members, the owner, or team admins can add inspiration images'
      USING ERRCODE = '42501';
  END IF;
  IF length(v_title) < 1 OR length(v_title) > 160 THEN
    RAISE EXCEPTION 'Give this image a name (up to 160 characters).';
  END IF;
  IF v_path IS NULL OR v_path NOT LIKE (v_project.team_id::text || '/' || p_project_id::text || '/inspo/' || auth.uid()::text || '/%')
     OR length(v_path) > 1000 OR v_path LIKE '%..%' THEN
    RAISE EXCEPTION 'Invalid inspiration image path' USING ERRCODE = '22023';
  END IF;
  IF length(v_url) < 8 OR length(v_url) > 2000 OR position('/storage/v1/object/public/project-media/' in v_url) = 0
     OR position(v_path in v_url) = 0 THEN
    RAISE EXCEPTION 'Invalid inspiration image URL' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.project_inspo_images WHERE project_id = p_project_id) >= 40 THEN
    RAISE EXCEPTION 'Maximum 40 inspiration images per project';
  END IF;
  INSERT INTO public.project_inspo_images (project_id, team_id, created_by, title, storage_path, public_url)
  VALUES (p_project_id, v_project.team_id, auth.uid(), v_title, v_path, v_url)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_project_inspo_image(p_image_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.project_inspo_images;
  v_project public.projects;
BEGIN
  SELECT * INTO v_row FROM public.project_inspo_images WHERE id = p_image_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Inspiration image not found' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_project FROM public.projects
    WHERE id = v_row.project_id AND team_id = public.get_my_team_id();
  IF auth.uid() IS NULL OR v_project.id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.team_members WHERE id = auth.uid() AND team_id = v_project.team_id AND status = 'active')
    OR NOT (public.is_project_member(v_project.id, auth.uid()) OR v_project.owner_id = auth.uid() OR public.is_team_admin()) THEN
    RAISE EXCEPTION 'Only project members, the owner, or team admins can remove inspiration images'
      USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.project_inspo_images WHERE id = p_image_id;
  RETURN p_image_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_project_cover(
  p_project_id uuid,
  p_cover_url text DEFAULT NULL
) RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects;
  v_url text := NULLIF(btrim(COALESCE(p_cover_url, '')), '');
BEGIN
  SELECT * INTO v_project FROM public.projects
    WHERE id = p_project_id AND team_id = public.get_my_team_id() FOR UPDATE;
  IF auth.uid() IS NULL OR v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_project.owner_id IS DISTINCT FROM auth.uid()
    AND v_project.assigned_to IS DISTINCT FROM auth.uid()
    AND NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Only the project owner or an admin can change the cover image'
      USING ERRCODE = '42501';
  END IF;
  IF v_url IS NOT NULL THEN
    IF length(v_url) > 2000
      OR position('/storage/v1/object/public/project-media/' in v_url) = 0
      OR position('/' || p_project_id::text || '/covers/' in v_url) = 0 THEN
      RAISE EXCEPTION 'Cover must be an image uploaded to this project' USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.projects
    SET cover_url = v_url, updated_at = now()
    WHERE id = p_project_id
    RETURNING * INTO v_project;
  RETURN v_project;
END;
$$;

REVOKE ALL ON FUNCTION public.add_project_inspo_image(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_project_inspo_image(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_project_cover(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_project_inspo_image(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_project_inspo_image(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_project_cover(uuid, text) TO authenticated;

COMMIT;
