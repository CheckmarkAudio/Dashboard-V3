-- 2026-05-20 — Edit + delete for forum chat messages.
--
-- User direction: "we need to be able to edit and or to delete our
-- messages if we need to". Today `chat_messages` is INSERT-only +
-- SELECT-only (no UPDATE/DELETE policies), and there's no
-- `edited_at` column to power an "(edited)" badge on the bubble.
--
-- Model:
--   * Edit = UPDATE `content` + bump `edited_at` to now(). Only
--     the sender can edit their own message.
--   * Delete = hard DELETE (Discord-style — row gone). Sender can
--     delete their own; admins can delete any message in the
--     thread (moderation). Soft-delete was considered but added
--     "(deleted)" placeholders feel noisier than just removing the
--     row.
--   * Realtime sub on chat_messages already picks up UPDATE +
--     DELETE events (REPLICA IDENTITY FULL set in
--     20260502180000_realtime_task_sync.sql for tasks; chat was
--     added in 20260501020000_chat_messages_realtime.sql).

-- ─── 1. edited_at column ───────────────────────────────────────────

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

COMMENT ON COLUMN public.chat_messages.edited_at IS
  'Set to now() whenever the sender edits the message content. NULL means never edited. Drives the "(edited)" badge in the forum bubble.';

-- ─── 2. UPDATE policy — sender edits own ──────────────────────────
-- WITH CHECK locks the same row identity (channel/sender) so a
-- sender can't update `sender_id` to someone else's id (which would
-- effectively let them impersonate). They can ONLY change the
-- mutable fields the app cares about (content, attachments,
-- edited_at) — RLS enforces the rest via the identity match below.

DROP POLICY IF EXISTS chat_messages_owner_update ON public.chat_messages;
CREATE POLICY chat_messages_owner_update ON public.chat_messages
  FOR UPDATE
  USING (sender_id = (auth.uid())::text)
  WITH CHECK (sender_id = (auth.uid())::text);

-- ─── 3. DELETE policy — sender deletes own OR admin deletes any ──

DROP POLICY IF EXISTS chat_messages_owner_or_admin_delete ON public.chat_messages;
CREATE POLICY chat_messages_owner_or_admin_delete ON public.chat_messages
  FOR DELETE
  USING (
    sender_id = (auth.uid())::text
    OR public.is_team_admin()
  );
