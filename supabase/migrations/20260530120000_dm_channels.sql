-- Direct Messages (1:1 + group) on top of the existing chat schema.
--
-- Design: a DM is just a *private channel*. Rather than build a parallel
-- messaging stack, we reuse chat_channels / chat_messages /
-- chat_channel_reads (unread tracking, attachments, edit/delete, realtime)
-- and add:
--   1. chat_channels.kind  — 'public' (today's behavior) | 'dm' | 'group'
--   2. chat_channel_members — who can see/post in a private channel
--   3. RLS so private channels + their messages + their member rows are
--      visible only to their members; public channels keep today's rules.
--   4. find_or_create_dm() / create_group_dm() RPCs so channel creation +
--      member insertion happen atomically as SECURITY DEFINER (which also
--      sidesteps RLS recursion — see is_channel_member below).
--
-- Notes on existing schema (verified against live project):
--   * chat_channels.name AND slug are both UNIQUE + NOT NULL. DM/group rows
--     therefore store a *generated unique token* in both; the human-facing
--     label is derived client-side (DM = the other member's name; group =
--     the optional title stored in `description`, else the member names).
--   * chat_channel_reads is self-scoped (user_id = auth.uid()) and
--     channel-kind-agnostic, so DM read-tracking works with no change here.
--   * chat_messages already has owner UPDATE + owner/admin DELETE policies,
--     which carry over to DMs unchanged.
--
-- Rollback: drop the two RPCs, the two helpers, chat_channel_members, the
-- new policies, and the kind column; restore the prior broad SELECT/INSERT
-- policies on chat_channels / chat_messages (see git history of
-- 20260501000000_chat_rls_tighten.sql).

BEGIN;

-- ── 1. Channel kind ──────────────────────────────────────────────────────────
ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'public';

ALTER TABLE public.chat_channels
  DROP CONSTRAINT IF EXISTS chat_channels_kind_check;
ALTER TABLE public.chat_channels
  ADD CONSTRAINT chat_channels_kind_check CHECK (kind IN ('public', 'dm', 'group'));

CREATE INDEX IF NOT EXISTS idx_chat_channels_kind ON public.chat_channels(kind);

-- ── 2. Membership table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  channel_id uuid        NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.team_members(id)  ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user ON public.chat_channel_members(user_id);

ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

-- ── 3. Recursion-safe helpers ────────────────────────────────────────────────
-- SECURITY DEFINER (owned by the table owner) → these read the membership /
-- channel tables WITHOUT triggering their own RLS policies, so policies that
-- call them don't recurse. Same pattern as the existing is_team_admin().
CREATE OR REPLACE FUNCTION public.is_channel_member(p_channel uuid, p_uid uuid DEFAULT auth.uid())
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channel_members m
    WHERE m.channel_id = p_channel AND m.user_id = p_uid
  )
$$;

CREATE OR REPLACE FUNCTION public.is_private_channel(p_channel uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channels c
    WHERE c.id = p_channel AND c.kind IN ('dm', 'group')
  )
$$;

-- ── 4. RLS: chat_channels (replace the blanket SELECT with kind-aware) ────────
DROP POLICY IF EXISTS "team_members_can_read_channels" ON public.chat_channels;
CREATE POLICY "members_read_channels"
  ON public.chat_channels
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = auth.uid() AND tm.status = 'active'
    )
    AND (
      kind = 'public'
      OR public.is_channel_member(id, auth.uid())
    )
  );
-- INSERT/UPDATE/DELETE policies on chat_channels are unchanged (admin-only).
-- DM/group channels are created via the SECURITY DEFINER RPCs below, which
-- run as the table owner and so are not blocked by the admin-only INSERT
-- policy. Members never INSERT channels directly.

-- ── 4b. RLS: chat_messages (gate private channels by membership) ──────────────
DROP POLICY IF EXISTS "team_members_can_read_messages" ON public.chat_messages;
CREATE POLICY "members_read_messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = auth.uid() AND tm.status = 'active'
    )
    AND (
      NOT public.is_private_channel(channel_id)
      OR public.is_channel_member(channel_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "team_members_can_send_messages" ON public.chat_messages;
CREATE POLICY "members_send_messages"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = auth.uid() AND tm.status = 'active'
    )
    AND (
      NOT public.is_private_channel(channel_id)
      OR public.is_channel_member(channel_id, auth.uid())
    )
  );

-- ── 4c. RLS: chat_channel_members ─────────────────────────────────────────────
-- You can see the roster of any channel you belong to. Writes happen only
-- through the SECURITY DEFINER RPCs (no client INSERT/DELETE policy → denied).
DROP POLICY IF EXISTS "members_read_membership" ON public.chat_channel_members;
CREATE POLICY "members_read_membership"
  ON public.chat_channel_members
  FOR SELECT
  TO authenticated
  USING (public.is_channel_member(channel_id, auth.uid()));

-- ── 5. RPCs ───────────────────────────────────────────────────────────────────
-- 1:1 DM: returns the existing two-person DM channel if one exists, else
-- creates it. Idempotent so opening a DM twice never spawns duplicates.
CREATE OR REPLACE FUNCTION public.find_or_create_dm(p_other uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_me      uuid := auth.uid();
  v_channel uuid;
  v_token   text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_other IS NULL OR p_other = v_me THEN
    RAISE EXCEPTION 'invalid recipient';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE id = v_me AND status = 'active') THEN
    RAISE EXCEPTION 'not a team member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE id = p_other AND status = 'active') THEN
    RAISE EXCEPTION 'recipient not found';
  END IF;

  -- Existing DM with exactly these two members?
  SELECT c.id INTO v_channel
  FROM public.chat_channels c
  WHERE c.kind = 'dm'
    AND (SELECT count(*) FROM public.chat_channel_members m WHERE m.channel_id = c.id) = 2
    AND EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id = c.id AND m.user_id = v_me)
    AND EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id = c.id AND m.user_id = p_other)
  LIMIT 1;

  IF v_channel IS NOT NULL THEN
    RETURN v_channel;
  END IF;

  v_token := 'dm-' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.chat_channels (name, slug, kind, created_by)
  VALUES (v_token, v_token, 'dm', v_me::text)
  RETURNING id INTO v_channel;

  INSERT INTO public.chat_channel_members (channel_id, user_id)
  VALUES (v_channel, v_me), (v_channel, p_other);

  RETURN v_channel;
END;
$$;

-- Group DM: always creates a new private group thread. The caller is added
-- automatically; p_members are de-duplicated and filtered to active members.
CREATE OR REPLACE FUNCTION public.create_group_dm(p_members uuid[], p_title text DEFAULT NULL)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_me      uuid := auth.uid();
  v_channel uuid;
  v_token   text;
  v_ids     uuid[];
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE id = v_me AND status = 'active') THEN
    RAISE EXCEPTION 'not a team member';
  END IF;

  SELECT array_agg(DISTINCT x) INTO v_ids
  FROM unnest(array_append(COALESCE(p_members, '{}'::uuid[]), v_me)) AS x
  WHERE x IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.team_members WHERE id = x AND status = 'active');

  IF v_ids IS NULL OR array_length(v_ids, 1) < 2 THEN
    RAISE EXCEPTION 'need at least 2 participants';
  END IF;

  v_token := 'grp-' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.chat_channels (name, slug, kind, created_by, description)
  VALUES (v_token, v_token, 'group', v_me::text, NULLIF(btrim(COALESCE(p_title, '')), ''))
  RETURNING id INTO v_channel;

  INSERT INTO public.chat_channel_members (channel_id, user_id)
  SELECT v_channel, unnest(v_ids);

  RETURN v_channel;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_private_channel(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_dm(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_dm(uuid[], text)   TO authenticated;

-- ── 5b. Scope the existing forum-notification RPCs to PUBLIC channels ─────────
-- These pre-date DMs and select from chat_channels with no kind filter. Left
-- as-is, DM/group threads would show up in the notifications bell (and get
-- silently marked read by "mark all"), double-counting against the new
-- Messages bell. We re-declare them verbatim plus a `kind = 'public'` filter.
-- (mark_channel_read takes an explicit channel_id and is reused for DMs, so it
--  is intentionally left untouched.)
CREATE OR REPLACE FUNCTION public.get_channel_notifications()
  RETURNS TABLE(channel_id uuid, channel_name text, channel_slug text, unread_count integer,
                latest_id uuid, latest_content text, latest_sender text, latest_initial text,
                latest_created_at timestamptz, last_read_at timestamptz)
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  WITH my_reads AS (
    SELECT r.channel_id, r.last_read_at
    FROM public.chat_channel_reads r
    WHERE r.user_id = auth.uid()
  ),
  latest AS (
    SELECT DISTINCT ON (m.channel_id)
      m.channel_id, m.id, m.content, m.sender_name, m.sender_initial, m.created_at
    FROM public.chat_messages m
    ORDER BY m.channel_id, m.created_at DESC
  )
  SELECT
    c.id, c.name, c.slug,
    (SELECT COUNT(*)::int FROM public.chat_messages m2
       WHERE m2.channel_id = c.id
         AND m2.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)) AS unread_count,
    l.id, l.content, l.sender_name, l.sender_initial, l.created_at, r.last_read_at
  FROM public.chat_channels c
  LEFT JOIN latest l   ON l.channel_id = c.id
  LEFT JOIN my_reads r ON r.channel_id = c.id
  WHERE c.kind = 'public'
  ORDER BY
    (SELECT COUNT(*) FROM public.chat_messages m3
       WHERE m3.channel_id = c.id
         AND m3.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)) DESC,
    l.created_at DESC NULLS LAST,
    c.name ASC;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_channels_read()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_marked_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be signed in' USING ERRCODE = '28000';
  END IF;
  WITH upserted AS (
    INSERT INTO public.chat_channel_reads (user_id, channel_id, last_read_at, updated_at)
    SELECT v_user_id, c.id, now(), now()
    FROM public.chat_channels c
    WHERE c.kind = 'public'
    ON CONFLICT (user_id, channel_id) DO UPDATE
      SET last_read_at = EXCLUDED.last_read_at, updated_at = EXCLUDED.updated_at
    RETURNING 1
  )
  SELECT count(*)::int INTO v_marked_count FROM upserted;
  RETURN jsonb_build_object('success', true, 'channels_marked', v_marked_count);
END;
$$;

-- ── 5c. DM thread list for the Messages bell + Forum DM sidebar ───────────────
-- Returns every private (dm/group) channel the caller belongs to, with the
-- *other* members (for deriving a display label + avatars), the last message
-- preview, and the unread count. SECURITY DEFINER so it can read co-members'
-- names without a per-row client round-trip.
CREATE OR REPLACE FUNCTION public.get_dm_threads()
  RETURNS TABLE(channel_id uuid, kind text, title text, members jsonb, unread_count integer,
                latest_id uuid, latest_content text, latest_sender text,
                latest_created_at timestamptz, last_read_at timestamptz)
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  WITH mine AS (
    SELECT cm.channel_id FROM public.chat_channel_members cm WHERE cm.user_id = auth.uid()
  ),
  latest AS (
    SELECT DISTINCT ON (m.channel_id)
      m.channel_id, m.id, m.content, m.sender_name, m.created_at
    FROM public.chat_messages m
    WHERE m.channel_id IN (SELECT channel_id FROM mine)
    ORDER BY m.channel_id, m.created_at DESC
  )
  SELECT
    c.id, c.kind, c.description AS title,
    (
      SELECT COALESCE(jsonb_agg(
               jsonb_build_object('id', tm.id, 'display_name', tm.display_name, 'avatar_url', tm.avatar_url)
               ORDER BY tm.display_name), '[]'::jsonb)
      FROM public.chat_channel_members cm2
      JOIN public.team_members tm ON tm.id = cm2.user_id
      WHERE cm2.channel_id = c.id AND cm2.user_id <> auth.uid()
    ) AS members,
    (SELECT COUNT(*)::int FROM public.chat_messages m2
       WHERE m2.channel_id = c.id
         AND m2.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)) AS unread_count,
    l.id, l.content, l.sender_name, l.created_at, r.last_read_at
  FROM public.chat_channels c
  JOIN mine ON mine.channel_id = c.id
  LEFT JOIN latest l ON l.channel_id = c.id
  LEFT JOIN public.chat_channel_reads r ON r.channel_id = c.id AND r.user_id = auth.uid()
  WHERE c.kind IN ('dm', 'group')
  ORDER BY l.created_at DESC NULLS LAST, c.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_dm_threads() TO authenticated;

-- ── 6. Realtime: surface channel + membership changes so the thread list
--       updates live (new DM appears, you get added to a group). Wrapped so
--       re-running is a no-op if a table is already in the publication.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channel_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

COMMIT;
