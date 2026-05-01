---
description: Deep on-demand drift audit — checks docs, schema, memory, design tokens, dead code
allowed-tools: Bash, Read, Grep, Glob
---

You are running a comprehensive drift audit. The goal is to be a **detective** — surface real divergences between the codebase and its assumed state, with citations. Don't take the easy way out: every claim needs evidence, every finding needs a file path.

Run the checks below in order. For each, report:
- ✅ CLEAN, or
- ⚠ DRIFT (with file path, line number, and one-line explanation), or
- ❌ BROKEN (with the same)

End with a triage table: severity (P0/P1/P2) · finding · suggested fix · file. Skip checks that don't apply (e.g. no migrations folder).

---

## 1. Docs drift (the headline rule)

```bash
bash .claude/hooks/check-drift.sh
```

If output is non-empty, parse it and surface each `[N/4]` line as its own finding. Cross-check against `feedback_docs_drift_session_start.md` memory.

## 2. Memory pointer staleness

For every memory file under `~/.claude/projects/-Users-bridges-GITHUB-Dashboard-V3/memory/`, scan for references to:
- File paths (`src/...`, `supabase/...`) — verify each path still exists
- Function/RPC names (`admin_*`, `get_*`, `mark_*`) — grep the codebase + migrations
- Table names — check against the `supabase/migrations/` folder

Report any pointer that no longer resolves. **Don't auto-delete**; flag for user confirmation.

## 3. Schema vs types drift

If `src/types/supabase.ts` exists, parse the migration filenames in `supabase/migrations/` and compare timestamps. Flag any migration file newer than the types file by >24h. If any new tables or RPCs in recent migrations don't appear in types, list them.

## 4. Layout-version drift

Find `WORKSPACE_LAYOUT_VERSION` in `src/`. List the last 5 commits that changed widget placements (`*Widgets.tsx`, `*Layout*.tsx`) and check whether each bumped the version constant. A widget placement change without a version bump silently strands users on a stale layout.

## 5. Design-token drift

Search for ad-hoc colors that should use semantic tokens:
- `#[0-9a-fA-F]{3,6}` literals in `.tsx`/`.ts` (excluding `index.css` `@theme` block)
- `rgb(`/`rgba(` literals in components
- Pixel sizes in className that have a token equivalent (`text-[14px]` → `text-sm`)

Flag the worst offenders (top 10), not exhaustive list.

## 6. Dead exports

Use `grep -r "export (default |const |function )"` to list exports, then for each, check if there's a corresponding import. Flag exports with zero imports (likely dead). Limit to top 10 to avoid noise.

## 7. Commented-out code blocks

`grep -rn "^\s*//.*\b(TODO|FIXME|XXX|HACK)\b" src/ supabase/` — surface stale TODOs older than 30 days (check via `git blame`).

## 8. Open PR conflict status

```bash
gh pr list --state open --json number,title,mergeable,updatedAt --limit 30
```

Surface any PR with `mergeable: CONFLICTING` or last updated >7 days ago.

---

## Output format

After all checks complete, emit:

```
DRIFT AUDIT — <ISO date>

P0 (act now)
  • <finding> — file:line — <fix>

P1 (next session)
  • <finding> — file:line — <fix>

P2 (when convenient)
  • <finding> — file:line — <fix>

CLEAN
  • <list of checks that passed>
```

If there are zero findings, celebrate that fact — explicitly say "no drift detected" rather than making something up.
