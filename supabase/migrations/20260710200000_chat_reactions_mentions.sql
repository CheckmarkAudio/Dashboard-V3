-- Forum + DM reactions and @mentions.
--
-- DMs already reuse chat_channels/chat_messages, so reactions and
-- mentions attach once to chat_messages and work for public Forum
-- channels, 1:1 DMs, and group DMs.

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_message_reactions_emoji_len CHECK (char_length(emoji) BETWEEN 1 AND 16),
  CONSTRAINT chat_message_reactions_unique UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS chat_message_reactions_message_idx
  ON public.chat_message_reactions(message_id, created_at);
CREATE INDEX IF NOT EXISTS chat_message_reactions_channel_idx
  ON public.chat_message_reactions(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_message_reactions_user_idx
  ON public.chat_message_reactions(user_id);

CREATE TABLE IF NOT EXISTS public.chat_message_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  mentioned_by uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  mentioned_by_name text NOT NULL,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_message_mentions_unique UNIQUE (message_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS chat_message_mentions_channel_idx
  ON public.chat_message_mentions(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_message_mentions_user_idx
  ON public.chat_message_mentions(mentioned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_message_mentions_by_idx
  ON public.chat_message_mentions(mentioned_by, created_at DESC);

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_reactions_read_visible_messages ON public.chat_message_reactions;
CREATE POLICY chat_reactions_read_visible_messages
  ON public.chat_message_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.id = auth.uid() AND tm.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.chat_messages m
      WHERE m.id = message_id
        AND m.channel_id = channel_id
        AND (
          NOT public.is_private_channel(m.channel_id)
          OR public.is_channel_member(m.channel_id, auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS chat_reactions_insert_own_visible_messages ON public.chat_message_reactions;
CREATE POLICY chat_reactions_insert_own_visible_messages
  ON public.chat_message_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.id = auth.uid() AND tm.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.chat_messages m
      WHERE m.id = message_id
        AND m.channel_id = channel_id
        AND (
          NOT public.is_private_channel(m.channel_id)
          OR public.is_channel_member(m.channel_id, auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS chat_reactions_delete_own ON public.chat_message_reactions;
CREATE POLICY chat_reactions_delete_own
  ON public.chat_message_reactions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS chat_mentions_read_visible_messages ON public.chat_message_mentions;
CREATE POLICY chat_mentions_read_visible_messages
  ON public.chat_message_mentions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.id = auth.uid() AND tm.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.chat_messages m
      WHERE m.id = message_id
        AND m.channel_id = channel_id
        AND (
          NOT public.is_private_channel(m.channel_id)
          OR public.is_channel_member(m.channel_id, auth.uid())
        )
    )
  );

CREATE OR REPLACE FUNCTION public.add_chat_message_mentions(
  p_message_id uuid,
  p_mentioned_user_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_message public.chat_messages%ROWTYPE;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_message
  FROM public.chat_messages
  WHERE id = p_message_id;

  IF v_message.id IS NULL THEN
    RAISE EXCEPTION 'message not found';
  END IF;

  IF v_message.sender_id <> auth.uid()::text THEN
    RAISE EXCEPTION 'only the sender can add mentions for this message';
  END IF;

  WITH mentioned AS (
    SELECT DISTINCT tm.id, tm.display_name
    FROM unnest(COALESCE(p_mentioned_user_ids, '{}'::uuid[])) AS wanted(id)
    JOIN public.team_members tm ON tm.id = wanted.id
    WHERE tm.status = 'active'
      AND tm.id <> auth.uid()
      AND (
        NOT public.is_private_channel(v_message.channel_id)
        OR public.is_channel_member(v_message.channel_id, tm.id)
      )
  ),
  inserted AS (
    INSERT INTO public.chat_message_mentions (
      message_id,
      channel_id,
      mentioned_user_id,
      mentioned_by,
      mentioned_by_name,
      token
    )
    SELECT
      v_message.id,
      v_message.channel_id,
      mentioned.id,
      auth.uid(),
      COALESCE(NULLIF(v_message.sender_name, ''), 'Someone'),
      '@[' || mentioned.display_name || ']'
    FROM mentioned
    ON CONFLICT (message_id, mentioned_user_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.add_chat_message_mentions(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_chat_message_mentions(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_chat_message_mentions(uuid, uuid[]) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_mentions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

COMMIT;
