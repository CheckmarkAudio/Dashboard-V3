# Execution Steps

Confirm with the user before each **mutation** step (marked ⚠️). Read-only steps (marked ✓) can run without pausing.

---

## Step 1 — Verify starting state ✓

- Run `git log -1 --oneline` — must show `473f04c Analytics Reform`. If not, STOP and tell the user.
- Run `git status` — must be clean. If not, STOP.
- Ask user to confirm Supabase dashboard backups look good (one sentence reply expected: "backups look good" or similar).

## Step 2 — Enumerate scope ✓

Before writing any migration, build the actual rename list:

- `list_tables` via Supabase MCP to get all `intern_*` tables + columns
- `execute_sql` to list all RLS policies referencing intern_* names:
  ```sql
  SELECT schemaname, tablename, policyname, qual, with_check
  FROM pg_policies
  WHERE qual LIKE '%intern%' OR with_check LIKE '%intern%' OR policyname LIKE '%intern%';
  ```
- `execute_sql` for functions:
  ```sql
  SELECT proname, pg_get_functiondef(oid) FROM pg_proc
  WHERE pg_get_functiondef(oid) LIKE '%intern%' AND pronamespace = 'public'::regnamespace;
  ```
- Grep the codebase: `Grep pattern="intern_" output_mode="files_with_matches"` and count matches per file

Show the user the full list before proceeding. They may want to tweak the name mapping.

## Step 3 — Local JSON export ⚠️ (read-only from DB, but writes to disk)

Create `backups/` at repo root. For every non-empty `intern_*` table AND every table with `intern_*` FK columns, write a timestamped JSON file:

```
backups/2026-04-17-intern_users.json
backups/2026-04-17-sessions.json
...
```

Confirm with user: "Export complete, N tables, X rows total. Ready to review the migration?"

## Step 4 — Draft the migration ⚠️ (no execution yet)

Write the full rename as a single SQL block. Include:

- `BEGIN;` at top, `COMMIT;` at bottom
- All `ALTER TABLE ... RENAME TO` statements
- All `ALTER TABLE ... RENAME COLUMN` statements for `intern_id` → `member_id` etc.
- All `ALTER FUNCTION ... RENAME TO` statements
- `DROP POLICY` + recreate with new names for each RLS policy (Postgres doesn't rename policies directly)
- `CREATE VIEW intern_<name> AS SELECT * FROM team_<name>;` for every renamed table
- A final `SELECT count(*) FROM <old_name>` AND `FROM <new_name>` for each pair, to prove both work

Show the full SQL to the user. Get explicit "run it" before proceeding.

## Step 5 — Run the migration ⚠️

Use `apply_migration` (not `execute_sql`) with name `intern_to_team_rename`. Wait for success. If it fails, the transaction auto-rolls-back — surface the error to the user and do not proceed.

Verify by selecting from both old and new names. Both must return identical row counts.

## Step 6 — Code sweep ⚠️ (writes to files, pushes to git)

Work file-by-file. For each file in the grep list:
- Update `intern_*` references to `team_*`
- Run `tsc --noEmit` or equivalent between batches to catch breakage early

Commit in logical groupings (e.g. "rename intern→team in admin pages", "rename in contexts", etc.) rather than one giant commit. Push after each commit so Vercel validates continuously.

Final verification: load the live site, click through the main pages (Overview, Tasks, Calendar, Members, Analytics) and confirm no console errors.

## Step 7 — Wrap ✓

- Summarize: tables renamed, columns renamed, policies updated, files changed, commits pushed.
- Ask user if they want to drop compat views now or leave them indefinitely.
- Update this folder's `README.md` to note "rename complete as of <commit>" so the packet doesn't mislead a future session.
