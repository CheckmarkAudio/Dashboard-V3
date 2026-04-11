-- ============================================================================
-- Migration: 20260411_reconcile_leads_and_schedule_schema
--
-- STATUS: APPLIED to production (project ncljfjdcyswoeitsooty) on 2026-04-11
--
-- PURPOSE
--   Reconcile schema drift between the live database and what the client
--   code under src/pages/Leads.tsx and src/pages/Schedule.tsx expects.
--
--   Before this migration:
--     * intern_leads had `name` and `lead_type` as NOT NULL and used
--       `contact_info`, `social_links`, `follow_up_date`, `created_by` —
--       nothing like what the Leads.tsx UI renders. Every insert from the
--       client failed with "column does not exist" or NOT NULL violations.
--
--     * intern_schedule_templates had NO user-link column at all (no
--       intern_id, no created_by), while Schedule.tsx explicitly queries
--       and inserts with `intern_id` and `frequency`. Every add-schedule
--       action failed.
--
--   Strategy
--     * intern_leads was empty (0 rows), so it's safe to drop the legacy
--       NOT NULLs and add the client-expected columns in place.
--     * intern_schedule_templates had 5 real rows, so we only ADD the
--       missing columns (nullable) — existing rows stay put but don't
--       have an owner until an admin assigns one through the UI.
-- ============================================================================

-- ---- intern_leads: reshape to match client UI ------------------------------
ALTER TABLE intern_leads
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN lead_type DROP NOT NULL;

ALTER TABLE intern_leads
  ADD COLUMN IF NOT EXISTS contact text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium'
    CHECK (priority IS NULL OR priority IN ('low','medium','high')),
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS intern_id uuid;

ALTER TABLE intern_leads
  DROP CONSTRAINT IF EXISTS intern_leads_intern_id_fkey,
  ADD  CONSTRAINT intern_leads_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- ---- intern_schedule_templates: add missing client columns ----------------
ALTER TABLE intern_schedule_templates
  ADD COLUMN IF NOT EXISTS intern_id uuid,
  ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'weekly';

ALTER TABLE intern_schedule_templates
  DROP CONSTRAINT IF EXISTS intern_schedule_templates_intern_id_fkey,
  ADD  CONSTRAINT intern_schedule_templates_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
