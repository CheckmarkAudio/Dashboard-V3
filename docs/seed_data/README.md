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

The script writes to `task_templates` and `task_template_items`, so the resulting templates can be edited, deleted, archived, or rearranged from the app's Templates UI after the script runs.

Run it from the Supabase SQL Editor for the Checkmark Intern Manager project. Re-running the script updates these exact template names and replaces their item lists, so do not re-run it after making manual edits unless you want to reset those templates to the scripted version.
