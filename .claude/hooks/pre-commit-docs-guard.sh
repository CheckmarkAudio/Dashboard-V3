#!/usr/bin/env bash
# Warn before a `git commit` that touches src/** or supabase/** without also
# updating docs/PROJECT_STATE.md or docs/SESSION_CONTEXT.md.
#
# WHY: the user's standing rule (`feedback_docs_drift_session_start.md`) is
# "update docs in the SAME PR that ships code, never as a follow-up". This
# is the choke point — every commit that changes meaningful surface area
# either touches the docs or has a deliberate reason not to.
#
# This is a PreToolUse hook for Bash. Reads the JSON input on stdin, looks
# at the command, and exits 0 (allow) with a warning to stderr if the
# commit is missing docs. Doesn't BLOCK — Claude sees the stderr and can
# decide. Pure visual tweaks (per the user's blast-radius rule) may not
# need docs; a real change should add the entry.
#
# To block instead of warn, replace `exit 0` after the warning with
# `exit 2` (PreToolUse: 2 = block).

input=$(cat)

# Only react to bash tool calls.
tool_name=$(printf '%s' "$input" | sed -n 's/.*"tool_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
[ "$tool_name" = "Bash" ] || exit 0

command=$(printf '%s' "$input" | sed -n 's/.*"command":[[:space:]]*"\(.*\)".*/\1/p' | head -1)

# Only act on `git commit` (not amend, not status, not log).
case "$command" in
  *"git commit"*)
    # Skip if it's `git commit --amend` (modifying existing commit, docs may already be in it).
    case "$command" in
      *"git commit --amend"*|*"git commit -a"*"--amend"*) exit 0 ;;
    esac
    ;;
  *)
    exit 0
    ;;
esac

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

staged=$(git diff --cached --name-only 2>/dev/null)
[ -z "$staged" ] && exit 0

touches_code=$(printf '%s\n' "$staged" | grep -E '^(src/|supabase/migrations/|supabase/functions/)' | head -1)
touches_docs=$(printf '%s\n' "$staged" | grep -E '^docs/(PROJECT_STATE|SESSION_CONTEXT)\.md' | head -1)

if [ -n "$touches_code" ] && [ -z "$touches_docs" ]; then
  files_changed=$(printf '%s\n' "$staged" | grep -E '^(src/|supabase/)' | wc -l | tr -d ' ')
  cat >&2 <<EOF
⚠  DOCS-DRIFT GUARD: this commit stages ${files_changed} file(s) under src/ or supabase/ but does NOT update docs/PROJECT_STATE.md or docs/SESSION_CONTEXT.md.

The standing rule (feedback_docs_drift_session_start.md): docs land in the SAME PR that ships code, never as a follow-up.

Pure visual tweaks may not need a docs entry per the blast-radius rule (feedback_pr_flow_threshold.md). For anything else — new feature, schema change, RPC, layout-version bump, refactor, deferred-item resolution — add the docs entry to this commit.

Files staged:
$(printf '%s\n' "$staged" | sed 's/^/  /')

To proceed anyway: re-run the commit (this is a warning, not a block).
EOF
fi

exit 0
