# Checkmark Project Operating System

Purpose: this folder is the durable front door for the Checkmark Audio Dashboard project. It keeps the big vision, shared language, safety laws, roles, learning loop, and design memory visible before any AI or human drops into a tactical task.

This is the project brain and heart. It does not replace the roadmap or the history docs. It tells everyone how to use them without losing the mission.

## Read Order For New Sessions

Read these before product, design, database, or code decisions:

0. `docs/00_PROJECT_OS/00_PRIORITY_QUEUE.md` — **top of the task hierarchy.** Active items here outrank the roadmap and any in-flight work. State them to the user at session start.
1. `docs/00_PROJECT_OS/README.md`
2. `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md`
3. `docs/00_PROJECT_OS/02_LANGUAGE_AND_KEYS.md`
4. `docs/00_PROJECT_OS/03_LAWS_AND_SAFETY.md`
5. `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
6. `docs/00_PROJECT_OS/05_HISTORY_AND_LEARNING.md`
7. `docs/00_PROJECT_OS/06_ART_AND_DESIGN_SYSTEM.md`
8. `docs/AI_CODERS_READ_THIS_FIRST.md`
9. `docs/pwa/APP_BUILD_ROADMAP.md`

Then read the focused docs for the active task.

## Anatomy

| Part | File | Job |
|---|---|---|
| Now | `00_PRIORITY_QUEUE.md` | Top of the task hierarchy — ASAP asks that outrank the roadmap. Read + state at every session start. |
| Heart | `01_VISION_AND_PURPOSE.md` | Preserve the zoomed-out mission and product standard. |
| Language | `02_LANGUAGE_AND_KEYS.md` | Keep shorthand, labels, and decision markers consistent. |
| Spine | `03_LAWS_AND_SAFETY.md` | Prevent guessing, data drift, unsafe backend work, and destructive cleanup. |
| Hands | `04_ROLES_AND_ACCOUNTABILITY.md` | Define who does what and how work gets signed. |
| Memory | `05_HISTORY_AND_LEARNING.md` | Answer "where were we?" from history, not vibes. |
| Face | `06_ART_AND_DESIGN_SYSTEM.md` | Keep brand, visuals, mockups, and polish standards unified. |
| Ledger | `CHECKPOINT_LEDGER.md` | Append who did what, when, with risks and verification. |

## Canonical Source Rules

- `docs/00_PROJECT_OS/` owns the mission, operating language, role lanes, and accountability protocol.
- `docs/pwa/APP_BUILD_ROADMAP.md` owns master phase order.
- `docs/pwa/APP_EXPERIENCE_PLAYBOOK.md` owns app-quality standards.
- `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md` owns the website polish sequence inside the roadmap.
- `docs/ux/` owns tactical worker-facing plans.
- `docs/PROJECT_STATE.md` and `docs/SESSION_CONTEXT.md` own current/historical project state.
- `docs/LEARNING_LOG.md` owns durable lessons learned from real work.
- `docs/ui-standards.md` owns reusable UI styling rules.

No AI or human should create a competing roadmap, role guide, design system, or source-of-truth doc without either updating these files or clearly marking the new file as a draft.

## Project Status Homes

Use these homes instead of inventing new "current/open/closed" folders:

| Status Need | Home |
|---|---|
| Current live/in-flight project state | `docs/PROJECT_STATE.md` |
| Current broad session handoff | `docs/SESSION_CONTEXT.md` |
| Current phase order | `docs/pwa/APP_BUILD_ROADMAP.md` |
| Current website polish work | `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md` and `docs/ux/` |
| Open AI accountability checkpoints | `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md` |
| Closed or historical implementation context | older entries in `docs/SESSION_CONTEXT.md` and `docs/PROJECT_STATE.md` |
| Lessons learned | `docs/LEARNING_LOG.md` |

If this becomes too crowded later, create archives only after a reference audit.

## Core Framing

The Tasks page is the first tactical proof point for the current UI/UX reform.

It is not the core vision.

The core vision is broader: Checkmark should become a beautiful, refined, easy, stable, worker-magnetic operating system for Checkmark Audio. Every UI page, backend contract, branch, doc, and AI handoff should support that larger build.

## Useful Shortcut Phrases

Use these phrases at the start of a session:

- `Project OS mode`: read this folder first, then summarize the north star, role lane, active phase, and safest next move.
- `Where were we?`: use `05_HISTORY_AND_LEARNING.md` and `CHECKPOINT_LEDGER.md` before summarizing open work.
- `Who tackles what?`: use `04_ROLES_AND_ACCOUNTABILITY.md` and report the correct lane for Codex, Claude/Fable, ChatGPT, Cursor, and the user.
- `Worker-obvious mode`: use `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md` and `.claude/skills/worker-obviousness/SKILL.md`.
- `Director decision needed`: stop implementation and list only the unresolved choices with `NEEDS-DIRECTOR`.
- `Placeholder audit`: search the repo for `PLACEHOLDER-DATA`, `NEEDS-DIRECTOR`, `ASSUMPTION`, `NEEDS-WORKER-TEST`, and `BLOCKED`.

## Non-Destructive Organization Rule

This pass organizes by indexing and linking first.

Do not move, merge, or delete historical docs unless:

1. the replacement source of truth is identified,
2. inbound references are checked,
3. current accuracy is verified,
4. the user approves if there is any doubt.

Historical docs are allowed to be long. Lost context is more expensive than a slightly imperfect archive.
