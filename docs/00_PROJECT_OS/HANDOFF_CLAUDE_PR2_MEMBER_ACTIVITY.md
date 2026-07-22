# Claude Handoff — Member Activity PR2

## Purpose

PR1 is merged on `main` as PR #304 (`de402d9`). It created the persisted presence contract. PR2 should build the activity-day logic that later UI work can consume.

## Read First

1. `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
2. `docs/00_PROJECT_OS/03_LAWS_AND_SAFETY.md`
3. `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md` entry `2026-07-22 06:14 MDT - CODEX - Member presence persistence PR1`
4. `src/lib/queries/presence.ts`
5. `src/types/database.ts` entries for `member_presence_sessions`, `presence_ping`, and `presence_close`
6. `~/.claude/plans/i-have-an-idea-delegated-island.md`

## Confirmed PR1 Contract

`src/lib/queries/presence.ts` exports:

```ts
export interface PresenceSession {
  id: string
  member_id: string
  team_id: string
  started_at: string
  last_seen_at: string
  ended_at: string | null
  source: string
}
```

Interpret each presence session as an active interval:

```ts
[started_at, ended_at ?? now]
```

Do not change this table/RPC shape in PR2 unless the director explicitly asks and Codex reviews the schema/RLS impact.

## Claude Lane For PR2

Build the pure/data layer for Member Activity:

- Add a reusable `buildActivityDay` path.
- Fetch presence sessions for a target member/day using existing Supabase/RLS boundaries.
- Combine presence intervals with same-day activity events already available in the app.
- Return a UI-ready day model that PR3 can render without re-solving date math.
- Keep logic testable and DRY: isolate interval/date math in pure helpers.
- Add focused unit tests for interval clipping, merging, idle/open sessions, and day boundaries.

## Required Behavior

- Clip all intervals to the requested local day.
- Treat open sessions as ending at the injected `now`, not at build time hidden inside helpers.
- Merge overlapping or adjacent intervals so the UI does not double-count active time.
- Union presence with same-day action bracketing. If an event/action proves activity at a moment outside a presence interval, represent that as a small activity interval or documented point-to-interval rule.
- Preserve privacy and team boundaries. Do not bypass RLS or fetch broader team data than needed.
- Use project date/time helpers if they already exist; avoid ad hoc timezone parsing scattered across components.

## Non-Goals For PR2

- No Member Activity widget UI.
- No admin dashboard/card surface.
- No attendance exceptions.
- No clock-in/out button changes.
- No schema/RPC migrations.
- No direct writes.
- No notification, forum, task-request, or calendar UI changes.

## Verification

- `npm run build`
- Run the relevant unit/type tests if available.
- Add a checkpoint entry to `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`.
- Update `docs/PROJECT_STATE.md` in the same PR.
- PR should explain exactly what PR3 can consume.

## Open Gaps From PR1

- Supabase Advisor and true type regeneration still need a session with `SUPABASE_ACCESS_TOKEN`.
- Live heartbeat verification remains useful but is not a blocker for pure PR2 logic if the contract is read-only.
