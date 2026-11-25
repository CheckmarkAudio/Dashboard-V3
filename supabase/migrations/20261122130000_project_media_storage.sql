-- Project cover and inspiration-image storage.
-- NOT APPLIED by creating this file. Do not run this migration against the
-- live Supabase project (ncljfjdcyswoeitsooty) until Bridget explicitly
-- approves it. The app degrades gracefully if this bucket is missing:
-- catalog clip art is used for covers, and inspo upload is hidden.
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-media',
  'project-media',
  true,
  5 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path layout: <team_id>/<project_id>/<kind>/<user_id>/<timestamp>-<file>
-- kind is 'covers' or 'inspo'.

DROP POLICY IF EXISTS "project_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "project_media_member_write" ON storage.objects;
DROP POLICY IF EXISTS "project_media_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "project_media_owner_delete" ON storage.objects;

CREATE POLICY "project_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-media');

CREATE POLICY "project_media_member_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_team_id()::text
    AND (storage.foldername(name))[3] IN ('covers', 'inspo')
    AND (storage.foldername(name))[4] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.team_id = public.get_my_team_id()
        AND p.status IS DISTINCT FROM 'archived'
        AND EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.id = auth.uid() AND tm.team_id = p.team_id AND tm.status = 'active'
        )
        AND (
          (
            (storage.foldername(name))[3] = 'covers'
            AND (p.owner_id = auth.uid() OR p.assigned_to = auth.uid() OR public.is_team_admin())
          )
          OR (
            (storage.foldername(name))[3] = 'inspo'
            AND (p.owner_id = auth.uid() OR public.is_team_admin() OR public.is_project_member(p.id, auth.uid()))
          )
        )
    )
  );

CREATE POLICY "project_media_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-media'
    AND auth.uid() IS NOT NULL
    AND (
      (storage.foldername(name))[4] = auth.uid()::text
      OR public.is_team_admin()
    )
  );

CREATE POLICY "project_media_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-media'
    AND auth.uid() IS NOT NULL
    AND (
      (storage.foldername(name))[4] = auth.uid()::text
      OR public.is_team_admin()
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = (storage.foldername(name))[2]
          AND p.team_id = public.get_my_team_id()
          AND (p.owner_id = auth.uid() OR p.assigned_to = auth.uid())
      )
    )
  );

COMMIT;
