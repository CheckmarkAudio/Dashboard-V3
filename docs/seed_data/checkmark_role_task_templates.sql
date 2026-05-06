-- docs/seed_data/checkmark_role_task_templates.sql
--
-- Editable role-based task templates for Checkmark Audio.
--
-- Purpose:
--   Populate task_templates + task_template_items with practical, real
--   music-studio workflow templates for each job category. These are
--   database rows, not app code, so admins can modify/archive/delete
--   them from the Templates UI after running the script.
--
-- Safe rerun behavior:
--   This script finds each template by exact name + role_tag. If it
--   exists, metadata is updated and its items are replaced with the
--   list below. If it does not exist, it is created. Rerunning after
--   manual edits will overwrite item lists for these template names.
--   Descriptions are intentionally cleared before commit so templates
--   stay title-first in the app and do not render passive subtext.
--
-- How to run:
--   1. Open Supabase SQL Editor for the Checkmark Intern Manager project.
--   2. Paste this whole file into a new query.
--   3. Run it.
--   4. Open Dashboard-V3 → Assign → Templates and edit as needed.
--
-- Notes:
--   - Uses direct table inserts because the SQL Editor usually runs as
--     postgres and does not provide an app auth.uid() for the admin-only
--     RPCs.
--   - created_by is set to the first active admin team member found.
--   - category uses the flywheel stages where practical:
--     Deliver, Capture, Share, Attract, Book.

BEGIN;

CREATE TEMP TABLE _checkmark_template_seed (
  name text NOT NULL,
  description text,
  role_tag text NOT NULL,
  is_onboarding boolean NOT NULL DEFAULT false
) ON COMMIT DROP;

CREATE TEMP TABLE _checkmark_template_item_seed (
  template_name text NOT NULL,
  role_tag text NOT NULL,
  sort_order integer NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  is_required boolean NOT NULL DEFAULT true,
  default_due_offset_days integer
) ON COMMIT DROP;

INSERT INTO _checkmark_template_seed (name, description, role_tag, is_onboarding)
VALUES
  (
    'Engineer Shift Readiness',
    'Core session-prep and wrap tasks for recording/mixing engineers before client-facing work.',
    'engineer',
    false
  ),
  (
    'Marketing Content + Outreach',
    'Repeatable marketing tasks for promoting sessions, publishing content, and keeping booking momentum moving.',
    'marketing',
    false
  ),
  (
    'Media Capture + Asset Prep',
    'Photo, video, and short-form asset tasks for capturing usable studio content around sessions.',
    'media',
    false
  ),
  (
    'Intern Studio Support',
    'Practical intern support tasks for keeping rooms, assets, errands, and daily studio flow organized.',
    'intern',
    true
  ),
  (
    'Dev Dashboard Maintenance',
    'Developer tasks for keeping Dashboard-V3 stable, documented, accessible, and useful for the studio team.',
    'dev',
    false
  ),
  (
    'Admin Daily Operations',
    'Admin tasks for reviewing requests, confirming bookings, communicating with clients, and keeping work moving.',
    'admin',
    false
  ),
  (
    'Ops Studio Readiness',
    'Operations tasks for room readiness, supplies, equipment checks, and end-of-day reset.',
    'ops',
    false
  );

INSERT INTO _checkmark_template_item_seed
  (template_name, role_tag, sort_order, title, description, category, is_required, default_due_offset_days)
VALUES
  -- Engineer
  ('Engineer Shift Readiness', 'engineer', 0,
   'Review today''s session notes and client goals',
   'Read booking notes, references, deliverables, and any client-specific requests before setup.',
   'Deliver', true, 0),
  ('Engineer Shift Readiness', 'engineer', 1,
   'Confirm room routing and session template',
   'Open the correct DAW template, verify inputs, headphone sends, talkback, and session folder location.',
   'Deliver', true, 0),
  ('Engineer Shift Readiness', 'engineer', 2,
   'Run a quick signal check before client arrival',
   'Check mic lines, interface levels, monitoring, cue mix, and record-arm behavior.',
   'Deliver', true, 0),
  ('Engineer Shift Readiness', 'engineer', 3,
   'Capture session notes during the booking',
   'Track takes, client preferences, punch notes, technical issues, and promised follow-ups.',
   'Capture', true, 0),
  ('Engineer Shift Readiness', 'engineer', 4,
   'Export rough bounce or reference mix when needed',
   'Create a clearly named bounce for review if the session requires a same-day reference.',
   'Share', false, 0),
  ('Engineer Shift Readiness', 'engineer', 5,
   'Back up session files before closing',
   'Confirm project folder, audio files, bounces, and notes are saved to the correct storage location.',
   'Deliver', true, 0),
  ('Engineer Shift Readiness', 'engineer', 6,
   'Log follow-up tasks for edits or mix revisions',
   'Create clear next-step tasks for cleanup, tuning, comping, mix pass, or client review.',
   'Book', false, 1),

  -- Marketing
  ('Marketing Content + Outreach', 'marketing', 0,
   'Review recent sessions for content opportunities',
   'Look for approved photos, clips, testimonials, or milestones that could become posts.',
   'Capture', true, 0),
  ('Marketing Content + Outreach', 'marketing', 1,
   'Draft one studio post or story concept',
   'Write a caption angle, hook, and call-to-action tied to Checkmark Audio services.',
   'Share', true, 1),
  ('Marketing Content + Outreach', 'marketing', 2,
   'Update content calendar with next publish date',
   'Place the post idea, platform, asset owner, and due date on the content calendar.',
   'Share', true, 1),
  ('Marketing Content + Outreach', 'marketing', 3,
   'Check inbound messages and booking comments',
   'Review social DMs/comments for potential clients, artist questions, and follow-up needs.',
   'Attract', true, 0),
  ('Marketing Content + Outreach', 'marketing', 4,
   'Follow up with one warm lead or past client',
   'Send a helpful, personal follow-up that points toward booking, review, or next session.',
   'Book', false, 2),
  ('Marketing Content + Outreach', 'marketing', 5,
   'Collect one proof point for future promotion',
   'Save a testimonial, before/after clip, project milestone, or client win for later marketing.',
   'Attract', false, 3),
  ('Marketing Content + Outreach', 'marketing', 6,
   'Report published content and notable engagement',
   'Log what went live, any meaningful responses, and whether it created a booking opportunity.',
   'Share', true, 3),

  -- Media
  ('Media Capture + Asset Prep', 'media', 0,
   'Confirm content consent before capturing',
   'Ask the session lead whether photos/video are allowed and note any client boundaries.',
   'Capture', true, 0),
  ('Media Capture + Asset Prep', 'media', 1,
   'Capture clean horizontal and vertical studio shots',
   'Get usable wide, close, and process shots without interrupting the session flow.',
   'Capture', true, 0),
  ('Media Capture + Asset Prep', 'media', 2,
   'Record one short behind-the-scenes clip',
   'Capture a short, stable clip that shows the studio environment, setup, or artist process.',
   'Capture', false, 0),
  ('Media Capture + Asset Prep', 'media', 3,
   'Cull unusable media before upload',
   'Remove blurry, duplicate, private, or unflattering shots before sharing with the team.',
   'Capture', true, 1),
  ('Media Capture + Asset Prep', 'media', 4,
   'Name and upload selected assets',
   'Use clear filenames with date, client/project, and room when uploading to shared storage.',
   'Share', true, 1),
  ('Media Capture + Asset Prep', 'media', 5,
   'Create one social-ready edit',
   'Prepare a cropped clip/image with safe framing, readable contrast, and no client-sensitive content.',
   'Share', false, 2),
  ('Media Capture + Asset Prep', 'media', 6,
   'Tag media assets by project or campaign',
   'Add project/client/campaign context so marketing can find the assets later.',
   'Attract', false, 2),

  -- Intern
  ('Intern Studio Support', 'intern', 0,
   'Check in with the session lead for priorities',
   'Ask what support is most useful today before starting independent tasks.',
   'Deliver', true, 0),
  ('Intern Studio Support', 'intern', 1,
   'Reset common areas before clients arrive',
   'Tidy lobby, trash, water, chairs, cables, and visible clutter so the studio feels ready.',
   'Book', true, 0),
  ('Intern Studio Support', 'intern', 2,
   'Restock session basics',
   'Check water, pens, tape, labels, batteries, picks, strings, and other frequently used supplies.',
   'Deliver', true, 0),
  ('Intern Studio Support', 'intern', 3,
   'Shadow one studio workflow and take notes',
   'Observe setup, client handoff, session wrap, or file management and write down what you learned.',
   'Capture', false, 1),
  ('Intern Studio Support', 'intern', 4,
   'Organize one assigned storage area',
   'Clean up a cable bin, mic stand area, supply shelf, or small equipment zone.',
   'Deliver', false, 2),
  ('Intern Studio Support', 'intern', 5,
   'Upload or label assigned files/assets',
   'Help label bounces, photos, documents, or intake files using the current naming convention.',
   'Share', false, 2),
  ('Intern Studio Support', 'intern', 6,
   'Send end-of-shift status update',
   'Summarize completed tasks, blockers, and anything the next person should know.',
   'Capture', true, 0),

  -- Dev
  ('Dev Dashboard Maintenance', 'dev', 0,
   'Run startup context before coding',
   'Use the start-session command and note active PRs, branch state, drift, and applicable guardrails.',
   'Capture', true, 0),
  ('Dev Dashboard Maintenance', 'dev', 1,
   'Confirm the requested change category',
   'Decide whether the work is UI polish, behavior, schema, security, data cleanup, or documentation before editing.',
   'Capture', true, 0),
  ('Dev Dashboard Maintenance', 'dev', 2,
   'Use shared tokens/components for UI changes',
   'Route visual changes through index.css, shared classes, or reusable components instead of one-off styling.',
   'Deliver', true, 0),
  ('Dev Dashboard Maintenance', 'dev', 3,
   'Build and check TypeScript when runtime code changes',
   'Run the project build/type checks appropriate to the changed files and record the result.',
   'Deliver', true, 0),
  ('Dev Dashboard Maintenance', 'dev', 4,
   'Verify the changed route in preview',
   'Open the relevant route, check full-page layout, and note any console/runtime issues.',
   'Deliver', true, 0),
  ('Dev Dashboard Maintenance', 'dev', 5,
   'Update docs in the same PR when behavior changes',
   'Keep PROJECT_STATE, SESSION_CONTEXT, or feature docs aligned with meaningful schema/workflow/security changes.',
   'Share', true, 0),
  ('Dev Dashboard Maintenance', 'dev', 6,
   'Call out Supabase migration status',
   'If SQL changed, state whether it was applied, verified, deferred, or needs manual action.',
   'Book', true, 0),

  -- Admin
  ('Admin Daily Operations', 'admin', 0,
   'Review pending task requests',
   'Approve, reject, or ask for clarification on create/edit/delete/transfer requests.',
   'Deliver', true, 0),
  ('Admin Daily Operations', 'admin', 1,
   'Confirm today''s bookings and room assignments',
   'Check schedule, room, engineer, client notes, and any timing changes before the day starts.',
   'Book', true, 0),
  ('Admin Daily Operations', 'admin', 2,
   'Check client communication follow-ups',
   'Review emails, messages, missed calls, and booking questions that need a response.',
   'Book', true, 0),
  ('Admin Daily Operations', 'admin', 3,
   'Assign or rebalance team tasks',
   'Move work to the right person, clarify due dates, and prevent duplicate or stale tasks.',
   'Deliver', true, 0),
  ('Admin Daily Operations', 'admin', 4,
   'Review clock-in/out and shift notes',
   'Look for missing clock events, blockers, or support needs from the team.',
   'Capture', false, 1),
  ('Admin Daily Operations', 'admin', 5,
   'Update booking or client records after changes',
   'Make sure client details, session notes, status, and next steps match reality.',
   'Capture', true, 0),
  ('Admin Daily Operations', 'admin', 6,
   'Close the loop on end-of-day blockers',
   'Record unresolved issues, assign next actions, and make tomorrow''s first step obvious.',
   'Share', true, 0),

  -- Ops
  ('Ops Studio Readiness', 'ops', 0,
   'Walk through each studio room',
   'Check Control Room, Studio A, and Studio B for cleanliness, cables, chairs, and obvious issues.',
   'Deliver', true, 0),
  ('Ops Studio Readiness', 'ops', 1,
   'Check equipment readiness',
   'Confirm headphones, stands, mic clips, adapters, power, and common accessories are in place.',
   'Deliver', true, 0),
  ('Ops Studio Readiness', 'ops', 2,
   'Reset cables and floor paths',
   'Coil loose cables, clear walking paths, and remove trip hazards before client arrival.',
   'Book', true, 0),
  ('Ops Studio Readiness', 'ops', 3,
   'Restock supplies and consumables',
   'Check water, paper goods, batteries, cleaning supplies, labels, tape, and office basics.',
   'Deliver', false, 1),
  ('Ops Studio Readiness', 'ops', 4,
   'Log maintenance or repair needs',
   'Create clear tasks for broken gear, noisy cables, missing parts, or room issues.',
   'Capture', true, 0),
  ('Ops Studio Readiness', 'ops', 5,
   'Prepare room for next scheduled booking',
   'Match room setup to the next client/session type whenever booking notes make that clear.',
   'Book', true, 0),
  ('Ops Studio Readiness', 'ops', 6,
   'Complete end-of-day studio reset',
   'Return rooms to baseline, remove trash, power down appropriate gear, and note anything unfinished.',
   'Deliver', true, 0);

DO $$
DECLARE
  v_admin_id uuid;
  v_template_id uuid;
  template_row record;
  item_row record;
BEGIN
  SELECT id
    INTO v_admin_id
  FROM public.team_members
  WHERE COALESCE(status, 'active') = 'active'
    AND role = 'admin'
  ORDER BY
    CASE WHEN lower(COALESCE(email, '')) = 'checkmarkaudio@gmail.com' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No active admin team member found. Create or activate an admin before seeding templates.';
  END IF;

  FOR template_row IN
    SELECT * FROM _checkmark_template_seed
    ORDER BY name
  LOOP
    SELECT id
      INTO v_template_id
    FROM public.task_templates
    WHERE name = template_row.name
      AND role_tag = template_row.role_tag
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_template_id IS NULL THEN
      INSERT INTO public.task_templates (
        name,
        description,
        role_tag,
        template_kind,
        is_onboarding,
        is_active,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        template_row.name,
        template_row.description,
        template_row.role_tag,
        'admin_blueprint',
        template_row.is_onboarding,
        true,
        v_admin_id,
        now(),
        now()
      )
      RETURNING id INTO v_template_id;
    ELSE
      UPDATE public.task_templates
      SET
        description = template_row.description,
        role_tag = template_row.role_tag,
        template_kind = 'admin_blueprint',
        is_onboarding = template_row.is_onboarding,
        is_active = true,
        updated_at = now()
      WHERE id = v_template_id;

      DELETE FROM public.task_template_items
      WHERE template_id = v_template_id;
    END IF;

    FOR item_row IN
      SELECT *
      FROM _checkmark_template_item_seed
      WHERE template_name = template_row.name
        AND role_tag = template_row.role_tag
      ORDER BY sort_order
    LOOP
      INSERT INTO public.task_template_items (
        template_id,
        title,
        description,
        category,
        sort_order,
        is_required,
        default_due_offset_days,
        created_at,
        updated_at
      )
      VALUES (
        v_template_id,
        item_row.title,
        item_row.description,
        item_row.category,
        item_row.sort_order,
        item_row.is_required,
        item_row.default_due_offset_days,
        now(),
        now()
      );
    END LOOP;
  END LOOP;
END $$;

UPDATE public.task_templates t
SET description = NULL,
    updated_at = now()
WHERE (t.name, t.role_tag) IN (
  ('Engineer Shift Readiness', 'engineer'),
  ('Marketing Content + Outreach', 'marketing'),
  ('Media Capture + Asset Prep', 'media'),
  ('Intern Studio Support', 'intern'),
  ('Dev Dashboard Maintenance', 'dev'),
  ('Admin Daily Operations', 'admin'),
  ('Ops Studio Readiness', 'ops')
);

UPDATE public.task_template_items i
SET description = NULL,
    updated_at = now()
FROM public.task_templates t
WHERE i.template_id = t.id
  AND (t.name, t.role_tag) IN (
    ('Engineer Shift Readiness', 'engineer'),
    ('Marketing Content + Outreach', 'marketing'),
    ('Media Capture + Asset Prep', 'media'),
    ('Intern Studio Support', 'intern'),
    ('Dev Dashboard Maintenance', 'dev'),
    ('Admin Daily Operations', 'admin'),
    ('Ops Studio Readiness', 'ops')
  );

COMMIT;

-- Verification query:
-- Run this after the script to confirm counts.
SELECT
  t.role_tag,
  t.name,
  t.is_onboarding,
  t.is_active,
  count(i.id) AS item_count
FROM public.task_templates t
LEFT JOIN public.task_template_items i ON i.template_id = t.id
WHERE (t.name, t.role_tag) IN (
  ('Engineer Shift Readiness', 'engineer'),
  ('Marketing Content + Outreach', 'marketing'),
  ('Media Capture + Asset Prep', 'media'),
  ('Intern Studio Support', 'intern'),
  ('Dev Dashboard Maintenance', 'dev'),
  ('Admin Daily Operations', 'admin'),
  ('Ops Studio Readiness', 'ops')
)
GROUP BY t.role_tag, t.name, t.is_onboarding, t.is_active
ORDER BY t.role_tag, t.name;
