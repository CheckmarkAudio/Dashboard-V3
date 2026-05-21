-- 2026-05-20 — Extend the forum-media bucket to accept audio MIME
-- types so members can attach voice memos + audio clips. User
-- complaint: "mp3s cant be uploaded" — the Storage MIME allow-list
-- only included image/* and video/* before.
--
-- The original bucket was created in
-- `20260513190100_forum_media_storage_bucket.sql`. The shape of
-- `storage.buckets` doesn't have a native ARRAY_APPEND, so we
-- replace the full allowed_mime_types list (idempotent — the
-- INSERT uses ON CONFLICT DO UPDATE).
--
-- New MIME types covered:
--   audio/mpeg     → .mp3
--   audio/mp4      → AAC / .m4a
--   audio/wav      → uncompressed PCM
--   audio/x-wav    → legacy alias for .wav some browsers report
--   audio/ogg      → Vorbis / Opus in OGG container
--   audio/webm     → Opus in WebM container

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
         'image/jpeg','image/png','image/webp','image/gif',
         'video/mp4','video/webm','video/quicktime',
         'audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm'
       ]
 WHERE id = 'forum-media';
