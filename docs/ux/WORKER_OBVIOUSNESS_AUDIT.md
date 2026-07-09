# Worker Obviousness Audit

Purpose: capture what makes Checkmark easy or hard for real workers to use, then turn the friction into scoped implementation work.

The bar is intentionally simple: a 5-7 year old should be able to see the main action. The product can remain professional and powerful, but primary actions cannot hide.

This audit serves the broader Project OS vision in `docs/00_PROJECT_OS/README.md`: a beautiful, refined, easy, stable, worker-magnetic Checkmark operating system. It should not narrow the whole project vision to one route.

## Method

For each page:

1. Name the page's one-sentence job.
2. Name the top three actions.
3. Identify what is currently too hidden, dense, or ambiguous.
4. Identify the likely files.
5. Mark uncertainty with the labels from `docs/AI_CODERS_READ_THIS_FIRST.md`.
6. Do not guess through worker behavior questions.

## Current Audit Summary

| Area | One-Sentence Job | Current Friction | Likely Files | Priority |
|---|---|---|---|---|
| Tasks | Show me what I personally need to do now. | `/daily` defaults to a multi-widget panel where My Tasks competes with other boards. | `src/pages/DailyChecklist.tsx`, `WorkspacePanel.tsx`, `widgetRegistry.tsx`, `MyTasksCard.tsx`, `AssignedTaskBoards.tsx` | P0 |
| Messages / DMs | Let me find and message a teammate. | DMs exist, but top-right icon-only discovery is too easy to miss. Gavin already missed it. | `Layout.tsx`, `MessagesBell.tsx`, `DmDock.tsx`, `Content.tsx`, `NewMessageDialog.tsx` | P0 |
| Schedule | Let me understand when I work and request changes. | The model exposes single blocks vs recurring weekly, but those words are still clunky for workers. | `ScheduleRequestModal.tsx`, `MyScheduleWidget.tsx`, `WorkScheduler.tsx`, `useTeamSchedule.ts` | P0 |
| Vacation / time off | Mark that I am away or unavailable. | There is no first-class vacation marker in the inspected types; one-off blocks can cover time but do not express "vacation" clearly. | `ScheduleRequestModal.tsx`, `WorkScheduler.tsx`, schedule migrations/types | P0 |
| Dashboard | Help me know what matters today. | Widgets are useful but can become another information wall if every widget is equally loud. | `Dashboard.tsx`, `MemberHighlights.tsx`, `WorkspacePanel.tsx`, member widgets | P1 |
| Forum | Let me talk with the team and find channels/DMs. | Public channels and DMs share a system, but the worker mental model may not be obvious. | `Content.tsx`, forum components, DM queries | P1 |
| Admin scheduling | Let admin set and approve work schedules. | Rich scheduler exists but needs simpler labels and vacation handling. | `TeamManager.tsx`, `WorkScheduler.tsx`, schedule mutations | P1 |

## Known From Code Inspection

- `MessagesBell` already lists DM/group threads and opens `DmDock`.
- `DmDock` already persists floating chat windows across pages.
- `Content.tsx` already supports DM deep links through `?dm=<channel_id>`.
- `ScheduleRequestModal` already supports one-off blocks and recurring weekly requests.
- `WorkScheduler` already handles pending block requests, recurring proposals, and recurring deletion requests.
- Schedule types currently distinguish `pending`, `approved`, and `denied`, but not a separate vacation/time-off kind.
- `/daily` currently uses `WorkspacePanel` with `TASKS_WIDGET_DEFINITIONS`.
- `MyTasksCard` is already the right personal-task core and should become the default task-page view.

## Worker Test Script

Run this with Gavin or another employee. Do not coach them first.

1. "Show me where you would send a private message to someone."
2. "Start a new message to a teammate."
3. "Show me what you personally need to do today."
4. "Complete one task."
5. "Show me your schedule for this week."
6. "Request next Thursday off."
7. "Set a schedule you work every week."
8. "Change only one specific day."

Record:

- where they click first
- where they hesitate
- labels they misunderstand
- anything they say out loud
- whether they complete the task in under 10 seconds

## AI Usability Preview Harness

Use `public/ai-worker-preview.html` when you want ChatGPT or another AI reviewer to explore a public-safe, fake-data employee preview without logging into the real workspace.

How to use:

1. Deploy the branch to a Vercel preview.
2. Open `/ai-worker-preview.html` on that preview domain.
3. Send that URL to ChatGPT with no extra navigation explanation.
4. Ask it to behave like a new employee and report what it clicks, misses, or misunderstands.

Rules:

- This page uses fake data only.
- It does not touch Supabase.
- It does not replace real worker testing.
- It should not be treated as the current code truth for backend behavior.
- Do not expose `npm run dev` through a public tunnel for AI testing; local dev intentionally has a development auth bypass.

## Optional Real-App AI Preview

Status: low priority. Use only if screenshots and the fake-data preview page are not enough.

The guarded Vercel Preview auto-login path can let an outside AI reviewer inspect real app routes as a fake employee. This is not a general QA default and is not needed for most ChatGPT work.

Rules:

- use a fake, low-permission employee/member account only
- set preview-login env vars in Vercel Preview scope only
- never share owner, admin, Vercel, Supabase, GitHub, or real employee secrets
- assume anyone with the preview URL can act as the fake employee while the vars are active
- rotate or remove credentials after the review cycle
- keep final auth testing separate because preview auto-login skips the normal login screen

ChatGPT should usually be used for lower-risk work first:

- research summaries with citations
- usability scripts
- worker roleplay
- feedback synthesis
- button label and microcopy options
- plain-language tradeoff summaries

## Usability Rules

Primary actions:

- must use clear verbs
- must be visible near the page title or active pane
- must not require knowing an icon's meaning
- must be reachable on mobile

Page layout:

- daily workflow pages should not default to three-column information walls
- use a sidebar or tabs when the user is choosing among contexts
- use widgets for overview, not for the primary worker task when a dedicated flow is better
- Overview and Dashboard may use a main-vs-widget toggle when the main view is curated and the widget view preserves power-user density

Copy:

- prefer worker language over data-model language
- "Weekly schedule" is better than "recurring rule"
- "One-time change" is better than "single block"
- "Vacation/time off" needs a director-approved term

## File Organization Sweep

Initial sweep completed:

- `docs/` inventory
- `docs/pwa/` app planning files
- `docs/ux/` target folder creation
- `.claude/commands/` startup and audit commands
- `.claude/skills/ui-consistency/`
- route maps in `src/app/routes.ts`, `src/features/member/routes.tsx`, and `src/features/admin/routes.tsx`
- core task, message, schedule, and layout components

<span style="color:#7c3aed">ASSUMPTION</span>: The current doc library should be organized by adding focused docs and indexes first, not by deleting historical docs. Many older docs are referenced by startup commands or contain migration history.

<span style="color:#d97706">NEEDS-DIRECTOR</span>: A deeper doc consolidation pass can be done later, but broad deletion/merging should be approved file by file.

## Redundancy And Consolidation Notes

Safe now:

- Add new focused UX docs under `docs/ux/`.
- Keep `APP_BUILD_ROADMAP.md` as the phase owner.
- Keep `docs/AI_CODERS_READ_THIS_FIRST.md` as the cross-agent front door.

Not safe yet:

- deleting `PROJECT_STATE.md` or `SESSION_CONTEXT.md`
- merging Google Calendar docs without verifying current live status
- merging assignment docs without checking inbound references
- deleting historical visual/mockup docs

Potential later consolidation candidates:

- Google Calendar docs may be reducible into one current runbook plus archive notes.
- Assignment docs may be reducible into one canonical assign-engine doc plus archived handoff.
- Older interaction-blueprint and rebuild docs may be historical references only.

Do not perform those merges until references and current accuracy are checked.
