---
description: Start a Dashboard-V3 Claude session by loading project context, rules, open PRs, drift status, and recommended next steps before coding
allowed-tools: Bash, Read, Grep, Glob
---

You are starting a Claude Code session inside `Dashboard-V3`.

Do not edit code yet. First run the startup/context pass below. The goal is to understand the project, honor the user's vision, avoid conflicts with other agents, and keep every choice aligned with the project cornerstones:

- clean and DRY code
- performance optimization
- web accessibility
- secure backend practices

## 1. Read Core Context

Read these files in order:

1. `docs/SESSION_CONTEXT.md`
2. `docs/PROJECT_STATE.md`
3. `docs/claude-web-dev-guardrails.md`
4. `docs/pr-acceptance-checklist.md`
5. `.claude/skills/ui-consistency/SKILL.md`
6. `docs/ui-standards.md`
7. `docs/light-dark-theme-handoff.md`
8. `docs/ui-change-request-template.md`

If the requested task touches UI, layout, theme, widget chrome, spacing, borders, typography, or visual polish, explicitly say that the `ui-consistency` skill is active.

If the requested task touches Assign, Tasks, task requests, approvals, or related RPCs, also read:

9. `docs/assign-engine-spec-2026-05-03.md`

If the requested task touches a page with canonical visuals, also read:

10. `docs/CANONICAL-MOCKUPS.md`

## 2. Check Repo State

Run:

```bash
git status --short --branch
git log --oneline -8
```

Report:

- current branch
- whether the tree is clean
- whether the branch is ahead/behind
- any uncommitted changes that must not be overwritten

## 3. Check Open PRs

Run:

```bash
gh pr list --state open --json number,title,headRefName,baseRefName,mergeStateStatus,isDraft,updatedAt,url
```

Report:

- open PRs
- which ones are Claude-authored vs Codex-authored when obvious from branch name
- likely conflict risks
- which PRs should not be touched

## 4. Check Docs Drift

Run:

```bash
bash .claude/hooks/check-drift.sh
```

If drift appears, summarize it before coding. If no drift appears, say so clearly.

If the hook is missing or fails for environmental reasons, explain that and continue with a manual check against `docs/PROJECT_STATE.md` and recent commits.

## 5. Identify Applicable Rules

Before recommending work, state which rules apply:

- UI consistency rules from `.claude/skills/ui-consistency/SKILL.md`
- Assign engine contract from `docs/assign-engine-spec-2026-05-03.md`
- Supabase migration rules from `docs/pr-acceptance-checklist.md`
- docs-in-same-PR rule from `docs/claude-web-dev-guardrails.md`

Do not make the user re-explain rules that are already in these docs.

## 6. Summarize Startup Findings

Before coding, respond with:

1. Current branch/state
2. Open PRs and conflict risks
3. Relevant project context in 5-10 bullets
4. Applicable guardrails for the requested task
5. Recommended next action

Keep the summary concise and useful. The user wants orientation, not a wall of copied documentation.

## 7. Stop Conditions

Stop and ask before editing if:

- another active PR touches the same workflow or files
- the request requires destructive SQL
- a Supabase migration is required but the apply/verify plan is unclear
- the user asked for polish but the change would become a page redesign
- the request conflicts with `docs/ui-standards.md` or `docs/assign-engine-spec-2026-05-03.md`
- the current branch is not appropriate for the requested work

## 8. After Startup

Only after the startup summary should you begin implementation or ask the user for the one missing decision needed to proceed.

When you do implement:

- prefer shared tokens/classes/components over local visual patches
- verify the whole page, not only the edited element
- use `.claude/commands/visual-qa.md` before calling UI/theme/layout work done
- use Vercel preview for meaningful visual validation
- apply and verify Supabase migrations separately from Vercel
- update docs in the same PR for meaningful behavior/schema/security/workflow changes
- avoid unbounded background loops
