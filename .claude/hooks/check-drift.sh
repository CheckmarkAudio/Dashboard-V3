#!/usr/bin/env bash
# Multi-dimensional drift check at session start.
#
# WHY: docs/PROJECT_STATE.md is one of several drift surfaces — local branch
# can lag origin/main, supabase types can stale relative to migrations, open
# PRs can rot with merge conflicts, and the WORKSPACE_LAYOUT_VERSION constant
# can fall behind layout changes. Catching these at session start (rather
# than discovering them mid-work) prevents drift from compounding.
#
# HOW: emits a single-line JSON warning to stdout via the `additionalContext`
# protocol. Stays silent when everything is clean. Tolerant of every failure
# mode (no network, missing jq, not in a git repo) — exits 0 silently.
#
# Surfaces checked:
#   1. Docs drift   — PROJECT_STATE.md / SESSION_CONTEXT.md vs commits to main
#   2. Branch drift — local branch behind origin/main
#   3. PR drift     — open PRs marked CONFLICTING by GitHub
#   4. Type drift   — supabase types older than newest migration
#
# Each check is independent: one failing doesn't suppress the others. Every
# warning is prefixed with [N/4] so reading order matches priority.

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Best-effort refresh; keeps going if offline.
git fetch origin main --quiet 2>/dev/null

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
[ -z "$REPO_ROOT" ] && exit 0

warnings=()

# ── Check 1: docs drift ───────────────────────────────────────────────────────
last_docs=$(git log -1 --format=%h origin/main -- docs/PROJECT_STATE.md docs/SESSION_CONTEXT.md 2>/dev/null)
if [ -n "$last_docs" ]; then
  drift=$(git log --first-parent --format=%h "${last_docs}..origin/main" -- . ':(exclude)docs/' 2>/dev/null | wc -l | tr -d ' ')
  if [ "${drift:-0}" -gt 0 ]; then
    warnings+=("[1/4] DOCS DRIFT: ${drift} commit(s) merged to main since docs/PROJECT_STATE.md was last touched (${last_docs}). Catch up the docs BEFORE starting new work — see feedback_docs_drift_session_start.md memory. Run: git log --first-parent --format=\"%h %s\" ${last_docs}..origin/main -- . ':(exclude)docs/' to see what changed.")
  fi
fi

# ── Check 2: branch drift ────────────────────────────────────────────────────
current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -n "$current_branch" ] && [ "$current_branch" != "main" ]; then
  behind=$(git rev-list --count "HEAD..origin/main" 2>/dev/null)
  if [ "${behind:-0}" -gt 5 ]; then
    warnings+=("[2/4] BRANCH DRIFT: current branch '${current_branch}' is ${behind} commits behind origin/main. Consider rebasing before continuing work to avoid surprise conflicts.")
  fi
fi

# ── Check 3: open PR conflict status ─────────────────────────────────────────
if command -v gh >/dev/null 2>&1; then
  conflicts=$(gh pr list --state open --json number,title,mergeable --limit 20 2>/dev/null | \
    (command -v jq >/dev/null 2>&1 && jq -r '.[] | select(.mergeable=="CONFLICTING") | "#\(.number) (\(.title))"' || cat) 2>/dev/null | \
    head -5)
  if [ -n "$conflicts" ]; then
    list=$(printf '%s' "$conflicts" | tr '\n' ';' | sed 's/;$//; s/;/, /g')
    warnings+=("[3/4] PR DRIFT: open PR(s) marked CONFLICTING: ${list}. Rebase them before more work lands on main.")
  fi
fi

# ── Check 4: supabase types vs migrations ────────────────────────────────────
if [ -f "${REPO_ROOT}/src/types/supabase.ts" ] && [ -d "${REPO_ROOT}/supabase/migrations" ]; then
  types_ts=$(git log -1 --format=%ct -- src/types/supabase.ts 2>/dev/null)
  newest_migration=$(ls -1 "${REPO_ROOT}/supabase/migrations" 2>/dev/null | sort | tail -1)
  if [ -n "$types_ts" ] && [ -n "$newest_migration" ]; then
    migration_ts=$(git log -1 --format=%ct -- "supabase/migrations/${newest_migration}" 2>/dev/null)
    if [ -n "$migration_ts" ] && [ "$migration_ts" -gt "$types_ts" ]; then
      age_hours=$(( (migration_ts - types_ts) / 3600 ))
      if [ "$age_hours" -gt 24 ]; then
        warnings+=("[4/4] TYPE DRIFT: supabase/migrations/${newest_migration} is newer than src/types/supabase.ts by ${age_hours}h. Run: npx supabase gen types typescript --project-id ncljfjdcyswoeitsooty > src/types/supabase.ts")
      fi
    fi
  fi
fi

# ── Emit ─────────────────────────────────────────────────────────────────────
[ ${#warnings[@]} -eq 0 ] && exit 0

joined=$(printf '%s\n\n' "${warnings[@]}" | sed '$d')

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' "$joined"
  exit 0
fi

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' "$(printf '%s' "$joined" | jq -Rs .)"
exit 0
