---
name: worker-obviousness
description: Use before Claude changes Tasks, Schedule, Messages, Forum, Dashboard widgets, or any worker-facing navigation in Dashboard-V3. Keeps primary actions visible, reduces information overload, and routes uncertainty back to the director instead of guessing.
---

# Worker Obviousness Skill

Use this skill when a task touches worker-facing usability, daily workflows, navigation, information hierarchy, or the "5-7 year old could figure it out" standard.

## Required Reading

Read these before editing:

1. `docs/00_PROJECT_OS/README.md`
2. `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md`
3. `docs/AI_CODERS_READ_THIS_FIRST.md`
4. `docs/pwa/APP_BUILD_ROADMAP.md`
5. `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`
6. `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
7. `docs/ui-standards.md`

Read focused docs when relevant:

- Tasks: `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`
- Schedule: `docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md`
- Messages / DMs / Forum: `docs/ux/MESSAGES_DISCOVERY_PLAN.md`

## Operating Rule

Make the primary action obvious before adding polish.

Do not solve information overload by shrinking text, hiding actions, or adding more equal-weight widgets.

## Workflow

1. Identify the page's one-sentence job.
2. Identify the top three user actions.
3. Identify what is hidden, dense, or ambiguous.
4. Reuse existing components and design tokens.
5. If the task needs a product decision, label it `NEEDS-DIRECTOR` and stop.
6. If the task needs worker validation, label it `NEEDS-WORKER-TEST`.
7. Verify desktop, mobile width, keyboard focus, and obvious primary action.

## Default Standards

- Tasks page starts with My Tasks.
- DMs must be discoverable from header and Forum.
- Schedule choices use worker language: weekly schedule, one-time change, time off.
- Dashboard may use widgets; daily workflow pages should avoid default three-column walls.
- Icon-only controls need labels, badges, tooltips, or nearby text when the action is important.
- Placeholder data must be marked `PLACEHOLDER-DATA`.

## Stop Conditions

Stop and ask before editing if:

- a vacation/time-off data model is required
- the user-facing term is unclear
- a UI polish request turns into a route redesign
- a local fix would create inconsistency with `docs/ui-standards.md`
- another active PR touches the same files
