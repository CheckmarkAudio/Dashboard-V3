#!/usr/bin/env bash
# Surface docs drift at session start.
#
# WHY: docs/PROJECT_STATE.md + docs/SESSION_CONTEXT.md are the source of truth
# Claude reads at the start of every session. If main has advanced without a
# matching docs update, future sessions orient on stale facts. Catching this
# at session start (rather than discovering it mid-work) prevents the drift
# from compounding.
#
# HOW: emits a single-line JSON warning to stdout that Claude Code injects
# into the session-start context as `additionalContext`. Stays silent when
# docs are up-to-date. Tolerant of every failure mode (no network, not in a
# git repo, jq missing) — exits 0 and emits nothing rather than failing the
# session start.

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Best-effort refresh; keeps going if offline.
git fetch origin main --quiet 2>/dev/null

last_docs=$(git log -1 --format=%h origin/main -- docs/PROJECT_STATE.md docs/SESSION_CONTEXT.md 2>/dev/null)
[ -z "$last_docs" ] && exit 0

drift=$(git log --first-parent --format=%h "${last_docs}..origin/main" -- . ':(exclude)docs/' 2>/dev/null | wc -l | tr -d ' ')

if [ "${drift:-0}" -gt 0 ]; then
  if ! command -v jq >/dev/null 2>&1; then
    # No jq — fall back to plain stdout; CC will display it as a status line
    # rather than injecting it as context, but the user still sees something.
    echo "DOCS DRIFT WARNING: ${drift} commit(s) merged to main since docs/PROJECT_STATE.md was last touched (${last_docs}). Catch up the docs BEFORE starting new work — see feedback_docs_drift_session_start.md memory."
    exit 0
  fi
  msg="DOCS DRIFT WARNING: ${drift} commit(s) merged to main since docs/PROJECT_STATE.md was last touched (${last_docs}). Catch up the docs BEFORE starting new work — see feedback_docs_drift_session_start.md memory. Run: git log --first-parent --format=\"%h %s\" ${last_docs}..origin/main -- . ':(exclude)docs/' to see what changed."
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' "$(printf '%s' "$msg" | jq -Rs .)"
fi

exit 0
