-- Add 'pending' as a valid status for team_members.
--
-- 'pending' = invited but hasn't completed account setup yet (hasn't
-- clicked their invite link and set a password). Status auto-flips to
-- 'active' on first successful login via AuthContext + RecoveryGate.
--
-- Also tightens the column to reject garbage values — previously the
-- column was unconstrained plain text.

ALTER TABLE team_members
  ALTER COLUMN status SET DEFAULT 'pending',
  ADD CONSTRAINT team_members_status_check
    CHECK (status IN ('active', 'inactive', 'pending'));

-- Existing rows with status = 'active' or 'inactive' are fine.
-- Any stray nulls get patched to 'active' (they were clearly provisioned
-- and active before this migration ran).
UPDATE team_members SET status = 'active' WHERE status IS NULL OR status NOT IN ('active', 'inactive', 'pending');
