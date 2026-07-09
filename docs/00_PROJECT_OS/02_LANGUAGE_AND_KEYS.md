# Language And Keys

Purpose: give every AI and human the same vocabulary for decisions, records, handoffs, uncertainty, and shortcuts.

Shared language prevents drift. If we use the same words for the same ideas, future sessions can understand history faster.

## Core Terms

| Term | Meaning |
|---|---|
| `Project OS` | The operating layer in `docs/00_PROJECT_OS/` that preserves vision, rules, roles, learning, and design memory. |
| `North star` | The broad product mission: a beautiful, refined, easy, stable, worker-magnetic Checkmark operating system. |
| `Master phase order` | The sequence owned by `docs/pwa/APP_BUILD_ROADMAP.md`. |
| `Worker-obvious` | A worker can see the primary action without hunting or being taught hidden UI. |
| `Daily workflow rescue` | The current website-polish push: Tasks, Messages, Schedule, Dashboard hierarchy. |
| `Where were we?` | A history-focused startup question answered from checkpoint, state, roadmap, git, and recent docs. |
| `Who tackles what?` | A lane question answered from roles and current risk, not from preference or convenience. |
| `Source of truth` | The one file or module that owns a decision. Do not create parallel truth. |
| `Proof point` | A tactical slice that demonstrates the broader vision. Tasks is the current proof point. |
| `Handoff packet` | The scoped instructions another AI needs: goal, files, non-goals, risks, verification, and open questions. |

## Shortcut Phrases

### Project OS mode

Use when starting broad planning, repo organization, multi-agent coordination, or a new major phase.

Read:

1. `docs/00_PROJECT_OS/README.md`
2. `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md`
3. `docs/00_PROJECT_OS/03_LAWS_AND_SAFETY.md`
4. `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
5. `docs/pwa/APP_BUILD_ROADMAP.md`

Then report:

- north star
- active phase
- correct AI lane
- current files likely involved
- stop conditions
- safest next move

### Where were we?

Use when the user wants continuity.

Read:

1. `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`
2. `docs/00_PROJECT_OS/05_HISTORY_AND_LEARNING.md`
3. `docs/SESSION_CONTEXT.md`
4. `docs/PROJECT_STATE.md`
5. `docs/pwa/APP_BUILD_ROADMAP.md`
6. `git status --short --branch`

Then answer from history:

- what was last changed
- what was verified
- what remains open
- who owned the lane
- what not to overwrite
- the next safe action

### Who tackles what?

Use when work should be split among Codex, Claude/Fable, ChatGPT, Cursor, or the user.

Read:

1. `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
2. `docs/AI_CODERS_READ_THIS_FIRST.md`
3. relevant focused plan

Then assign work by lane and risk.

### Worker-obvious mode

Use for Tasks, Schedule, Messages, Forum, Dashboard widgets, navigation clarity, or information overload.

Read:

1. `.claude/skills/worker-obviousness/SKILL.md`
2. `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
3. relevant focused UX plan

### Director decision needed

Use when a product, language, data, safety, or brand decision is unclear.

Do not code through the unknown. Return only the unresolved choices with the `NEEDS-DIRECTOR` label.

## Uncertainty Labels

Use these labels in chat, docs, PR notes, and checkpoint entries.

HTML color is allowed in Markdown docs when useful:

- <span style="color:#d97706">NEEDS-DIRECTOR</span>: the user must decide.
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: validate with Gavin or another real worker.
- <span style="color:#7c3aed">ASSUMPTION</span>: reasonable but not proven.
- <span style="color:#dc2626">BLOCKED</span>: do not continue without a decision or external state change.
- <mark>PLACEHOLDER-DATA</mark>: fake, sample, copied, or incomplete data.

Plain-text contexts must use the all-caps label.

## Provenance Tags

Use these when recording history:

- `CODEX:` work authored in Codex.
- `CLAUDE:` work authored in Claude/Fable.
- `CHATGPT:` planning, copy, scripts, or review authored with ChatGPT.
- `CURSOR:` work authored in Cursor.
- `MANUAL:` direct human work.
- `MCP-APPLIED:` Supabase SQL applied through MCP.
- `MANUAL-SUPABASE:` SQL or dashboard actions done manually in Supabase.
- `LIVE-VERIFIED:` confirmed on live production.
- `PREVIEW-VERIFIED:` confirmed on Vercel preview or local preview.
- `ADVISOR-VERIFIED:` confirmed by Supabase Security Advisor or equivalent.

## Naming Rules

Use names that explain purpose without decoding:

- folders should name the domain or source-of-truth job
- docs should say whether they are roadmap, plan, audit, runbook, log, or standard
- UI labels should use worker language
- database names can remain technical, but worker-facing copy should not expose that technical shape unless useful

Prefer:

- `weekly schedule`
- `one-time change`
- `vacation/time off`
- `My Tasks`
- `Messages`

Avoid user-facing labels like:

- `recurring rule`
- `single block`
- `workflow entity`
- `DM icon` when the user needs to find Messages
