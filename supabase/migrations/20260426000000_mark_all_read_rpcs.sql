-- PR #48 — Tier 2 / Mark-all-read.
--
-- Two bulk-acknowledge RPCs so the Notifications widget can clear
-- every unread item in one click:
--   1. mark_all_channels_read()
--      Upserts a chat_channel_reads row per channel for the caller,
--      flipping last_read_at + updated_at to now(). Idempotent — a
--      second call within the same second is a no-op (timestamps
--      just refresh).
--   2. mark_all_assignment_notifications_read()
--      Bulk UPDATE on assignment_notifications WHERE recipient_id =
--      auth.uid() AND is_read = false. Returns the row count.
--
-- Both run as SECURITY DEFINER with search_path locked to public, and
-- both reject anonymous callers (auth.uid() IS NULL → 28000). They
-- only ever touch rows the caller owns — no admin override needed
-- since "mark MY notifications" is purely a self-service action.

CREATE OR REPLACE FUNCTION public.mark_all_channels_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_marked_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be signed in'
      USING ERRCODE = '28000';
  END IF;

  WITH upserted AS (
    INSERT INTO public.chat_channel_reads (user_id, channel_id, last_read_at, updated_at)
    SELECT v_user_id, c.id, now(), now()
    FROM public.chat_channels c
    ON CONFLICT (user_id, channel_id) DO UPDATE
      SET last_read_at = EXCLUDED.last_read_at,
          updated_at   = EXCLUDED.updated_at
    RETURNING 1
  )
  SELECT count(*)::int INTO v_marked_count FROM upserted;

  RETURN jsonb_build_object(
    'success',         true,
    'channels_marked', v_marked_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_assignment_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_marked_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be signed in'
      USING ERRCODE = '28000';
  END IF;

  UPDATE public.assignment_notifications
  SET is_read = true,
      read_at = COALESCE(read_at, now())
  WHERE recipient_id = v_user_id
    AND is_read = false;

  GET DIAGNOSTICS v_marked_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',              true,
    'notifications_marked', v_marked_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_channels_read()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_assignment_notifications_read()    TO authenticated;
