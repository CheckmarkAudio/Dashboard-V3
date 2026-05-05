# Data Management + Test Data Plan

Date: 2026-05-02

## Why This Exists

The Assign delete incident exposed two operational gaps:

- Vercel preview/deploy success does not apply Supabase SQL migrations.
- Test/demo rows are mixed with real app data, so cleanup requires one-off SQL and careful guessing.

This plan keeps future work aligned with the project cornerstones: clean and DRY code, performance-conscious UI, accessible admin workflows, and secure backend practices.

## Current State

- `clients` already supports archive behavior with an `archived` boolean and archive RPC.
- task templates support active/archive-style toggles through template RPCs.
- `assigned_tasks` does not currently have a first-class archive flag or test-data marker.
- Settings does not yet have a Data Management section.
- Supabase migrations live in `supabase/migrations`, but there is no repo automation that applies them to production when Vercel deploys.

## Recommended Model

Use two related but distinct concepts:

1. `is_test_data`
   - Marks rows intentionally created for demos, development, onboarding, or QA.
   - Excluded from metrics by default.
   - Can be bulk archived or deleted safely.

2. `archived_at`
   - Removes rows from active workflows without destroying history.
   - Preferred default action for potentially meaningful business records.
   - Hard delete should be reserved for test data, corrupted rows, or rows with no audit value.

This is safer than treating every cleanup as a hard delete. It also gives us a future Settings tool that can show exactly what will be affected before acting.

## Schema Direction

Start with the tables that create the most UI noise:

- `assigned_tasks`
- `task_assignment_batches`
- `assignment_recipients`
- `assignment_notifications`
- `task_requests`
- `task_reassign_requests`
- `sessions`
- `clients`
- `projects`
- `artist_pipeline`
- `deliverable_submissions`

Suggested columns for supported tables:

```sql
is_test_data boolean not null default false,
archived_at timestamptz null,
archived_by uuid null references public.team_members(id) on delete set null,
archived_reason text null
```

Not every table needs every column on day one. For dependent/log tables, it may be enough to inherit test-data status from a parent record instead of duplicating flags everywhere.

## Backend Rules

- All cleanup RPCs must be `SECURITY DEFINER`, admin-only, and team-scoped.
- Cleanup RPCs should return counts grouped by table before and after mutation.
- Hard-delete RPCs should require `is_test_data = true` unless a specific break-glass parameter is added later.
- Archive RPCs should update rows in batches and avoid broad unbounded deletes.
- Any destructive action should be scoped by `team_id = get_my_team_id()` or an equivalent proven team ownership path.
- RPCs should set `search_path TO 'public'`.
- Revoke from `PUBLIC` and `anon`; grant only to `authenticated` when the app needs browser access.

## Settings UX

Add a future Settings section called `Data Management`.

Recommended panels:

- `Migration Status`
  - Shows latest app commit/PR note and reminds that Supabase migrations are separate from Vercel deploys.
  - Later can show applied migration versions if we add a migration tracking table.

- `Test Data`
  - Displays counts by table for rows marked `is_test_data`.
  - Actions:
    - Archive test data
    - Permanently delete archived test data
  - Requires typed confirmation, for example `DELETE TEST DATA`.

- `Archive`
  - Shows archived counts by table.
  - Supports restore where business rules allow it.

- `Danger Zone`
  - Hidden behind admin/owner role checks.
  - No broad delete-all button until we have a complete table dependency map.

Accessibility notes:

- Use real buttons, not clickable divs.
- Destructive actions need clear labels, `aria-describedby` warning copy, and keyboard-safe confirmation.
- Counts and table names should be visible text, not color-only signals.

## Supabase Migration Checklist

Use this whenever a PR includes files under `supabase/migrations`.

1. Check whether the PR includes SQL migrations.
2. Review whether migrations are idempotent or safe to rerun.
3. Merge/deploy frontend only after the database change plan is understood.
4. Apply Supabase migrations to the target project.
5. Verify with a read-only SQL query.
6. Then verify in the app preview/production UI.

Important: Vercel green means the frontend built. It does not mean Supabase SQL is live.

For the current manual process, the Supabase dashboard path is:

1. Open Supabase project.
2. Go to SQL Editor.
3. Create a new query.
4. Paste the reviewed SQL.
5. Run read-only preview queries before destructive queries.
6. Run mutation query.
7. Rerun the read-only query to verify the result.

## Future Automation Options

Preferred long-term options:

- Add Supabase CLI configuration and a documented deploy command.
- Add a GitHub Actions workflow that can apply migrations to production with protected environment approval.
- Track applied app-level migrations in a table such as `public.app_migration_log`.

Avoid:

- Assuming Vercel applies DB migrations.
- Using frontend anon keys for admin cleanup.
- Scraping or manual browser automation for database repair.
- Broad `DELETE FROM table` queries without a scoped predicate and preview query.

## Suggested Order Of Work

1. Finish PR #90 and apply its Supabase migrations.
2. Merge PR #91 when social settings are visually approved.
3. Add read-only data inventory SQL to identify test/demo rows.
4. Add `is_test_data` + archive support for `assigned_tasks`.
5. Add Settings > Data Management with counts and archive/delete actions.
6. Expand the model table-by-table only as needed.

## Open Questions

- Should demo/onboarding tasks be retained but hidden, or deleted entirely once the app goes live?
- Should archived assigned tasks remain visible in a member history view?
- Which roles can perform data cleanup: admin only, or owner only?
- Do we want a separate staging Supabase project before more test/demo data is created?
