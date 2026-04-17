# Context: Where We Left Off

## Current State (as of packet creation)

- **Git HEAD**: `473f04c` — "Analytics Reform" (deployed to Vercel, live at dashboard-v3-dusky.vercel.app)
- **Working tree**: clean
- **Database**: untouched. All tables still use `intern_*` naming.
- **Code**: untouched. ~265 `intern_*` references across 31 TypeScript files.
- **Local backups folder**: does not exist yet.

**Nothing is in a fragile state.** The prior session died from an API image-dimension limit error BEFORE any mutation ran. Only two read-only `execute_sql` count queries had executed — zero state change.

## What the Rename Covers

Scope (enumerated during prior planning, may need verification on resume):

- Tables: `intern_users`, `intern_*` (all `intern_`-prefixed tables)
- Columns: `intern_id` foreign keys across related tables (`sessions`, `chat_messages`, `member_kpis`, etc.)
- Helper functions: e.g. `intern_get_user_role()` → `get_team_member_role()`
- RLS policies: e.g. `intern_self` and related
- ~31 TS files with code references
- Edge functions (count not verified pre-crash)
- SQL migrations referencing old names

The exact list should be re-enumerated with `list_tables` + a fresh code grep before migration (see `03-steps.md` Step 2).

## Why This Over Other Work

User's queue at the time of decision:

1. **intern_* → team_* rename (CHOSEN)** — 2 hrs, highest risk, biggest tech-debt reduction
2. Code splitting with React.lazy — 30 min, perf win
3. Finish CreateBookingModal migration — 30 min
4. Rewire Profile/MyTeam/Content to real `intern_users` (urgent for onboarding) — 45 min
5. Flywheel event ledger (Phase 2) — half day

User picked #1 explicitly because they wanted the longest/riskiest piece done while focused.
