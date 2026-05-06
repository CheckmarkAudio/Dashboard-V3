# Seed Data

This folder holds optional SQL scripts for editable app content that should live in Supabase rows rather than be hardcoded into React components.

## Role Task Templates

`checkmark_role_task_templates.sql` creates or updates practical task templates for Checkmark Audio job categories:

- Admin
- Dev
- Engineer
- Intern
- Marketing
- Media
- Ops

The script writes to `task_templates` and `task_template_items`, so the resulting templates can be edited, deleted, archived, or rearranged from the app's Templates UI after the script runs. It intentionally clears template and item descriptions before commit so the app stays title-first and does not render passive subtext.

Run it from the Supabase SQL Editor for the Checkmark Intern Manager project. Re-running the script updates these exact template names and replaces their item lists, so do not re-run it after making manual edits unless you want to reset those templates to the scripted version.

`clear_checkmark_role_template_descriptions.sql` is a narrow cleanup helper for already-seeded production data. It only clears descriptions on the exact role templates above and their items; it does not delete templates, tasks, members, bookings, or historical assignments.
