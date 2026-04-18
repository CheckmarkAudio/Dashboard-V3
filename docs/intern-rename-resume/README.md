# Intern → Team Rename — Resume Packet

> **STATUS: PHASE B COMPLETE as of 2026-04-17** (commits `5be53d9...4ac735c` on main).
> Tables renamed in DB. Code swept. Compat views in place. **Column renames deferred.**
> Keep this folder around as the reference for the future Approach A pass.

## What's done (Phase B — tables only)

- 10 `intern_*` tables renamed to `team_*` in production Supabase via migration `intern_to_team_rename_phase_b`
- Compat views created under all old names — anything that still references `intern_users` etc. continues to work transparently
- 103 source-code references updated across 30 files
- `src/types/database.ts` regenerated from the live schema
- Local JSON backup of all 14 non-empty tables kept at `backups/2026-04-17/` (gitignored)
- Build passes; live Vercel deploy serving the new code at `dashboard-v3-dusky.vercel.app`

## What's NOT done (deferred to a future Approach A session)

These were intentionally left for a later focused pass:

- **Column renames**: `intern_id` → `member_id` in 9 tables. Requires column-aliasing views (more complex than the simple `SELECT *` views we have now). About 9 columns and roughly half the original code surface to sweep.
- **Function name renames**: `intern_get_user_role()`, `intern_users_protect_owner_*()`, `intern_generate_checklist()`. Purely cosmetic — they keep working. Renaming requires updating the policies and triggers that reference them.
- **Compat view drop**: Still in place forever until we're sure nothing references the old names. Free to leave — Postgres inlines them at query time.
- **Index rename**: 20 indexes still have `intern_*` in their names. Cosmetic only — they index the renamed tables correctly.
- **Old SQL migration files** in `supabase/migrations/`: never edited (historical record of how the schema got here).

## Resuming Approach A in a future session

When you want to come back and finish the column renames:

1. Verify git HEAD and read `02-strategy.md` for the Approach A complications I flagged (column-aliasing views, function-body updates).
2. Take a fresh local JSON backup before starting (the 2026-04-17 one will be stale).
3. Plan for ~200-line migration vs. the ~80-line one we did for B (more SQL surface = more chances for typos).
4. Code sweep is roughly the same size as Phase B was (~100 references) but in different files (the column-using files vs. the table-name-using files — significant overlap).

## Files in this folder

- `README.md` (this) — entry point + status
- `01-context.md` — original crash context (now historical)
- `02-strategy.md` — the compat-view + atomic-txn approach (still applies to A)
- `03-steps.md` — the original numbered execution steps (still useful as a template)
- `04-rollback.md` — what to do if something breaks

## If a future Claude session opens this

Phase B is **done**. Don't try to redo it. If the user asks for "the rename" they likely mean Approach A (columns + functions). Read `02-strategy.md` for the column-aliasing-view complications before drafting any SQL.
