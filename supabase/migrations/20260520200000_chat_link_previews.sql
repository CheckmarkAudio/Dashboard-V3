-- 2026-05-20 — Server-side cache for forum link unfurling.
--
-- The new `unfurl-link` edge function fetches OG/Twitter meta from
-- any URL an admin pastes into chat so the bubble can render an
-- Instagram-style preview card. We cache the parsed metadata here
-- to avoid re-fetching the same URL every time it's used (and to
-- avoid hammering the target site).
--
-- TTL: 7 days. The edge function only returns cached rows whose
-- `fetched_at` is within that window; older rows fall through to
-- a fresh fetch.
--
-- Caching by `url` (the primary key) means we dedupe across
-- members + channels — if 5 people post the same Twitter link
-- in a week, we fetch once.

CREATE TABLE IF NOT EXISTS public.chat_link_previews (
  url         text PRIMARY KEY,
  title       text,
  description text,
  image_url   text,
  site_name   text,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

-- Recency index so the edge function's TTL filter doesn't scan.
CREATE INDEX IF NOT EXISTS idx_chat_link_previews_fetched_at
  ON public.chat_link_previews (fetched_at DESC);

COMMENT ON TABLE public.chat_link_previews IS
  'Cache of OG/Twitter metadata fetched by the unfurl-link edge function. Keyed by URL; refresh after 7 days. Used by the forum to render rich link preview cards in chat bubbles.';

-- RLS: anyone signed in can read. Inserts/updates happen via the
-- edge function (service role) so no INSERT/UPDATE policy needed.
ALTER TABLE public.chat_link_previews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_link_previews_select ON public.chat_link_previews;
CREATE POLICY chat_link_previews_select ON public.chat_link_previews
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

GRANT SELECT ON public.chat_link_previews TO authenticated;
