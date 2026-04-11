-- ============================================================================
-- Migration: 20260411_link_profiles_cascade
--
-- STATUS: APPLIED to production (project ncljfjdcyswoeitsooty) on 2026-04-11
--         via the Supabase Management API. This file is kept on disk as the
--         authoritative record of what was run — DO NOT re-run it casually;
--         it's idempotent but there's no reason to.
--
-- PURPOSE
--   Fix the "pre-seeded profile linking" bug in AuthContext.fetchProfile /
--   AuthContext.signUp (Intern-Dashboard Phase 1.2). The client code used to
--   attempt `UPDATE intern_users SET id = auth.uid() WHERE id = <seed_id>`,
--   which silently failed because every FK referencing intern_users(id) was
--   defined without ON UPDATE CASCADE. This migration rewrites every
--   actually-existing FK to carry ON UPDATE CASCADE while preserving the
--   existing ON DELETE behaviour.
--
-- SCHEMA DRIFT NOTES
--   The live database (inspected via information_schema.referential_constraints)
--   differs from `supabase/migration.sql` in several places:
--
--     * intern_leads uses `created_by` instead of `intern_id`, and has a
--       completely different column set (name, lead_type, contact_info,
--       social_links, follow_up_date, …). The legacy migration.sql file
--       is WRONG about this table.
--
--     * intern_schedule_templates has NO user-link column at all in prod —
--       no intern_id, no created_by. Rows are scoped only by team_id. The
--       src/pages/Schedule.tsx client code queries `.eq('intern_id', …)`
--       on this table, which means that code path is broken against the
--       current schema. Flagged for Phase 4 cleanup, NOT fixed in this
--       migration.
--
--     * intern_lead_activities is a real table in prod that the legacy
--       migration.sql doesn't mention at all.
--
--     * intern_performance_reviews.reviewer_id is a real uuid FK in prod;
--       the legacy file declares it as a plain `text` column.
--
--   Until Phase 4 regenerates the Supabase types from the live schema,
--   treat `supabase/migration.sql` as historical documentation only.
-- ============================================================================

-- task_assignments
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

-- platform_metrics
ALTER TABLE platform_metrics
  DROP CONSTRAINT IF EXISTS platform_metrics_entered_by_fkey,
  ADD  CONSTRAINT platform_metrics_entered_by_fkey
    FOREIGN KEY (entered_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- deliverable_submissions
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

-- projects
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_assigned_to_fkey,
  ADD  CONSTRAINT projects_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- sessions
ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_created_by_fkey,
  ADD  CONSTRAINT sessions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- artist_pipeline
ALTER TABLE artist_pipeline
  DROP CONSTRAINT IF EXISTS artist_pipeline_assigned_to_fkey,
  ADD  CONSTRAINT artist_pipeline_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- education_students
ALTER TABLE education_students
  DROP CONSTRAINT IF EXISTS education_students_assigned_to_fkey,
  ADD  CONSTRAINT education_students_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- intern_daily_notes
ALTER TABLE intern_daily_notes
  DROP CONSTRAINT IF EXISTS intern_daily_notes_intern_id_fkey,
  ADD  CONSTRAINT intern_daily_notes_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- intern_leads (uses created_by, NOT intern_id — schema drift)
ALTER TABLE intern_leads
  DROP CONSTRAINT IF EXISTS intern_leads_created_by_fkey,
  ADD  CONSTRAINT intern_leads_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- intern_lead_activities (table only exists in live schema)
ALTER TABLE intern_lead_activities
  DROP CONSTRAINT IF EXISTS intern_lead_activities_created_by_fkey,
  ADD  CONSTRAINT intern_lead_activities_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- intern_performance_reviews
ALTER TABLE intern_performance_reviews
  DROP CONSTRAINT IF EXISTS intern_performance_reviews_intern_id_fkey,
  ADD  CONSTRAINT intern_performance_reviews_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE intern_performance_reviews
  DROP CONSTRAINT IF EXISTS intern_performance_reviews_reviewer_id_fkey,
  ADD  CONSTRAINT intern_performance_reviews_reviewer_id_fkey
    FOREIGN KEY (reviewer_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- intern_checklist_instances
ALTER TABLE intern_checklist_instances
  DROP CONSTRAINT IF EXISTS intern_checklist_instances_intern_id_fkey,
  ADD  CONSTRAINT intern_checklist_instances_intern_id_fkey
    FOREIGN KEY (intern_id) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- intern_users.managed_by (self-reference)
ALTER TABLE intern_users
  DROP CONSTRAINT IF EXISTS intern_users_managed_by_fkey,
  ADD  CONSTRAINT intern_users_managed_by_fkey
    FOREIGN KEY (managed_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- member_kpis
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

-- member_kpi_entries
ALTER TABLE member_kpi_entries
  DROP CONSTRAINT IF EXISTS member_kpi_entries_entered_by_fkey,
  ADD  CONSTRAINT member_kpi_entries_entered_by_fkey
    FOREIGN KEY (entered_by) REFERENCES intern_users(id)
    ON UPDATE CASCADE;

-- weekly_admin_reviews
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

-- Guardrail: enforce lowercase emails at the database layer so no tool can
-- insert mixed-case emails and drift from the RLS lower(email) comparisons.
UPDATE intern_users SET email = lower(email) WHERE email <> lower(email);

ALTER TABLE intern_users
  DROP CONSTRAINT IF EXISTS intern_users_email_lowercase_check,
  ADD  CONSTRAINT intern_users_email_lowercase_check
    CHECK (email = lower(email));
