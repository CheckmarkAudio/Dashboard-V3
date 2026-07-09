---
description: Start a Dashboard-V3 Claude session by loading project context, rules, open PRs, drift status, and recommended next steps before coding
allowed-tools: Bash, Read, Grep, Glob
---

You are starting a Claude Code session inside `Dashboard-V3`.

Do not edit code yet. First run the startup/context pass below. The goal is to understand the project, honor the user's vision, avoid conflicts with other agents, and keep every choice aligned with the project north star and cornerstones:

- beautiful, refined, worker-magnetic Checkmark operating system
- clean and DRY code
- performance optimization
- web accessibility
- secure backend practices

## 1. Read Core Context

Read these files in order:

1. `docs/00_PROJECT_OS/README.md`
2. `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md`
3. `docs/00_PROJECT_OS/02_LANGUAGE_AND_KEYS.md`
4. `docs/00_PROJECT_OS/03_LAWS_AND_SAFETY.md`
5. `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
6. `docs/00_PROJECT_OS/05_HISTORY_AND_LEARNING.md`
7. `docs/AI_CODERS_READ_THIS_FIRST.md`
8. `docs/pwa/APP_BUILD_ROADMAP.md`
9. `docs/SESSION_CONTEXT.md`
10. `docs/PROJECT_STATE.md`
11. `docs/claude-web-dev-guardrails.md`
12. `docs/pr-acceptance-checklist.md`
13. `.claude/skills/ui-consistency/SKILL.md`
14. `docs/ui-standards.md`
15. `docs/light-dark-theme-handoff.md`
16. `docs/ui-change-request-template.md`

If the requested task touches broad planning, source-of-truth cleanup, repo organization, role lanes, accountability, or the user asks "where were we" / "who tackles what", explicitly say that the `project-os` skill is active and read:

17. `.claude/skills/project-os/SKILL.md`

If the requested task touches UI, layout, theme, widget chrome, spacing, borders, typography, or visual polish, explicitly say that the `ui-consistency` skill is active.

If the requested task touches worker-facing Tasks, Schedule, Messages, Forum, Dashboard widgets, or navigation clarity, also read:

18. `.claude/skills/worker-obviousness/SKILL.md`
19. `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`
20. `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`

Explicitly say that the `worker-obviousness` skill is active.

If the requested task touches Assign, Tasks, task requests, approvals, or related RPCs, also read:

21. `docs/assign-engine-spec-2026-05-03.md`

If the requested task touches a page with canonical visuals, also read:

22. `docs/CANONICAL-MOCKUPS.md`

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
- Project OS rules from `.claude/skills/project-os/SKILL.md` when applicable
- worker-obviousness rules from `.claude/skills/worker-obviousness/SKILL.md` when applicable
- Assign engine contract from `docs/assign-engine-spec-2026-05-03.md`
- Supabase migration rules from `docs/pr-acceptance-checklist.md`
- docs-in-same-PR rule from `docs/claude-web-dev-guardrails.md`
- master phase order from `docs/pwa/APP_BUILD_ROADMAP.md`
- mission/language/roles/history rules from `docs/00_PROJECT_OS/`

Do not make the user re-explain rules that are already in these docs.

## 6. Summarize Startup Findings

Before coding, respond with:

1. Current branch/state
2. Open PRs and conflict risks
3. North star and current proof point in 2-3 bullets
4. Relevant project context in 5-10 bullets
5. Applicable guardrails for the requested task
6. Recommended next action

Keep the summary concise and useful. The user wants orientation, not a wall of copied documentation.

## 7. Stop Conditions

Stop and ask before editing if:

- another active PR touches the same workflow or files
- the request requires destructive SQL
- a Supabase migration is required but the apply/verify plan is unclear
- the user asked for polish but the change would become a page redesign
- the request conflicts with `docs/ui-standards.md` or `docs/assign-engine-spec-2026-05-03.md`
- the request conflicts with `docs/pwa/APP_BUILD_ROADMAP.md`
- the request conflicts with `docs/00_PROJECT_OS/`
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
- update `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md` for meaningful checkpoints
- avoid unbounded background loops
