-- ============================================================================
-- Migration: 20260411_enforce_lowercase_lead_email
--
-- STATUS: APPLIED to production (project ncljfjdcyswoeitsooty) on 2026-04-11
--
-- PURPOSE
--   Mirror the email-lowercase guardrail we already have on intern_users,
--   so any tool that writes to intern_leads.email must provide a normalized
--   value. The client-side normalization is wired through
--   src/lib/email.ts#normalizeEmail and called from src/pages/Leads.tsx, so
--   this constraint will only ever fire if a stray write bypasses the
--   client (dashboard, psql, future edge function, etc.).
-- ============================================================================

UPDATE intern_leads
SET    email = lower(email)
WHERE  email IS NOT NULL AND email <> lower(email);

ALTER TABLE intern_leads
  DROP CONSTRAINT IF EXISTS intern_leads_email_lowercase_check,
  ADD  CONSTRAINT intern_leads_email_lowercase_check
    CHECK (email IS NULL OR email = lower(email));
