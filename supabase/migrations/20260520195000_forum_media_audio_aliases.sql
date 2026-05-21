-- 2026-05-20 — Forum media bucket: expand audio allow-list with
-- legacy / cross-platform MIME aliases.
--
-- User report: MP3s greyed out in the file picker on macOS. The
-- picker accept attr was the main culprit (fixed client-side with
-- a wildcard), but if a browser DOES tag the file as something
-- non-standard like `audio/mp3` (older Windows) or `audio/x-m4a`,
-- our strict server allow-list would still reject the upload.
-- This migration syncs the bucket with `FORUM_AUDIO_MIME` in
-- src/lib/forum/attachments.ts. New entries:
--   audio/mp3        — legacy Windows label for .mp3
--   audio/x-m4a      — some browsers report .m4a this way
--   audio/aac        — raw AAC streams
--   audio/flac       — FLAC
--   audio/x-flac     — FLAC alias

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
         'image/jpeg','image/png','image/webp','image/gif',
         'video/mp4','video/webm','video/quicktime',
         'audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a',
         'audio/aac','audio/wav','audio/x-wav',
         'audio/ogg','audio/webm','audio/flac','audio/x-flac'
       ]
 WHERE id = 'forum-media';
