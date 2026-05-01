-- Tighten RLS on chat_channels + chat_messages.
--
-- Why: the original policies (created early in the chat schema's life)
-- had `polroles = {-}` (PUBLIC) with `USING true` / `WITH CHECK true`,
-- which Supabase advisors flagged as `rls_policy_always_true`.
-- Practical risk:
--   1. Anyone with the anon key (which is shipped in the JS bundle by
--      design) could read OR insert chat messages without authenticating.
--   2. Even authenticated callers could insert with any `sender_id` —
--      no impersonation check.
--   3. The "Admins can manage channels" policy was misnamed — it
--      applied to PUBLIC role with USING true, not to admins.
--
-- This migration replaces the four wide-open policies with auth-scoped
-- equivalents that match the app's actual usage (read + insert only on
-- both tables; channel mutations are admin-only). UPDATE/DELETE on
-- chat_messages remain disallowed — the app doesn't expose edit/delete
-- and we don't want to add surface here that nothing exercises.
--
-- Chat tables are single-tenant (no `team_id` column on either) so the
-- policy floor is "authenticated active team member" rather than
-- team-scoped. If multi-tenant ever lands, scope by team_id instead.
--
-- Rollback: drop the new policies + recreate the originals (see commit
-- diff). No table data is touched.

BEGIN;

-- ── chat_channels ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Anyone can read channels" ON public.chat_channels;

CREATE POLICY "team_members_can_read_channels"
  ON public.chat_channels
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- Admins only — channel mutation is an admin-tier operation.
CREATE POLICY "admins_can_insert_channels"
  ON public.chat_channels
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_team_admin());

CREATE POLICY "admins_can_update_channels"
  ON public.chat_channels
  FOR UPDATE
  TO authenticated
  USING (public.is_team_admin())
  WITH CHECK (public.is_team_admin());

CREATE POLICY "admins_can_delete_channels"
  ON public.chat_channels
  FOR DELETE
  TO authenticated
  USING (public.is_team_admin());

-- ── chat_messages ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can send messages" ON public.chat_messages;

CREATE POLICY "team_members_can_read_messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- The impersonation fix: sender_id MUST equal auth.uid()::text.
-- (Column is text not uuid, hence the cast.) Combined with the
-- team_members membership check, this means a caller can only insert
-- a message authored by themselves, and only if they're an active
-- team member.
CREATE POLICY "team_members_can_send_messages"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = auth.uid()
        AND tm.status = 'active'
    )
  );

COMMIT;
