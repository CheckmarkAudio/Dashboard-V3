# Strategy (Already Approved — Do Not Re-Pitch)

The user already reviewed and accepted this plan. Execute it; don't re-litigate it.

## Three Overlapping Safety Nets

### 1. Compatibility Views (the big one)

After renaming tables to `team_*`, create views under the old `intern_*` names that transparently pass through:

```sql
ALTER TABLE intern_users RENAME TO team_members;
CREATE VIEW intern_users AS SELECT * FROM team_members;
```

**Effect**: any missed code reference still works. Zero downtime. Code sweep can proceed at measured pace over multiple commits.

**Cost**: ~1KB of metadata total across all views. Zero frontend bundle impact. Postgres inlines simple views at query-plan time — no runtime cost.

### 2. Atomic Transactional Migration

Entire rename runs inside a single `BEGIN ... COMMIT` block. Any failure rolls everything back. No half-states possible.

### 3. Dual Backup

- **Supabase Dashboard auto-backups**: user verifies a daily backup from today/yesterday exists (Dashboard → Database → Backups). No action required from Claude.
- **Local JSON export**: Claude queries every non-empty table and writes per-table JSON files to `backups/` in repo root. This is a portable fallback independent of Supabase infrastructure.

## Phases

- **Phase 1** — DB migration only, with compat views. Verify both old and new names queryable.
- **Phase 2** — Code sweep: update TS files + edge functions to new names. Push. Vercel deploys.
- **Phase 3** (later, optional) — Drop compat views once confident.

Stopping after Phase 2 is fine. Many shops keep compat views forever.

## Hard Rules

- **No `DROP TABLE`** in the migration. Only `ALTER TABLE ... RENAME TO`. A typo that drops would be catastrophic and is entirely preventable.
- **One transaction** for the whole Phase 1. Roll back on any error.
- **Verify git HEAD = `473f04c`** before starting. If it's drifted, stop and surface to user.
- **Export must complete** before migration runs. No exceptions.
