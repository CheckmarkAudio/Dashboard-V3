-- Add channel-pinning to chat_channels — admins flag a channel to
-- float to the top of the sidebar globally. `pinned_at` doubles as
-- the sort key so the most-recently-pinned channel sits first (a
-- second pin demotes an older one without admin needing to drag-
-- reorder). Members read the value; only admins write it.

ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz NULL;

COMMENT ON COLUMN public.chat_channels.pinned_at IS
  'Set when an admin pins this channel to the top of the sidebar. NULL = unpinned (sorts normally by created_at). Sidebar sorts pinned channels first (by pinned_at DESC) above all unpinned channels (by created_at ASC).';

-- Sparse partial index — only rows that are actually pinned. Cheap
-- to maintain since pinning is rare; lets the "list pinned channels"
-- read path skip the full-table scan if it ever needs to.
CREATE INDEX IF NOT EXISTS chat_channels_pinned_idx
  ON public.chat_channels (pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

-- RLS unchanged — the existing admins_can_update_channels policy
-- (from 20260501000000_chat_rls_tighten.sql) already gates UPDATEs
-- on this table to admin-only via is_team_admin(). The new column
-- inherits that policy with no additional rule needed.
