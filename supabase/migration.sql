-- ============================================================
-- Checkmark Audio -- Complete Database Schema
-- Run this ONCE in your Supabase SQL Editor (Dashboard > SQL Editor)
--
-- Creates ALL tables, team-scoped RLS policies, helper functions,
-- and auto-fill triggers. Safe to re-run (idempotent).
-- ============================================================


-- =============================================
-- PART 1: FOUNDATION (teams, users, functions)
-- =============================================

-- 1a. Teams
CREATE TABLE IF NOT EXISTS teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO teams (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Checkmark Audio')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_select" ON teams;
CREATE POLICY "team_select" ON teams
  FOR SELECT TO authenticated USING (true);

-- 1b. Users
CREATE TABLE IF NOT EXISTS intern_users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  position text DEFAULT 'intern',
  avatar_url text,
  phone text,
  start_date date,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE intern_users
  ADD COLUMN IF NOT EXISTS team_id uuid
    DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES teams(id);
ALTER TABLE intern_users
  ADD COLUMN IF NOT EXISTS position text DEFAULT 'intern';
ALTER TABLE intern_users
  ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE intern_users
  ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE intern_users
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

UPDATE intern_users
SET team_id = '00000000-0000-0000-0000-000000000001'
WHERE team_id IS NULL;

UPDATE intern_users SET position = 'intern' WHERE position IS NULL;

-- 1c. Helper functions

CREATE OR REPLACE FUNCTION get_my_team_id() RETURNS uuid AS $$
  SELECT COALESCE(
    (SELECT team_id FROM public.intern_users WHERE id = auth.uid()),
    '00000000-0000-0000-0000-000000000001'::uuid
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_team_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.intern_users
    WHERE id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION set_team_id_on_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.team_id IS NULL THEN
    NEW.team_id := get_my_team_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1d. User policies
ALTER TABLE intern_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view team" ON intern_users;
DROP POLICY IF EXISTS "Users can insert own profile" ON intern_users;
DROP POLICY IF EXISTS "Users can update in team" ON intern_users;
DROP POLICY IF EXISTS "Admins can delete users" ON intern_users;

CREATE POLICY "Users can view team" ON intern_users
  FOR SELECT TO authenticated
  USING (team_id = get_my_team_id() OR id = auth.uid());

CREATE POLICY "Users can insert own profile" ON intern_users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update in team" ON intern_users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (team_id = get_my_team_id() AND is_team_admin()));

CREATE POLICY "Admins can delete users" ON intern_users
  FOR DELETE TO authenticated
  USING (team_id = get_my_team_id() AND is_team_admin());


-- =============================================
-- PART 2: CORE TABLES
-- =============================================

-- ---- report_templates ----
CREATE TABLE IF NOT EXISTS report_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('daily', 'weekly', 'checklist')),
  position text,
  fields jsonb NOT NULL DEFAULT '[]',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE report_templates
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);
UPDATE report_templates SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Templates are viewable by authenticated users" ON report_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON report_templates;
DROP POLICY IF EXISTS "report_templates_select" ON report_templates;
DROP POLICY IF EXISTS "report_templates_insert" ON report_templates;
DROP POLICY IF EXISTS "report_templates_update" ON report_templates;
DROP POLICY IF EXISTS "report_templates_delete" ON report_templates;

CREATE POLICY "report_templates_select" ON report_templates
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "report_templates_insert" ON report_templates
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "report_templates_update" ON report_templates
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "report_templates_delete" ON report_templates
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON report_templates;
CREATE TRIGGER set_team_id BEFORE INSERT ON report_templates
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- team_positions (global, no team_id) ----
CREATE TABLE IF NOT EXISTS team_positions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  color text DEFAULT '#C9A84C',
  icon text DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE team_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Positions are viewable by authenticated users" ON team_positions;
DROP POLICY IF EXISTS "Admins can manage positions" ON team_positions;
DROP POLICY IF EXISTS "team_positions_select" ON team_positions;
DROP POLICY IF EXISTS "team_positions_manage" ON team_positions;

CREATE POLICY "team_positions_select" ON team_positions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_positions_manage" ON team_positions
  FOR ALL TO authenticated USING (is_team_admin());

INSERT INTO team_positions (name, display_name, color) VALUES
  ('owner', 'Owner / Lead Engineer', '#C9A84C'),
  ('marketing_admin', 'Marketing / Admin', '#10b981'),
  ('artist_development', 'Artist Development', '#8b5cf6'),
  ('intern', 'Intern', '#6366f1'),
  ('engineer', 'Audio Engineer', '#f59e0b'),
  ('producer', 'Producer', '#f43f5e')
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, color = EXCLUDED.color;

-- ---- task_assignments ----
CREATE TABLE IF NOT EXISTS task_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  intern_id uuid REFERENCES intern_users(id) ON DELETE CASCADE,
  position text,
  is_active boolean DEFAULT true,
  assigned_by uuid REFERENCES intern_users(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT assignment_target CHECK (intern_id IS NOT NULL OR position IS NOT NULL)
);
ALTER TABLE task_assignments
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);
UPDATE task_assignments SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Assignments viewable by authenticated users" ON task_assignments;
DROP POLICY IF EXISTS "Admins can manage assignments" ON task_assignments;
DROP POLICY IF EXISTS "task_assignments_select" ON task_assignments;
DROP POLICY IF EXISTS "task_assignments_insert" ON task_assignments;
DROP POLICY IF EXISTS "task_assignments_update" ON task_assignments;
DROP POLICY IF EXISTS "task_assignments_delete" ON task_assignments;

CREATE POLICY "task_assignments_select" ON task_assignments
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "task_assignments_insert" ON task_assignments
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "task_assignments_update" ON task_assignments
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "task_assignments_delete" ON task_assignments
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON task_assignments;
CREATE TRIGGER set_team_id BEFORE INSERT ON task_assignments
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- platform_metrics ----
CREATE TABLE IF NOT EXISTS platform_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
  metric_date date NOT NULL,
  follower_count integer NOT NULL,
  entered_by uuid REFERENCES intern_users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(platform, metric_date)
);
ALTER TABLE platform_metrics
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);
UPDATE platform_metrics SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Metrics viewable by authenticated users" ON platform_metrics;
DROP POLICY IF EXISTS "Authenticated users can insert metrics" ON platform_metrics;
DROP POLICY IF EXISTS "platform_metrics_select" ON platform_metrics;
DROP POLICY IF EXISTS "platform_metrics_insert" ON platform_metrics;
DROP POLICY IF EXISTS "platform_metrics_update" ON platform_metrics;
DROP POLICY IF EXISTS "platform_metrics_delete" ON platform_metrics;

CREATE POLICY "platform_metrics_select" ON platform_metrics
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "platform_metrics_insert" ON platform_metrics
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "platform_metrics_update" ON platform_metrics
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "platform_metrics_delete" ON platform_metrics
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON platform_metrics;
CREATE TRIGGER set_team_id BEFORE INSERT ON platform_metrics
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- deliverable_submissions ----
CREATE TABLE IF NOT EXISTS deliverable_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  intern_id uuid NOT NULL REFERENCES intern_users(id) ON DELETE CASCADE,
  submission_date date NOT NULL,
  submission_type text NOT NULL,
  dropbox_url text,
  platform_tag text,
  notes text,
  reviewed_by uuid REFERENCES intern_users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE deliverable_submissions
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);
UPDATE deliverable_submissions SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
ALTER TABLE deliverable_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Submissions viewable by authenticated users" ON deliverable_submissions;
DROP POLICY IF EXISTS "Users can insert own submissions" ON deliverable_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON deliverable_submissions;
DROP POLICY IF EXISTS "deliverable_submissions_select" ON deliverable_submissions;
DROP POLICY IF EXISTS "deliverable_submissions_insert" ON deliverable_submissions;
DROP POLICY IF EXISTS "deliverable_submissions_update" ON deliverable_submissions;
DROP POLICY IF EXISTS "deliverable_submissions_delete" ON deliverable_submissions;

CREATE POLICY "deliverable_submissions_select" ON deliverable_submissions
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "deliverable_submissions_insert" ON deliverable_submissions
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "deliverable_submissions_update" ON deliverable_submissions
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "deliverable_submissions_delete" ON deliverable_submissions
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON deliverable_submissions;
CREATE TRIGGER set_team_id BEFORE INSERT ON deliverable_submissions
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- projects ----
CREATE TABLE IF NOT EXISTS projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  client_name text,
  project_type text NOT NULL CHECK (project_type IN ('recording', 'mixing', 'mastering', 'artist_dev', 'education', 'internal')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  assigned_to uuid REFERENCES intern_users(id),
  notes text,
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);
UPDATE projects SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Projects viewable by authenticated users" ON projects;
DROP POLICY IF EXISTS "Admins can manage projects" ON projects;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;

CREATE POLICY "projects_select" ON projects
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "projects_insert" ON projects
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "projects_update" ON projects
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "projects_delete" ON projects
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON projects;
CREATE TRIGGER set_team_id BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- sessions ----
CREATE TABLE IF NOT EXISTS sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  client_name text,
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('recording', 'mixing', 'lesson', 'meeting')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  room text,
  notes text,
  created_by uuid REFERENCES intern_users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);
UPDATE sessions SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sessions viewable by authenticated users" ON sessions;
DROP POLICY IF EXISTS "Admins can manage sessions" ON sessions;
DROP POLICY IF EXISTS "sessions_select" ON sessions;
DROP POLICY IF EXISTS "sessions_insert" ON sessions;
DROP POLICY IF EXISTS "sessions_update" ON sessions;
DROP POLICY IF EXISTS "sessions_delete" ON sessions;

CREATE POLICY "sessions_select" ON sessions
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "sessions_insert" ON sessions
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "sessions_update" ON sessions
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "sessions_delete" ON sessions
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON sessions;
CREATE TRIGGER set_team_id BEFORE INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- artist_pipeline ----
CREATE TABLE IF NOT EXISTS artist_pipeline (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_name text NOT NULL,
  contact_email text,
  contact_phone text,
  stage text NOT NULL DEFAULT 'inquiry' CHECK (stage IN ('inquiry', 'onboarding', 'active', 'release_support', 'alumni')),
  assigned_to uuid REFERENCES intern_users(id),
  notes text,
  next_followup date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE artist_pipeline
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);
UPDATE artist_pipeline SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
ALTER TABLE artist_pipeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pipeline viewable by authenticated users" ON artist_pipeline;
DROP POLICY IF EXISTS "Admins can manage pipeline" ON artist_pipeline;
DROP POLICY IF EXISTS "artist_pipeline_select" ON artist_pipeline;
DROP POLICY IF EXISTS "artist_pipeline_insert" ON artist_pipeline;
DROP POLICY IF EXISTS "artist_pipeline_update" ON artist_pipeline;
DROP POLICY IF EXISTS "artist_pipeline_delete" ON artist_pipeline;

CREATE POLICY "artist_pipeline_select" ON artist_pipeline
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "artist_pipeline_insert" ON artist_pipeline
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "artist_pipeline_update" ON artist_pipeline
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "artist_pipeline_delete" ON artist_pipeline
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON artist_pipeline;
CREATE TRIGGER set_team_id BEFORE INSERT ON artist_pipeline
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- education_students ----
CREATE TABLE IF NOT EXISTS education_students (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name text NOT NULL,
  contact_email text,
  instrument text,
  level text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  assigned_to uuid REFERENCES intern_users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE education_students
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);
UPDATE education_students SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
ALTER TABLE education_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students viewable by authenticated users" ON education_students;
DROP POLICY IF EXISTS "Admins can manage students" ON education_students;
DROP POLICY IF EXISTS "education_students_select" ON education_students;
DROP POLICY IF EXISTS "education_students_insert" ON education_students;
DROP POLICY IF EXISTS "education_students_update" ON education_students;
DROP POLICY IF EXISTS "education_students_delete" ON education_students;

CREATE POLICY "education_students_select" ON education_students
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "education_students_insert" ON education_students
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "education_students_update" ON education_students
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "education_students_delete" ON education_students
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON education_students;
CREATE TRIGGER set_team_id BEFORE INSERT ON education_students
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();


-- =============================================
-- PART 3: TABLES MISSING FROM ORIGINAL SCHEMA
-- =============================================

-- ---- intern_daily_notes ----
CREATE TABLE IF NOT EXISTS intern_daily_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  intern_id uuid NOT NULL REFERENCES intern_users(id) ON DELETE CASCADE,
  note_date date NOT NULL,
  content text NOT NULL,
  focus_areas jsonb NOT NULL DEFAULT '[]',
  submitted_at timestamptz DEFAULT now(),
  manager_reply text,
  team_id uuid REFERENCES teams(id)
);
ALTER TABLE intern_daily_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intern_daily_notes_select" ON intern_daily_notes;
DROP POLICY IF EXISTS "intern_daily_notes_insert" ON intern_daily_notes;
DROP POLICY IF EXISTS "intern_daily_notes_update" ON intern_daily_notes;
DROP POLICY IF EXISTS "intern_daily_notes_delete" ON intern_daily_notes;

CREATE POLICY "intern_daily_notes_select" ON intern_daily_notes
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_daily_notes_insert" ON intern_daily_notes
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "intern_daily_notes_update" ON intern_daily_notes
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_daily_notes_delete" ON intern_daily_notes
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON intern_daily_notes;
CREATE TRIGGER set_team_id BEFORE INSERT ON intern_daily_notes
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- intern_leads ----
CREATE TABLE IF NOT EXISTS intern_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  intern_id uuid NOT NULL REFERENCES intern_users(id) ON DELETE CASCADE,
  contact text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost')),
  amount numeric,
  needs_follow_up boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  team_id uuid REFERENCES teams(id)
);
ALTER TABLE intern_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intern_leads_select" ON intern_leads;
DROP POLICY IF EXISTS "intern_leads_insert" ON intern_leads;
DROP POLICY IF EXISTS "intern_leads_update" ON intern_leads;
DROP POLICY IF EXISTS "intern_leads_delete" ON intern_leads;

CREATE POLICY "intern_leads_select" ON intern_leads
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_leads_insert" ON intern_leads
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "intern_leads_update" ON intern_leads
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_leads_delete" ON intern_leads
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON intern_leads;
CREATE TRIGGER set_team_id BEFORE INSERT ON intern_leads
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- intern_performance_reviews ----
CREATE TABLE IF NOT EXISTS intern_performance_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  intern_id uuid NOT NULL REFERENCES intern_users(id) ON DELETE CASCADE,
  reviewer text NOT NULL,
  review_date date NOT NULL,
  overall_score numeric NOT NULL DEFAULT 0,
  feedback text,
  created_at timestamptz DEFAULT now(),
  team_id uuid REFERENCES teams(id)
);
ALTER TABLE intern_performance_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intern_performance_reviews_select" ON intern_performance_reviews;
DROP POLICY IF EXISTS "intern_performance_reviews_insert" ON intern_performance_reviews;
DROP POLICY IF EXISTS "intern_performance_reviews_update" ON intern_performance_reviews;
DROP POLICY IF EXISTS "intern_performance_reviews_delete" ON intern_performance_reviews;

CREATE POLICY "intern_performance_reviews_select" ON intern_performance_reviews
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_performance_reviews_insert" ON intern_performance_reviews
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "intern_performance_reviews_update" ON intern_performance_reviews
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_performance_reviews_delete" ON intern_performance_reviews
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON intern_performance_reviews;
CREATE TRIGGER set_team_id BEFORE INSERT ON intern_performance_reviews
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- intern_performance_scores ----
CREATE TABLE IF NOT EXISTS intern_performance_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES intern_performance_reviews(id) ON DELETE CASCADE,
  category text NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  team_id uuid REFERENCES teams(id)
);
ALTER TABLE intern_performance_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intern_performance_scores_select" ON intern_performance_scores;
DROP POLICY IF EXISTS "intern_performance_scores_insert" ON intern_performance_scores;
DROP POLICY IF EXISTS "intern_performance_scores_update" ON intern_performance_scores;
DROP POLICY IF EXISTS "intern_performance_scores_delete" ON intern_performance_scores;

CREATE POLICY "intern_performance_scores_select" ON intern_performance_scores
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_performance_scores_insert" ON intern_performance_scores
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "intern_performance_scores_update" ON intern_performance_scores
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_performance_scores_delete" ON intern_performance_scores
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON intern_performance_scores;
CREATE TRIGGER set_team_id BEFORE INSERT ON intern_performance_scores
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- intern_schedule_templates ----
CREATE TABLE IF NOT EXISTS intern_schedule_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  intern_id uuid NOT NULL REFERENCES intern_users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  focus_areas jsonb NOT NULL DEFAULT '[]',
  frequency text NOT NULL DEFAULT 'weekly',
  team_id uuid REFERENCES teams(id)
);
ALTER TABLE intern_schedule_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intern_schedule_templates_select" ON intern_schedule_templates;
DROP POLICY IF EXISTS "intern_schedule_templates_insert" ON intern_schedule_templates;
DROP POLICY IF EXISTS "intern_schedule_templates_update" ON intern_schedule_templates;
DROP POLICY IF EXISTS "intern_schedule_templates_delete" ON intern_schedule_templates;

CREATE POLICY "intern_schedule_templates_select" ON intern_schedule_templates
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_schedule_templates_insert" ON intern_schedule_templates
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "intern_schedule_templates_update" ON intern_schedule_templates
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_schedule_templates_delete" ON intern_schedule_templates
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON intern_schedule_templates;
CREATE TRIGGER set_team_id BEFORE INSERT ON intern_schedule_templates
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- intern_checklist_instances ----
CREATE TABLE IF NOT EXISTS intern_checklist_instances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  intern_id uuid NOT NULL REFERENCES intern_users(id) ON DELETE CASCADE,
  frequency text NOT NULL,
  period_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  team_id uuid REFERENCES teams(id)
);
ALTER TABLE intern_checklist_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intern_checklist_instances_select" ON intern_checklist_instances;
DROP POLICY IF EXISTS "intern_checklist_instances_insert" ON intern_checklist_instances;
DROP POLICY IF EXISTS "intern_checklist_instances_update" ON intern_checklist_instances;
DROP POLICY IF EXISTS "intern_checklist_instances_delete" ON intern_checklist_instances;

CREATE POLICY "intern_checklist_instances_select" ON intern_checklist_instances
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_checklist_instances_insert" ON intern_checklist_instances
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "intern_checklist_instances_update" ON intern_checklist_instances
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_checklist_instances_delete" ON intern_checklist_instances
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON intern_checklist_instances;
CREATE TRIGGER set_team_id BEFORE INSERT ON intern_checklist_instances
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();

-- ---- intern_checklist_items ----
CREATE TABLE IF NOT EXISTS intern_checklist_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES intern_checklist_instances(id) ON DELETE CASCADE,
  category text NOT NULL,
  item_text text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  is_critical boolean DEFAULT false,
  team_id uuid REFERENCES teams(id)
);
ALTER TABLE intern_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intern_checklist_items_select" ON intern_checklist_items;
DROP POLICY IF EXISTS "intern_checklist_items_insert" ON intern_checklist_items;
DROP POLICY IF EXISTS "intern_checklist_items_update" ON intern_checklist_items;
DROP POLICY IF EXISTS "intern_checklist_items_delete" ON intern_checklist_items;

CREATE POLICY "intern_checklist_items_select" ON intern_checklist_items
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_checklist_items_insert" ON intern_checklist_items
  FOR INSERT TO authenticated WITH CHECK (team_id = get_my_team_id());
CREATE POLICY "intern_checklist_items_update" ON intern_checklist_items
  FOR UPDATE TO authenticated USING (team_id = get_my_team_id());
CREATE POLICY "intern_checklist_items_delete" ON intern_checklist_items
  FOR DELETE TO authenticated USING (team_id = get_my_team_id());

DROP TRIGGER IF EXISTS set_team_id ON intern_checklist_items;
CREATE TRIGGER set_team_id BEFORE INSERT ON intern_checklist_items
  FOR EACH ROW EXECUTE FUNCTION set_team_id_on_insert();
