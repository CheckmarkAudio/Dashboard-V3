# AI Coders Read This First

Purpose: give every AI coder one practical front door for Dashboard-V3 work so new sessions know the project vision, lane, current roadmap, uncertainty rules, and delegation model before editing.

This file is mandatory reading for Codex, Claude/Fable, and any ChatGPT-assisted planning session.

Full mission, language, laws, roles, learning, and design memory live in `docs/00_PROJECT_OS/`.

## Start Here

Read these in order before making product or code decisions:

1. `docs/00_PROJECT_OS/README.md`
2. `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md`
3. `docs/00_PROJECT_OS/02_LANGUAGE_AND_KEYS.md`
4. `docs/00_PROJECT_OS/03_LAWS_AND_SAFETY.md`
5. `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
6. `docs/AI_CODERS_READ_THIS_FIRST.md`
7. `docs/pwa/APP_BUILD_ROADMAP.md`
8. `docs/pwa/APP_EXPERIENCE_PLAYBOOK.md`
9. `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`
10. `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
11. `docs/claude-web-dev-guardrails.md`
12. `docs/ui-standards.md`

If the task touches a specific surface, also read its focused plan:

- Tasks: `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`
- Schedule: `docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md`
- Messages / DMs / Forum: `docs/ux/MESSAGES_DISCOVERY_PLAN.md`
- Accountant / finance: `docs/checkmark-accountant-integration-plan.md`

## Master Rule

`docs/00_PROJECT_OS/` owns the north star, team language, safety laws, role lanes, accountability, history protocol, and design memory.

`docs/pwa/APP_BUILD_ROADMAP.md` is the master phase order.

No planning doc, Claude handoff, ChatGPT brainstorm, or implementation PR may reorder the project phases without updating `APP_BUILD_ROADMAP.md` in the same change.

## Current Strategic Order

1. Make the installed app safe: auth, session, shell, logout, recovery.
2. Make daily web workflows worker-obvious: Tasks, Messages, Schedule, Dashboard hierarchy.
3. Keep mobile/app polish aligned with the same daily workflow order.
4. Only then start Accountant foundation.

Accountant is important, but it waits behind daily worker clarity unless the user explicitly overrides the roadmap.

Tasks is the first tactical proof point for the current UI/UX reform. It is not the core vision. The core vision is the full Checkmark operating system described in `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md`.

## Role Facts

These are operating facts for this repo.

### User

The user is lead director and product architect.

User owns:

- final business priorities
- worker behavior truth
- naming/tone decisions that affect company identity
- ambiguous UX tradeoffs
- finance/compliance expectations for Accountant
- approval to merge, delete, or collapse docs when the source of truth is not obvious

### Codex

Codex owns:

- codebase inspection
- roadmap and documentation architecture
- app/build sequencing
- auth/session safety
- Supabase schema, RLS, RPC, and data-contract review
- cross-agent overlap checks
- scoped implementation when risk is architectural or data-related
- verification strategy and regression review

Codex should not handwave. If the code or data model is unclear, Codex must mark the uncertainty.

### Claude / Fable

Claude/Fable owns focused implementation slices after scope is defined.

Good Claude/Fable tasks:

- one route
- one viewport/layout problem
- one visual target
- known files
- explicit non-goals

Do not give Claude/Fable:

- "make the whole site amazing"
- broad architecture
- broad Supabase/security changes
- Accountant implementation before Codex defines schema and permission boundaries
- multi-page redesigns without a written plan

### ChatGPT

ChatGPT is useful for:

- worker usability scripts
- microcopy and button labels
- roleplaying confused employees
- summarizing worker feedback
- brainstorming alternatives
- preparing focused Claude handoff prompts
- public web research summaries when browsing/citations are available
- plain-language tradeoff explanations for the user
- onboarding scripts, FAQs, and "new employee" comprehension checks
- accessibility/readability passes on labels and instructions
- interview questions for Gavin or other worker testers
- alternative wording sets for buttons, empty states, and confirmation dialogs

ChatGPT should not be treated as the source of truth for repo architecture or current code.

ChatGPT research rule:

- If ChatGPT is used for public web research, require sources, dates, and a clear split between evidence, opinion, and recommendation.
- If ChatGPT cannot browse or cite sources in that session, treat its research output as brainstorming only.
- Do not give ChatGPT Vercel, Supabase, GitHub, owner, admin, or real employee secrets.
- Do not use ChatGPT to decide current branch state, file ownership, migrations, RLS, or production readiness.

## Shortcut Phrases

Use these phrases in new sessions to load the right lane quickly.

### "Where were we?"

Read:

1. `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`
2. `docs/00_PROJECT_OS/05_HISTORY_AND_LEARNING.md`
3. `docs/SESSION_CONTEXT.md`
4. `docs/PROJECT_STATE.md`
5. `docs/pwa/APP_BUILD_ROADMAP.md`
6. `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`
7. `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
8. `git status --short --branch`

Then summarize:

- current master phase
- current worker-obviousness target
- last meaningful checkpoint
- files likely to change next
- uncertainty labels that need the user
- ownership lane
- safest next move

Do not answer "where were we?" by restating only the north star. Use history first.

### "Project OS mode"

Read:

1. `docs/00_PROJECT_OS/README.md`
2. `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md`
3. `docs/00_PROJECT_OS/03_LAWS_AND_SAFETY.md`
4. `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
5. `docs/pwa/APP_BUILD_ROADMAP.md`

Then report:

- the broad mission
- active phase
- correct AI lane
- current proof point
- stop conditions
- next safe action

### "Worker-obvious mode"

Activate the worker-obviousness standard:

- primary actions must be visible without hunting
- default view shows the worker's own work first
- avoid three-column information walls on daily workflow pages
- use sidebar/tabs for secondary context
- do not hide critical actions behind icon-only controls without labels, badges, or nearby text

### "Daily workflow rescue"

Work in this order:

1. Tasks
2. Messages / DMs / Forum
3. Schedule / vacation markers
4. Dashboard hierarchy

### "Claude lane"

Before Claude/Fable edits, give:

- target route/component
- exact files likely to change
- relevant focused doc
- visual target
- non-goals
- verification steps

### "Director decision needed"

Return only the unresolved choices with the `NEEDS-DIRECTOR` label. Do not code through the unknown.

### "Placeholder audit"

Search the repo for:

- `PLACEHOLDER-DATA`
- `NEEDS-DIRECTOR`
- `ASSUMPTION`
- `NEEDS-WORKER-TEST`
- `BLOCKED`

Then report each item with file and line.

### "sb-migrate"

Existing Cursor skill shortcut for Supabase migrations.

Read `.cursor/skills/supabase-migrate/SKILL.md` before using it. Treat `sb-migrate` as explicit authorization only inside that skill's documented workflow. Do not run migrations from a worker-obviousness/UI task unless the user clearly asks for database work.

## Uncertainty And Placeholder Labels

Use these exact labels in docs, PR summaries, comments, and chat.

HTML color is allowed in Markdown docs when helpful:

- <span style="color:#d97706">NEEDS-DIRECTOR</span>: the user must decide.
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: validate with Gavin or another real worker.
- <span style="color:#7c3aed">ASSUMPTION</span>: reasonable but not proven.
- <span style="color:#dc2626">BLOCKED</span>: do not continue without a decision or external state change.
- <mark>PLACEHOLDER-DATA</mark>: fake, sample, copied, or incomplete data.

In plain terminal/chat contexts where color may not render, use the all-caps label.

Rules:

- Never bury uncertainty in prose.
- Never ship placeholder data as if it is production truth.
- If a UI needs placeholder copy or data, label it and create a follow-up removal path.
- If the decision affects employee behavior, prefer worker testing over guessing.

## File Organization Rules

Keep docs easy enough for a human or AI to find in under one minute.

Use the current buckets:

- `docs/00_PROJECT_OS/`: project mission, language, laws, roles, accountability, history process, design memory, and checkpoint ledger.
- `docs/pwa/`: master app/PWA roadmap, experience rules, mobile and install plans.
- `docs/ux/`: website usability and worker-obviousness plans.
- `docs/security/`: security scans, Supabase advisor notes, and risk shortlists.
- `docs/mockups/`: visual references and HTML mockups.
- `docs/pages/`: page screenshot history and visual references.
- `docs/Marketing/`: marketing assets and standards.
- `.claude/commands/`: reusable Claude session commands.
- `.claude/skills/`: reusable Claude task skills.
- `.cursor/skills/`: Cursor-specific skills, including Supabase migration flow.

Do not create a new folder if an existing bucket already fits.

Do not create a new doc if an existing canonical doc can absorb the update cleanly.

Do not delete or merge historical docs unless:

- the replacement source of truth is identified
- all inbound references are updated
- the user has approved the consolidation if there is any doubt

## Initial Organization Findings

Known from inspection:

- `docs/pwa/APP_BUILD_ROADMAP.md` already exists and must remain the master phase order.
- `docs/pwa/APP_EXPERIENCE_PLAYBOOK.md` already defines the app quality bar.
- `docs/ui-standards.md` is the visual styling source of truth.
- `docs/claude-web-dev-guardrails.md` is the Claude implementation guardrail.
- `.claude/commands/start-session.md` already governs Claude startup behavior.
- `.claude/skills/ui-consistency/SKILL.md` already exists for visual consistency.

Consolidation caution:

- `docs/PROJECT_STATE.md` and `docs/SESSION_CONTEXT.md` are long but still referenced by Claude startup.
- Many older docs are historical and may still contain migration or PR context.
- No broad doc deletion is approved from the initial sweep.

Current safe consolidation action:

- Add the Project OS layer.
- Keep this operating manual as the short cross-agent front door.
- Add focused `docs/ux/` plans.
- Link them from the master roadmap and Claude startup rules.
- Defer destructive doc merging until a dedicated reference audit confirms what is safe.

## Project Skills Map

Current repo-tied skills and commands:

| Skill / Command | Location | Use When | Owner |
|---|---|---|---|
| `project-os` | `.claude/skills/project-os/SKILL.md` | Broad planning, repo organization, roadmap sequencing, role lanes, accountability, "where were we", "who tackles what" | Codex plans, Claude/Fable follows startup lane |
| `ui-consistency` | `.claude/skills/ui-consistency/SKILL.md` | UI, layout, theme, widget chrome, typography, colors, responsive polish | Claude/Fable, with Codex review for shared-system changes |
| `worker-obviousness` | `.claude/skills/worker-obviousness/SKILL.md` | Tasks, Schedule, Messages, Forum, Dashboard widgets, navigation clarity, information overload | Codex plans, Claude/Fable implements scoped slices |
| `supabase-migrate` / `sb-migrate` | `.cursor/skills/supabase-migrate/SKILL.md` | Applying Supabase migrations or one-off SQL files | Cursor/Codex with explicit database-work intent |
| `start-session` | `.claude/commands/start-session.md` | Beginning a Claude session safely with context, drift, PR, and guardrail checks | Claude/Fable |
| `drift-audit` | `.claude/commands/drift-audit.md` | Deep audit for docs/schema/memory/auth/layout/design-token drift | Claude/Fable or Codex review support |
| `visual-qa` | `.claude/commands/visual-qa.md` | Visual verification before calling UI/theme/layout work done | Claude/Fable |

Suggested skills to add later:

| Suggested Skill | Why Add It | Trigger Phrase | Priority |
|---|---|---|---|
| `tasks-worker-flow` | Encapsulate `/daily` pane rules, My Tasks default, task data non-goals, and verification | `tasks rescue` | P0 after first implementation stabilizes |
| `schedule-time-off` | Keep vacation/time-off modeling from drifting into UI-only guesses | `time off model` | P0 before schedule schema work |
| `messages-discovery-qa` | Standardize DM/Header/Forum discoverability checks and worker test script | `dm discovery` | P1 before message UI polish PR |
| `accountant-foundation` | Gate finance work behind schema, RLS, invoice/payment rules, and admin-only v1 boundaries | `accountant foundation` | P1 before Accountant implementation |
| `docs-consolidation-audit` | Safely merge/remove redundant docs only after reference checks | `docs cleanup audit` | P2 |
| `worker-test-capture` | Turn Gavin/employee observations into labeled findings and implementation tickets | `worker test` | P2 |

## Before Editing Code

Every AI coder must:

1. Run `git status --short --branch`.
2. Identify the route/component/files being touched.
3. Check whether another active branch/PR owns the same files.
4. Read the focused plan for that surface.
5. State the risk: UI-only, behavior, data contract, Supabase/security, or mixed.
6. Define verification before changing files.

If the scope is not clear, stop and ask.
