-- Lean 5 (super-PR) — `member-media` Storage bucket for avatars + banners.
--
-- Bucket is PUBLIC so the URLs work in <img src> without signed-URL
-- ceremony. (The contents are profile pics + banners — already meant
-- to be visible to anyone who can reach the app, and there's no
-- enumeration risk because filenames are user-id namespaced.)
--
-- RLS on storage.objects:
--   - SELECT: public (read-only)
--   - INSERT/UPDATE/DELETE: only the owner of the user_id folder, OR
--     a team admin. Path convention enforced is
--       avatars/{user_id}/{anything}
--       banners/{user_id}/{anything}
--     so `(storage.foldername(name))[2]` extracts the user_id.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'member-media',
  'member-media',
  true,
  5 * 1024 * 1024,                                  -- 5 MB max
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop policies first so re-running the migration is idempotent.
DROP POLICY IF EXISTS "member_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "member_media_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "member_media_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "member_media_owner_delete" ON storage.objects;

CREATE POLICY "member_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'member-media');

-- Helper: caller is the owner of the {user_id} folder, OR is a team admin.
-- The folder layout is `<kind>/<user_id>/...` so foldername(name)[2] is
-- the user id (1-indexed; [1] is the kind: avatars/banners).
CREATE POLICY "member_media_owner_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'member-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[2]
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.id = auth.uid() AND tm.role = 'admin'
      )
    )
  );

CREATE POLICY "member_media_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'member-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[2]
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.id = auth.uid() AND tm.role = 'admin'
      )
    )
  );

CREATE POLICY "member_media_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'member-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[2]
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.id = auth.uid() AND tm.role = 'admin'
      )
    )
  );
