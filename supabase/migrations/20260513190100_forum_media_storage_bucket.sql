-- Forum media bucket — separate from member-media so the two
-- domains don't share a quota or RLS surface.
--
-- 50MB cap per file: covers screenshots, short clips, and most
-- training videos compressed to 720p. Larger training videos
-- should still go through Loom / YouTube / Vimeo (the +Link
-- option) so we don't blow through Storage quota.
--
-- Path layout:
--   <kind>/<channel_id>/<user_id>/<timestamp>-<original>.<ext>
-- That gives us:
--   - kind grouping for cleanup ('images', 'videos')
--   - per-channel pruning if a channel ever gets nuked
--   - per-user authorship enforcement via RLS

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'forum-media',
  'forum-media',
  true,
  50 * 1024 * 1024,                                  -- 50 MB max
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "forum_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "forum_media_member_write" ON storage.objects;
DROP POLICY IF EXISTS "forum_media_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "forum_media_owner_delete" ON storage.objects;

-- Public read so <img>/<video> tags render without signed URLs.
CREATE POLICY "forum_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'forum-media');

-- Anyone signed in can write (matches chat send semantics —
-- whoever can post can attach). Per-channel ACL would belong
-- on chat_messages itself, not on storage.
CREATE POLICY "forum_media_member_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'forum-media'
    AND auth.uid() IS NOT NULL
  );

-- Updates restricted to the original uploader OR an admin.
CREATE POLICY "forum_media_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'forum-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[3]
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.id = auth.uid() AND tm.role = 'admin'
      )
    )
  );

-- Same for deletes — uploader or admin only.
CREATE POLICY "forum_media_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'forum-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[3]
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.id = auth.uid() AND tm.role = 'admin'
      )
    )
  );
