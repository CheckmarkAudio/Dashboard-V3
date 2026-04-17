# Rollback Playbook

What to do if something breaks at each phase.

## Phase 1 failure — migration SQL errored

**What it looks like**: `apply_migration` returns an error; `execute_sql` queries against `team_*` names fail with "relation does not exist."

**What happened**: The transaction auto-rolled-back. The database is in its pre-migration state. Nothing to undo.

**Action**:
1. Read the error carefully — usually a specific statement failed (bad column reference, policy conflict, etc.)
2. Fix that one statement in the migration SQL
3. Re-run
4. Do NOT attempt a "partial" migration (don't comment out the failing part) — the whole thing must succeed atomically

## Phase 2 failure — a page breaks after code sweep

**What it looks like**: Vercel deploys, you load a page, it errors in the console or shows empty data.

**Action**:
1. Because compat views exist, the DB side is not the issue — check the browser console for the specific query/error
2. If it's a missed `intern_*` reference in code, just fix that file and push — the compat view means users weren't actually broken, they were querying the view transparently
3. If the error is a column name you renamed (e.g. `intern_id` → `member_id`), grep the codebase for the old column name and update missed references
4. If multiple things are broken, don't panic-revert — the compat views give you time to fix forward

## Phase 2 failure — widespread / cannot diagnose quickly

**Action**:
1. Revert the code changes: `git revert <commit-range>` and push
2. The compat views mean the DB is still fine — reverted code will work normally
3. Diagnose offline before retrying

## Nuclear option — full DB restore

Only if something truly catastrophic happened (shouldn't be possible given compat views and atomic migration, but documented for completeness):

1. Supabase Dashboard → Database → Backups → Restore from today's backup
2. This reverts ALL data to the backup point. Any forum posts, sessions, etc. created since the backup are lost.
3. Re-deploy the code from commit `473f04c` (pre-rename).

The local JSON export in `backups/` can be replayed via generated `INSERT` statements if needed, but only for specific tables — it's a targeted recovery, not a full restore.

## What each safety net actually protects against

| Failure mode | Caught by |
|---|---|
| Typo in migration SQL | Atomic transaction (auto-rollback) |
| Missed code reference | Compat views (query passes through) |
| Bad deploy to Vercel | `git revert` + redeploy (compat views keep DB valid) |
| DB data corruption | Supabase dashboard backup restore |
| Row-level loss of specific tables | Local JSON export in `backups/` |

If a failure mode isn't in this table, pause and think before acting.
