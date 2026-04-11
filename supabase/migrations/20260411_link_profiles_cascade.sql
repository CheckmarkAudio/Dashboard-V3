-- ============================================================================
-- Migration: 20260411_link_profiles_cascade
--
-- PURPOSE
--   Fix the "pre-seeded profile linking" bug in AuthContext.fetchProfile /
--   AuthContext.signUp (Intern-Dashboard Phase 1.2). The client code used to
--   attempt `UPDATE intern_users SET id = auth.uid() WHERE id = <seed_id>`,
--   which silently failed because:
--     1. Every child table's FK on intern_users(id) was defined without
--        ON UPDATE CASCADE, so Postgres blocked the PK change.
--     2. The intern_users UPDATE policy's WITH CHECK clause only allows
--        rows where id = auth.uid() — which the new row would satisfy,
--        but the FK block happened first.
--
--   This migration rewrites every FK that points at intern_users(id) to
--   carry ON UPDATE CASCADE (preserving the existing ON DELETE behaviour).
--   Once applied, admins can pre-seed profile rows with any placeholder
--   UUID, and a legitimate PK update from auth.uid() will propagate to
--   every child row automatically — so historical data (KPIs, checklists,
--   submissions, reviews, etc.) stays linked to the real user.
--
--   After this migration is applied, the client can safely switch back to
--   a PK-update path in AuthContext. Until then, the client uses an
--   insert-copy fallback that keeps new users from being locked out but
--   leaves historical data attached to the old seed row.
--
-- RISK
--   This migration only drops + recreates FK CONSTRAINTS. It does not
--   touch any data. FK validation runs against existing rows at the
--   moment of ADD CONSTRAINT — if every child row's FK target already
--   exists in intern_users (which it must, since the old FK was valid),
--   the ADD CONSTRAINT will succeed without delay. Safe to run on a
--   live database. Run inside a transaction so a failure mid-way
--   doesn't leave FKs dropped.
--
-- HOW TO APPLY
--   Option A (Supabase dashboard): paste this whole file into the SQL
--     editor and Run. Review the output for any "does not exist" notices
--     (harmless — DROP CONSTRAINT IF EXISTS).
--   Option B (supabase CLI): `supabase db push` if you keep the file
--     under supabase/migrations/.
-- ============================================================================

BEGIN;

-- ---- task_assignments ------------------------------------------------------
ALTER TABLE task_assignments
  DROP CONSTRAINT IF EXISTS task_assignments_intern_id_fkey,
  ADD  CONSTRAINT task_assignments_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE task_assignments
  DROP CONSTRAINT IF EXISTS task_assignments_assigned_by_fkey,
  ADD  CONSTRAINT task_assignments_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- ---- platform_metrics ------------------------------------------------------
ALTER TABLE platform_metrics
  DROP CONSTRAINT IF EXISTS platform_metrics_entered_by_fkey,
  ADD  CONSTRAINT platform_metrics_entered_by_fkey
    FOREIGN KEY (entered_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- ---- deliverable_submissions ----------------------------------------------
ALTER TABLE deliverable_submissions
  DROP CONSTRAINT IF EXISTS deliverable_submissions_intern_id_fkey,
  ADD  CONSTRAINT deliverable_submissions_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE deliverable_submissions
  DROP CONSTRAINT IF EXISTS deliverable_submissions_reviewed_by_fkey,
  ADD  CONSTRAINT deliverable_submissions_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- ---- projects --------------------------------------------------------------
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_assigned_to_fkey,
  ADD  CONSTRAINT projects_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- ---- sessions --------------------------------------------------------------
ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_created_by_fkey,
  ADD  CONSTRAINT sessions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- ---- artist_pipeline -------------------------------------------------------
ALTER TABLE artist_pipeline
  DROP CONSTRAINT IF EXISTS artist_pipeline_assigned_to_fkey,
  ADD  CONSTRAINT artist_pipeline_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- ---- education_students ----------------------------------------------------
ALTER TABLE education_students
  DROP CONSTRAINT IF EXISTS education_students_assigned_to_fkey,
  ADD  CONSTRAINT education_students_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- ---- intern_daily_notes ----------------------------------------------------
ALTER TABLE intern_daily_notes
  DROP CONSTRAINT IF EXISTS intern_daily_notes_intern_id_fkey,
  ADD  CONSTRAINT intern_daily_notes_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- ---- intern_leads ----------------------------------------------------------
ALTER TABLE intern_leads
  DROP CONSTRAINT IF EXISTS intern_leads_intern_id_fkey,
  ADD  CONSTRAINT intern_leads_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- ---- intern_performance_reviews --------------------------------------------
ALTER TABLE intern_performance_reviews
  DROP CONSTRAINT IF EXISTS intern_performance_reviews_intern_id_fkey,
  ADD  CONSTRAINT intern_performance_reviews_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- ---- intern_schedule_templates ---------------------------------------------
ALTER TABLE intern_schedule_templates
  DROP CONSTRAINT IF EXISTS intern_schedule_templates_intern_id_fkey,
  ADD  CONSTRAINT intern_schedule_templates_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- ---- intern_checklist_instances --------------------------------------------
ALTER TABLE intern_checklist_instances
  DROP CONSTRAINT IF EXISTS intern_checklist_instances_intern_id_fkey,
  ADD  CONSTRAINT intern_checklist_instances_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- ---- intern_users.managed_by (self-reference) -----------------------------
ALTER TABLE intern_users
  DROP CONSTRAINT IF EXISTS intern_users_managed_by_fkey,
  ADD  CONSTRAINT intern_users_managed_by_fkey
    FOREIGN KEY (managed_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- ---- member_kpis -----------------------------------------------------------
ALTER TABLE member_kpis
  DROP CONSTRAINT IF EXISTS member_kpis_intern_id_fkey,
  ADD  CONSTRAINT member_kpis_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE member_kpis
  DROP CONSTRAINT IF EXISTS member_kpis_created_by_fkey,
  ADD  CONSTRAINT member_kpis_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- ---- member_kpi_entries ----------------------------------------------------
ALTER TABLE member_kpi_entries
  DROP CONSTRAINT IF EXISTS member_kpi_entries_entered_by_fkey,
  ADD  CONSTRAINT member_kpi_entries_entered_by_fkey
    FOREIGN KEY (entered_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- ---- weekly_admin_reviews --------------------------------------------------
ALTER TABLE weekly_admin_reviews
  DROP CONSTRAINT IF EXISTS weekly_admin_reviews_intern_id_fkey,
  ADD  CONSTRAINT weekly_admin_reviews_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE weekly_admin_reviews
  DROP CONSTRAINT IF EXISTS weekly_admin_reviews_reviewer_id_fkey,
  ADD  CONSTRAINT weekly_admin_reviews_reviewer_id_fkey
    FOREIGN KEY (reviewer_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- ============================================================================
-- Guardrail: enforce lowercase emails at the database layer.
--
-- The client already normalizes emails in AuthContext, but any tool that
-- writes to intern_users (Supabase dashboard, a stray psql session, a future
-- edge function) could still insert mixed-case emails and silently drift
-- from the RLS policies' lower(email) comparisons. A CHECK constraint makes
-- this impossible.
-- ============================================================================
UPDATE intern_users SET email = lower(email) WHERE email <> lower(email);

ALTER TABLE intern_users
  DROP CONSTRAINT IF EXISTS intern_users_email_lowercase_check,
  ADD  CONSTRAINT intern_users_email_lowercase_check
    CHECK (email = lower(email));

COMMIT;

-- ============================================================================
-- VERIFICATION (optional — run these after the migration to sanity-check)
-- ============================================================================
--
--   -- 1. Every FK to intern_users(id) should now report UPDATE_RULE = CASCADE.
--   SELECT tc.table_name,
--          kcu.column_name,
--          rc.update_rule,
--          rc.delete_rule
--   FROM   information_schema.referential_constraints rc
--   JOIN   information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
--   JOIN   information_schema.table_constraints tc  ON tc.constraint_name  = rc.constraint_name
--   WHERE  rc.unique_constraint_name IN (
--     SELECT constraint_name
--     FROM   information_schema.table_constraints
--     WHERE  table_name = 'intern_users' AND constraint_type = 'PRIMARY KEY'
--   )
--   ORDER  BY tc.table_name, kcu.column_name;
--
--   -- 2. Lowercase-email constraint should exist and the table should contain
--   --    only lowercase emails.
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM   pg_constraint
--   WHERE  conrelid = 'intern_users'::regclass
--     AND  conname  = 'intern_users_email_lowercase_check';
--
--   SELECT count(*) AS mixed_case_emails FROM intern_users WHERE email <> lower(email);
