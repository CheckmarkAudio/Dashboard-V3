-- Forum media uploads (Lean 9). Each chat message can carry an
-- ordered list of attachments rendered inline in the bubble.
-- Shape per item:
--   { kind: 'image' | 'video' | 'link',
--     url: string,
--     name?: string,    // original filename for image/video
--     mime?: string,    // MIME from the upload
--     size?: number,    // bytes (image/video only)
--     embed?: string }  // optional embed kind for links: 'youtube'|'vimeo'|'loom'
--
-- Stored as jsonb so we don't have to ship a relational
-- chat_message_attachments table for an MVP that only ever
-- renders attachments inside their parent bubble.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.chat_messages.attachments IS
  'Array of inline attachments rendered in the message bubble. Items: { kind: image|video|link, url, name?, mime?, size?, embed? }. Free-form jsonb so new media kinds (file, audio, etc.) can be added without migrations.';
