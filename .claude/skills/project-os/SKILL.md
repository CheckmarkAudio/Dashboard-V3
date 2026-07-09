---
name: project-os
description: Use before Claude/Fable starts broad Dashboard-V3 planning, repo organization, roadmap sequencing, multi-agent coordination, source-of-truth cleanup, or any task where the user says "where were we", "who tackles what", "Project OS mode", "north star", "vision", "roles", "accountability", "file organization", or "don't lose the plot".
---

# Project OS Skill

Use this skill to load the repo's mission, shared language, safety rules, roles, history protocol, and design memory before editing.

## Required Reading

Read these before recommendations or file edits:

1. `docs/00_PROJECT_OS/README.md`
2. `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md`
3. `docs/00_PROJECT_OS/02_LANGUAGE_AND_KEYS.md`
4. `docs/00_PROJECT_OS/03_LAWS_AND_SAFETY.md`
5. `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
6. `docs/00_PROJECT_OS/05_HISTORY_AND_LEARNING.md`
7. `docs/00_PROJECT_OS/06_ART_AND_DESIGN_SYSTEM.md`
8. `docs/AI_CODERS_READ_THIS_FIRST.md`
9. `docs/pwa/APP_BUILD_ROADMAP.md`

## Operating Rule

Preserve the north star first, then choose the lane.

Tasks, Messages, Schedule, Dashboard, and Accountant are tactical tracks under the broader mission. Do not confuse the current proof point with the core vision.

## Workflow

1. State the active north star in one or two sentences.
2. Identify the current phase from `docs/pwa/APP_BUILD_ROADMAP.md`.
3. Identify whether the task is Codex, Claude/Fable, ChatGPT, Cursor, or user lane.
4. Check `git status --short --branch` before editing.
5. Mark unclear choices with `NEEDS-DIRECTOR`, `NEEDS-WORKER-TEST`, `ASSUMPTION`, `BLOCKED`, or `PLACEHOLDER-DATA`.
6. Keep organization non-destructive unless the user explicitly approves a move, merge, or deletion.
7. Add or update `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md` at meaningful checkpoints.

## Stop Conditions

Stop and ask before editing if:

- the task would delete, merge, or move historical docs without a reference audit
- a source of truth is unclear
- another active PR owns the same workflow or files
- a product decision is being guessed
- a backend/security/data-contract change is implied by a UI request
- the requested work conflicts with the master phase order

## Completion Note

When done, report:

- files changed
- lane used
- verification run
- checkpoint status
- open `NEEDS-DIRECTOR` or `NEEDS-WORKER-TEST` items
