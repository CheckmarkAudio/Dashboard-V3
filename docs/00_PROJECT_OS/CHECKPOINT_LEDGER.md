# Checkpoint Ledger

Purpose: append-only record of who did what, when, why, with verification and open gaps.

This file helps future sessions answer "where were we?" and "who tackles what?" without relying on chat memory.

## Entry Template

```text
## YYYY-MM-DD HH:MM TZ - ACTOR - Short title

Lane:
- [role lane]

Summary:
- [what changed]

Files changed:
- [paths]

Verification:
- [commands, previews, manual checks, or not run]

Open gaps:
- [NEEDS-DIRECTOR / NEEDS-WORKER-TEST / ASSUMPTION / BLOCKED]

Token/source note:
- [displayed token usage if visible, or exact token total not visible]

Signature:
- ACTOR:
```

## 2026-07-08 18:46 MDT - CODEX - Project OS foundation and daily tasks proof point

Lane:
- Codex: repo/documentation architecture, roadmap wiring, scoped `/daily` implementation, verification.

Summary:
- Created the first Project OS layer so the broad Checkmark vision, shared language, safety laws, roles, history process, design system, and accountability protocol are durable repo infrastructure.
- Preserved `docs/pwa/APP_BUILD_ROADMAP.md` as the master phase order.
- Reframed `/daily` Tasks as the first tactical proof point of the broader website/UI reform, not the core vision itself.
- Converted `/daily` to open on My Tasks with secondary task contexts behind a sidebar/pane system earlier in this session.

Files changed:
- `docs/00_PROJECT_OS/README.md`
- `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md`
- `docs/00_PROJECT_OS/02_LANGUAGE_AND_KEYS.md`
- `docs/00_PROJECT_OS/03_LAWS_AND_SAFETY.md`
- `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
- `docs/00_PROJECT_OS/05_HISTORY_AND_LEARNING.md`
- `docs/00_PROJECT_OS/06_ART_AND_DESIGN_SYSTEM.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`
- `docs/AI_CODERS_READ_THIS_FIRST.md`
- `docs/pwa/APP_BUILD_ROADMAP.md`
- `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`
- `docs/pwa/PWA_STRATEGY.md`
- `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
- `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`
- `docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md`
- `docs/ux/MESSAGES_DISCOVERY_PLAN.md`
- `.claude/commands/start-session.md`
- `.claude/skills/worker-obviousness/SKILL.md`
- `.claude/skills/project-os/SKILL.md`
- `docs/PROJECT_STATE.md`
- `docs/claude-web-dev-guardrails.md`
- `src/pages/DailyChecklist.tsx`

Verification:
- `npm run build` passed earlier in the session after the `/daily` runtime change.
- `git diff --check` passed after Project OS wiring.
- `npm run build` passed after Project OS wiring.
- `rg` checks confirmed Project OS references in startup, roadmap, guardrail, skill, state, and UX files.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Gavin or another worker should test whether `/daily` now clearly starts on My Tasks and whether secondary panes are understandable.
- <span style="color:#d97706">NEEDS-DIRECTOR</span>: vacation/time-off final wording and data model need director approval before backend work.
- <span style="color:#7c3aed">ASSUMPTION</span>: historical docs should be indexed before any destructive consolidation.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 05:23 MDT - CODEX - Overview and dashboard main-view shells

Lane:
- Codex: scoped landing-page UI refinement, existing-widget reuse, verification.

Summary:
- Added a Today View / Widget View toggle to the member Overview page.
- Added a Command View / Widget View toggle to the admin Dashboard page.
- Added left sidebars on both pages using the same `AdminSectionNavItem` formula as Tasks, Settings, and Members.
- Kept Overview aesthetically softer and personal with Today, My Tasks, Calendar, and Messages panes.
- Kept Dashboard more operational with Command, Requests, Schedule, and Alerts panes.
- Preserved the existing full `WorkspacePanel` widget layout behind Widget View on both pages.
- Reused existing widget components and data sources; no Supabase or query behavior changed.

Files changed:
- `src/pages/Dashboard.tsx`
- `src/pages/admin/Hub.tsx`
- `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`
- `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `npm run build` passed.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Confirm whether Today View vs Widget View and Command View vs Widget View are obvious without explanation.
- <span style="color:#7c3aed">ASSUMPTION</span>: Reusing existing widget components inside non-draggable cards is acceptable for this first hierarchy pass.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 05:37 MDT - CODEX - Overview and Dashboard action/social rail polish

Lane:
- Codex: scoped landing-page UI refinement, existing-widget reuse, verification.

Summary:
- Moved the social media icon/count strip out of the crowded page-header action area on the main Overview and Dashboard views.
- Put Overview's social strip plus `Book a Session` into a warmer `Home base` sidebar footer so the page reads more like a personal landing area.
- Put Dashboard's `Quick Assign` and social strip into a neutral `Command` sidebar footer so admin action stays close without making the page feel identical to Tasks.
- Kept the previous full widget layouts behind `Widget View`, with the primary action still available beside the member strip there.
- Left data queries, Supabase behavior, routing, auth, widgets, and modal internals unchanged.

Files changed:
- `src/pages/Dashboard.tsx`
- `src/pages/admin/Hub.tsx`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `npm run build` passed.

Open gaps:
- <span style="color:#2563eb">NEEDS-VISUAL-QA</span>: Browser automation timed out on the in-app browser connection, so final visual judgment should be checked manually in the running preview.
- <span style="color:#7c3aed">ASSUMPTION</span>: Keeping social icons in the main-view side rails and keeping primary actions beside the member strip only in Widget View is the least-cluttered placement for this slice.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 05:46 MDT - CODEX - Stabilized top action strips for social and booking controls

Lane:
- Codex: scoped landing-page UI refinement, worker-obviousness implementation, verification.

Summary:
- Replaced the moving Overview/Dashboard rail-footer action clusters with stable top action strips beneath the member row.
- Added a compact `SocialStatsBar` variant so social media links can render as slimmer professional pills instead of only large circular bubbles.
- Kept `Book a Session` and `Quick Assign` visible near the top, but grouped them with the compact social strip in a cleaner horizontal layout.
- Removed the height-dependent rail footer placement that made the controls appear to jump when selecting different sidebar panes.
- Left data queries, social links/counts, modals, Supabase behavior, auth, routing, and widget rendering unchanged.

Files changed:
- `src/components/members/MemberHighlights.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/admin/Hub.tsx`
- `src/components/Layout.tsx`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `npm run build` passed.

Open gaps:
- <span style="color:#2563eb">NEEDS-VISUAL-QA</span>: User should review the running preview for final taste, spacing, and whether the compact social pills feel approachable enough.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 06:02 MDT - CODEX - Removed action-strip subtext and captured score-block direction

Lane:
- Codex: scoped landing-page UI correction, roadmap capture, verification.

Summary:
- Removed the recently-added visible "Studio pulse", "Social reach + booking", "Fast lane", and "Assign + studio reach" subtext from Overview and Dashboard.
- Kept the compact social links plus `Book a Session` / `Quick Assign` actions in stable top action strips.
- Captured the next Overview/Dashboard direction as real numbered feature blocks: tasks left, message follow-up left, sessions left today, and media added today.
- Documented that those blocks must use live product data and link back to Tasks, Forum/DMs, Booking, and Media.
- Documented that daily score history should be backend snapshot data with CSV export, not a browser-written CSV file.

Files changed:
- `src/pages/Dashboard.tsx`
- `src/pages/admin/Hub.tsx`
- `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`
- `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `npm run build` passed.

Open gaps:
- <span style="color:#d97706">NEEDS-DIRECTOR</span>: Define exact metric semantics before implementation: message follow-up, sessions left, team vs personal scope, and media count scope.
- <span style="color:#d97706">NEEDS-DIRECTOR</span>: Approve backend snapshot table/export design before any automatic daily CSV-style logging work.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 06:11 MDT - CODEX - Clarified personal-first score block semantics

Lane:
- Codex: roadmap capture, metric-scope clarification, verification.

Summary:
- Recorded that Overview score blocks are personal-first by default.
- Clarified that teamwide details should be a later toggle or drill-in, not the default worker view.
- Clarified that `Tasks left` means the user's own incomplete active task list, not only daily tasks.
- Clarified that `Message follow-up left` means personal unread/follow-up message notifications.
- Clarified that `Media added` should use a monthly count so it feels meaningful.
- Preserved the product goal: make the Overview feel fun, gratifying, and accomplishment-oriented while still tied to real data.

Files changed:
- `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`
- `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- Docs-only update; `git diff --check` passed.

Open gaps:
- <span style="color:#d97706">NEEDS-DIRECTOR</span>: Later implementation still needs code-level review of exact message follow-up source and snapshot-table permissions.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 05:02 MDT - CODEX - Tasks admin-sidebar formula alignment

Lane:
- Codex: scoped `/daily` UI refinement, existing design-pattern alignment, verification.

Summary:
- Changed `/daily` from a temporary custom task rail to the same `AdminSectionNavItem` sidebar pattern used by Settings and Members.
- Kept the task choices as My Tasks, Team Tasks, Studio Tasks, and Widget View.
- Preserved task data, Supabase behavior, completion, reorder, filter, and detail-modal behavior.

Files changed:
- `src/pages/DailyChecklist.tsx`
- `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `npm run build` passed.
- In-app browser check confirmed `/daily` has the shared task-section sidebar and opens on My Tasks.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Confirm the sidebar label names feel obvious to employees.
- <span style="color:#7c3aed">ASSUMPTION</span>: The responsive behavior should match Settings/Members, including stacking below the desktop breakpoint.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 05:08 MDT - CODEX - Tasks main-widget view split correction

Lane:
- Codex: scoped `/daily` UI correction, existing design-pattern alignment, verification.

Summary:
- Moved Widget View out of the `/daily` sidebar and made it a page-header toggle.
- Restored Widget View as the full-width task `WorkspacePanel` layout instead of a nested right-pane option.
- Kept the focused main-view sidebar limited to My Tasks, Team Tasks, and Studio Tasks.
- Changed the main task grid to stretch the sidebar down to match the content panel height.
- Preserved task data, Supabase behavior, completion, reorder, filter, and detail-modal behavior.

Files changed:
- `src/pages/DailyChecklist.tsx`
- `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --check` passed.
- `npm run build` passed.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Confirm the Main View / Widget View toggle feels obvious to employees.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-08 21:58 MDT - CODEX - Public-safe AI worker preview harness

Lane:
- Codex: safe preview strategy, fake-data static page, worker-obviousness documentation.

Summary:
- Added a public-safe, fake-data preview page that ChatGPT or another AI reviewer can explore without accessing the real login-protected workspace.
- Documented the page as an AI usability preview harness, not live app truth.
- Explicitly warned against exposing `npm run dev` publicly because local dev has a development auth bypass.

Files changed:
- `public/ai-worker-preview.html`
- `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --check` passed.
- `npm run build` passed.
- Build copied the page to `dist/ai-worker-preview.html`.
- Browser plugin blocked direct `file://` reload by policy; user will review the generated HTML/browser page manually.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: ChatGPT/AI review can find obvious friction, but real employee testing still needs Gavin or another worker.
- <span style="color:#7c3aed">ASSUMPTION</span>: Vercel preview will serve the static page at `/ai-worker-preview.html` after deployment.

Token/source note:
- Exact token total not visible in this tool. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-08 22:56 MDT - CODEX - ChatGPT role boundary and optional preview todo

Lane:
- Codex: AI role policy, safety boundaries, roadmap documentation.

Summary:
- Recorded the real-app ChatGPT preview path as a deferred, low-priority TODO rather than a default QA workflow.
- Expanded ChatGPT's lane toward public research with citations, usability scripts, microcopy, worker roleplay, feedback synthesis, and plain-language tradeoff summaries.
- Reconfirmed that ChatGPT is not a source of truth for current repo architecture, branch status, migrations, RLS, production readiness, or secrets.

Files changed:
- `docs/AI_CODERS_READ_THIS_FIRST.md`
- `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
- `docs/pwa/APP_BUILD_ROADMAP.md`
- `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --check` passed.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: real employees still need to test worker-obviousness; ChatGPT can help prepare scripts and summarize feedback, but cannot replace worker truth.
- <span style="color:#7c3aed">ASSUMPTION</span>: ChatGPT research is only evidence-grade when the session can browse and cite sources.

Token/source note:
- Exact token total not visible in this tool. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 01:00 MDT - CODEX - Daily clean-audit mobile follow-up

Lane:
- Codex: scoped `/daily` review, mobile polish, verification, checkpointing.

Summary:
- Reviewed Claude's clean-session `/daily` audit output.
- Confirmed the core `/daily` behavior is structurally sound: My Tasks opens first, My Tasks interactions stay inside `MyTasksCard`, and secondary task contexts render as panes.
- Applied the two low-risk mobile fixes from the audit: hid the redundant mobile sidebar heading and made the tall pane/content min-heights desktop-only.

Files changed:
- `src/pages/DailyChecklist.tsx`
- `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --check` passed before the docs note.
- `npm run build` passed after the `/daily` mobile fixes.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: real employee testing still needs to confirm Team Tasks vs Studio Tasks wording.
- <span style="color:#7c3aed">ASSUMPTION</span>: Claude's audit was static code review, not a live browser click-through.

Token/source note:
- Exact token total not visible in this tool. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 03:24 MDT - CODEX - ChatGPT nav research sanitized and integrated

Lane:
- Codex: documentation architecture, research intake guardrails, UX source-of-truth extraction.

Summary:
- Compressed two ChatGPT-generated navigation/task research drafts into one sanitized research proposal.
- Removed raw draft files that contained overbroad "final" and direct implementation-prompt language.
- Preserved useful source leads and product hypotheses while marking them as research intake, not roadmap truth.
- Extracted durable ideas into the web polish roadmap, Messages discovery plan, and Tasks redesign plan.

Files changed:
- `docs/ux/CHATGPT_TASK_FIRST_NAV_RESEARCH_PROPOSAL.md`
- `docs/ux/Dashboard-V3_Nav_Task_Research_Reports.md`
- `docs/ux/Dashboard-V3_Task_First_Nav_Reform_Plan.md`
- `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`
- `docs/ux/MESSAGES_DISCOVERY_PLAN.md`
- `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --check` passed after the docs update.
- `rg` check confirmed no remaining raw "Gavin owner" or "Begin implementing Phase 1" handoff language in the UX/PWA docs; remaining matches are intentional warning/checkpoint text.

Open gaps:
- <span style="color:#d97706">NEEDS-DIRECTOR</span>: Later global shell decision remains open: keep Overview as logged-in landing, or make `/daily` the default once task UI is proven.
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Test whether employees find "Messages" or "Direct Messages" clearer.
- <span style="color:#7c3aed">ASSUMPTION</span>: ChatGPT source links are preserved as research leads, not independently verified citations.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 03:34 MDT - CODEX - Messages discovery first UI slice

Lane:
- Codex: scoped worker-obviousness implementation, UI-only Messages/Forum discovery pass, verification.

Summary:
- Made the header Messages entry more discoverable by adding a visible label on wider desktop screens.
- Clarified the Messages dropdown as direct teammate chats.
- Strengthened unread states with text/counts, not only color dots.
- Made the Forum Direct Messages section more visible with a stronger header, subtitle, labeled New button, and a clear empty-state action.

Files changed:
- `src/components/messages/MessagesBell.tsx`
- `src/pages/Content.tsx`
- `docs/ux/MESSAGES_DISCOVERY_PLAN.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --check` passed before the build.
- `npm run build` passed.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Have Gavin or another worker try to find and start a DM without coaching.
- <span style="color:#7c3aed">ASSUMPTION</span>: This first slice improves discovery without needing the later full app-shell/sidebar nav reform.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 04:02 MDT - CODEX - Tasks sidebar widget-view priority fix

Lane:
- Codex: scoped `/daily` UI refinement, worker-obviousness implementation, verification.

Summary:
- Updated `/daily` to make the left sidebar match the requested task-group model: My Tasks, Team Tasks, Studio Tasks, and Widget View.
- Removed Checklist as a primary task-group pane for this slice so the sidebar is less busy.
- Restored the full task widget layout behind the Widget View option using the existing `WorkspacePanel` and `TASKS_WIDGET_DEFINITIONS`.
- Kept task data, Supabase queries, task completion, and realtime behavior unchanged.

Files changed:
- `src/pages/DailyChecklist.tsx`
- `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --check` passed before docs update.
- `npm run build` passed.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Confirm whether "Widget View" is understandable to employees and whether Checklist being inside Widget View feels discoverable enough.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-22 06:14 MDT - CODEX - Member presence persistence PR1

Lane:
- Codex: schema/RLS/RPC/auth-shell, production migration application, contract typing, checkpointing.

Summary:
- Completed the Member Activity & Presence PR1 foundation on `codex/member-presence-sessions` / PR #304.
- Added a lightweight persisted heartbeat model with `member_presence_sessions`, one open session per member, and a 10-minute idle rollover.
- Added `presence_ping(p_idle_minutes default 10)` and `presence_close()` SECURITY DEFINER RPCs; members/admins can read through RLS, writes stay RPC-only.
- Added `src/lib/queries/presence.ts` with the exported `PresenceSession` contract that PR2 `buildActivityDay` and PR3 widgets will consume.
- Wired `usePresenceHeartbeat()` into `Layout` so authenticated app sessions ping on mount, visible-tab interval, visible-tab return, and route change; sign-out awaits `presence_close()`.
- Updated `src/types/database.ts` with the matching table/RPC shape because the Supabase type-generation command requires a missing `SUPABASE_ACCESS_TOKEN` in this environment.

Files changed:
- `supabase/migrations/20260722120000_member_presence_sessions.sql`
- `src/lib/queries/presence.ts`
- `src/lib/presence/usePresenceHeartbeat.ts`
- `src/components/Layout.tsx`
- `src/types/database.ts`
- `docs/PROJECT_STATE.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `npm run build` passed after the type-contract update.
- `supabase db query --linked -f supabase/migrations/20260722120000_member_presence_sessions.sql` applied the migration to linked production.
- Direct linked-db verification confirmed `public.member_presence_sessions`, `presence_ping`, and `presence_close` exist.
- Direct linked-db policy verification confirmed exactly two RLS SELECT policies: members read own sessions and admins read team sessions.
- Direct linked-db function-shape verification confirmed `presence_ping` and `presence_close` are SECURITY DEFINER, `search_path=public`, executable by `authenticated`, and not executable by `anon` or `public`.
- `supabase db lint --linked --schema public --level warning --fail-on error` was not runnable here because the CLI needs `SUPABASE_ACCESS_TOKEN`; true Supabase Advisor/MCP verification remains a follow-up.

Open gaps:
- <span style="color:#d97706">NEEDS-DIRECTOR</span>: run Supabase Advisor / `get_advisors` from a session with Supabase Management access and confirm no new ERRORs; expected new notices, if any, should be the standard SECURITY DEFINER executable notices already accepted in this project.
- <span style="color:#d97706">NEEDS-DIRECTOR</span>: run true generated types (`supabase gen types typescript --project-id ncljfjdcyswoeitsooty`) once `SUPABASE_ACCESS_TOKEN` is available; `src/types/database.ts` currently has a hand-applied generated-shape patch for this PR's table/RPCs.
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: after PR #304 preview/main deploy, open the app as a real member, confirm a row appears, wait for the heartbeat to advance `last_seen_at`, and sign out to confirm `ended_at` is set.
- <span style="color:#7c3aed">ASSUMPTION</span>: no UI should read this table until PR2 computes activity intervals; PR1 intentionally writes only.

Token/source note:
- Exact token total not visible in this tool. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-22 08:14 MDT - CODEX - Presence PR2 handoff notes

Lane:
- Codex: documentation handoff, project-state clarification, Claude lane setup.

Summary:
- Updated `docs/PROJECT_STATE.md` so PR #304 is no longer described as in flight; it is now recorded as merged on `main` at `de402d9`.
- Added a dedicated Claude handoff anchor for Member Activity PR2 with the confirmed `PresenceSession` contract, lane boundaries, required behavior, non-goals, and verification checklist.
- Kept this pass docs-only to avoid intersecting with the existing dirty task-request modal work in `src/components/tasks/requests/TaskRequestModal.tsx`.

Files changed:
- `docs/PROJECT_STATE.md`
- `docs/00_PROJECT_OS/HANDOFF_CLAUDE_PR2_MEMBER_ACTIVITY.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --check -- docs/PROJECT_STATE.md docs/00_PROJECT_OS/HANDOFF_CLAUDE_PR2_MEMBER_ACTIVITY.md docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md` passed.

Open gaps:
- <span style="color:#2563eb">NEEDS-CLAUDE</span>: PR2 should implement the pure/data `buildActivityDay` layer only; PR3 owns the widget UI.
- <span style="color:#d97706">NEEDS-DIRECTOR</span>: Supabase Advisor and true type regeneration from PR1 still need a session with `SUPABASE_ACCESS_TOKEN`.

Token/source note:
- Exact token total not visible in this tool. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-22 (MDT) - CLAUDE - Member Activity PR2: pure day builder + read layer

Lane:
- Claude/Fable: pure/data activity aggregation for Member Activity (no UI, no schema, no writes) — the PR2 lane defined in HANDOFF_CLAUDE_PR2_MEMBER_ACTIVITY.md.

Summary:
- Added `src/lib/activity/buildActivityDay.ts` — a pure, sync, injected-`now` day builder that consumes PR1's `PresenceSession` contract (imported TYPE-ONLY so the pure/test path never pulls the Supabase client). A presence session is the active interval `[started_at, ended_at ?? now]`. Intervals are clipped to the requested local day, merged (overlapping AND adjacent) so active time is never double-counted, and unioned with per-event action-bracketing (each same-day event contributes a small interval). Returns a UI-ready `ActivityDayModel`: `scheduledWindow`, colored `segments` (`on`/`late`/`off`), `markers`, `totals`, `activeMinutes`, `firstActiveAt`, `lateArrival`, `minutesLate`. Late arrival = the first in-schedule segment whose start is past a 15-min grace gets a ≤15-min `late` head, the remainder stays `on` (both tunable via input).
- Added `src/lib/activity/queries.ts` — read-only, RLS-scoped helpers PR3 composes: `fetchMemberPresenceSessions` (member/day overlap query), `fetchMemberActivityEvents` (member/day flywheel events → normalized `ActivityEvent[]`), pure mappers `flywheelRowToActivityEvent` + `toScheduledWindows` (approved-only), and a `memberActivityKeys` React-Query key factory. No writes.
- Added `src/lib/activity/buildActivityDay.test.ts` — 20 focused tests (clipping, overlap+adjacent merging, open sessions ending at `now`, idle-separated sessions, day-boundary clipping, grace vs late head, off-schedule, no-schedule, event bracketing, marker sort, totals, out-of-day + after-now event drops). Runs on Node's built-in runner via native TS stripping — no new dependency.
- Tooling: added `"test": "node --test 'src/**/*.test.ts'"` to package.json; excluded `src/**/*.test.ts` from `tsconfig.app.json` (tests use `.ts` import extensions for Node's runtime resolver and Node-runtime patterns, so they run via `npm test` rather than the app typecheck).

Files changed:
- `src/lib/activity/buildActivityDay.ts` (new)
- `src/lib/activity/queries.ts` (new)
- `src/lib/activity/buildActivityDay.test.ts` (new)
- `package.json` (test script)
- `tsconfig.app.json` (exclude test files)
- `docs/PROJECT_STATE.md`, `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

What PR3 can consume:
- `buildActivityDay({ presenceSessions, events, scheduledWindows, dayStart, now, ... })` → `ActivityDayModel`, ready to render the frozen widget spec directly (segments → bar colors, markers → proximity icons/ticks, totals + activeMinutes → summary, scheduledWindow → header "Scheduled …"). Fetch inputs via `queries.ts`; map the member's `expandSchedule` output through `toScheduledWindows`.

Verification:
- `npm run build` clean (tsc -b + vite build; only the pre-existing chunk-size warning).
- `npm test` → 20/20 pass on Node 24's built-in runner.

Non-goals held: no widget UI, no admin surface, no attendance exceptions, no schema/RPC/migration, no clock-button changes, no direct writes, no notification/forum/task-request/calendar UI. Did not touch Codex's presence.ts / schema / RLS.

Open gaps:
- <span style="color:#2563eb">NEEDS-CLAUDE</span>: PR3 builds `MyActivityTodayWidget` on member Overview to the frozen visual spec, consuming this layer.
- <span style="color:#7c3aed">ASSUMPTION</span>: `deliverable` flywheel source maps to the `video` marker type; `checklist` folds into `task`. Revisit if PR3 wants finer categories.

Signature:
- CLAUDE:

## 2026-07-23 MDT - CODEX - Schedule request language branch reconstruction

Lane:
- Codex: cross-agent branch overlap review, source-branch reconstruction, behavior audit, verification, and publishing.

Summary:
- Reviewed Claude's schedule-language handoff against current `origin/main`.
- Found the original `codex/schedule-ux-language-pass` branch was based before PRs #307–#309, so publishing the branch wholesale would have reintroduced unrelated task/admin diffs and shown a migration deletion.
- Reconstructed the change from current `origin/main` using only the isolated schedule-language commit.
- Confirmed the final code diff is limited to the four intended schedule surfaces.
- Confirmed the visible "Request time off" path is informational only: it renders no form, has no submit handler, and calls no schedule mutation.

Files changed:
- `src/components/admin/WorkScheduler.tsx`
- `src/components/dashboard/MyScheduleWidget.tsx`
- `src/components/schedule/ScheduleRequestModal.tsx`
- `src/pages/Calendar.tsx`
- `docs/PROJECT_STATE.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --name-status origin/main..HEAD` showed only the intended schedule files before checkpoint docs were added.
- `git diff --check origin/main..HEAD` passed.
- `npm run build` passed from the clean worktree.
- Manual source audit confirmed existing weekly and one-time mutation functions are unchanged and the time-off placeholder performs no write.

Open gaps:
- <span style="color:#d97706">NEEDS-DIRECTOR</span>: Time-off submission remains intentionally unavailable until PR4's schema/RLS/RPC contract is reviewed and approved.
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Verify the three schedule choices and both existing submit paths in the Vercel preview on desktop and phone.
- <span style="color:#7c3aed">ASSUMPTION</span>: "Time off" remains the director-approved worker term for the upcoming data-backed path.

Token/source note:
- Exact token total not visible in this tool.

Signature:
- CODEX:

## 2026-07-24 00:54 MDT - CODEX - PR4A time-off schedule contract

Lane:
- Codex: schedule schema, ownership boundary, RLS, generated-type contract,
  and pure effective-schedule integration. No time-off UI.

Summary:
- Added `team_id` to recurring schedules and one-off blocks, backfilled it
  from each target member, made it required, and installed a trigger that
  derives ownership from `member_id` on every insert or ownership update.
- Replaced the prior globally readable schedule policies and admin-global
  writes with direct, indexed team-scoped RLS. Member request/withdraw
  policies remain self-only, pending-only, and are now team-scoped too.
- Added block `kind`, constrained to `work | time_off`; existing and omitted
  values default to `work`.
- Added shared pure interval helpers and one effective-schedule resolver:
  approved work windows are merged, then approved time off is subtracted.
  Pending/denied time off never changes the effective schedule.
- Updated Member Activity to preserve distinct effective windows. The
  compatibility `scheduledWindow` envelope remains for existing display
  consumers, while new/correct consumers use `scheduledWindows`.

Files changed:
- `supabase/migrations/20260724100000_schedule_time_off_and_team_scope.sql`
- `src/lib/time/intervals.ts`
- `src/lib/schedule/effective.ts`
- `src/lib/schedule/effective.test.ts`
- `src/lib/schedule/expand.ts`
- `src/lib/schedule/mutations.ts`
- `src/lib/activity/buildActivityDay.ts`
- `src/lib/activity/buildActivityDay.test.ts`
- `src/lib/activity/queries.ts`
- `src/types/index.ts`
- `src/types/database.ts`
- `docs/PROJECT_STATE.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Production migration and security verification:
- Applied the canonical migration idempotently to linked Supabase project
  `ncljfjdcyswoeitsooty`.
- Recorded migration version `20260724100000` as
  `schedule_time_off_and_team_scope`.
- Post-apply data: 18 recurring rows, 0 block rows, 0 null `team_id` rows.
- Verified `team_id` is NOT NULL on both tables, `kind` is NOT NULL with
  default `work`, both foreign keys and the `work | time_off` check exist,
  and both ownership triggers are installed.
- Runtime RLS check as authenticated member
  `08a3f059-61ef-4852-a627-5a270c7e8912` returned 18 own-team rows and
  0 cross-team rows.
- Transactional member-request test derived the correct team, defaulted
  `kind=work`, enforced `status=pending`, and was rolled back.
- Supabase hosted Security Advisor: 0 errors.
- Supabase hosted Performance Advisor: 0 errors.

Verification:
- `npm test -- --run`: 26/26 pass.
- `npm run build`: passed; only the pre-existing Vite chunk-size warning.
- TypeScript schema shape was synchronized against the verified live catalog,
  including both new team foreign-key relationships.

Open gaps:
- <span style="color:#2563eb">NEEDS-CLAUDE</span>: PR4B may wire the existing
  Time-off placeholder to `kind='time_off'`; members create pending requests,
  admins may create approved rows for any member in their team.
- <span style="color:#d97706">TOOLING</span>: automated
  `supabase gen types --linked` and CLI `db lint` remain unavailable because
  this machine has linked SQL-query access but no `SUPABASE_ACCESS_TOKEN`.
  Hosted advisors and direct catalog/RLS checks were used instead; do not
  represent the type file as CLI-generated.

Signature:
- CODEX:

## 2026-07-24 (MDT) - CLAUDE - PR4B: Time Off schedule experience

Actor: Claude (Sonnet 5)
Lane: Claude/Fable focused implementation (UI only, per Codex's handoff)
Branch: `claude/pr4b-time-off`, off `origin/main` at `4253ca6` (confirmed contains
both PR #312 and PR #311 before starting, per handoff step 3)

Summary:
- Replaced `ScheduleRequestModal.tsx`'s `TimeOffPlaceholder` with a real
  `TimeOffForm` (start date + end date, same date = one day, optional
  reason) submitting `requestScheduleBlock({ ..., kind: 'time_off' })`.
  Removed the "Soon" badge.
- Added an "Add time off" admin action (`AdminTimeOffForm`) to
  `WorkScheduler.tsx` calling `createBlockAsAdmin({ ..., kind: 'time_off',
  status: 'approved' })` — admin entries auto-approve, member requests stay
  pending through the existing `approveBlock`/`denyBlock` review path.
  Pending-review rows and the approved one-off list both show a distinct
  "Time off" label + date-range (not time-range) display.
- Time off renders with a distinct sky-blue treatment (never the purple
  work-shift styling, never a work wash block) in `MyScheduleWidget.tsx`,
  `ProfileWeeklySchedule.tsx`, and Calendar's Team Schedule tab (a separate
  diagonal-striped full-day band, layered apart from the existing
  avatar-segment work-shift wash).
- No migrations, RLS, RPC, or schema changes — consumed the landed PR4A
  contract (`ScheduleBlockKind`, `requestScheduleBlock`,
  `createBlockAsAdmin`, `approveBlock`/`denyBlock`,
  `resolveEffectiveWorkWindows`) as-is.

Bug found and fixed while implementing (presentation layer only):
- `expandSchedule()` (`src/lib/schedule/expand.ts`) emits one row per
  one-off block, not one row per day it spans. Every surface that buckets
  entries "by day" (`MyScheduleWidget`'s 7-day list, Calendar's Team
  Schedule tab) was keying off `starts_at`'s date only — a 3-day time-off
  request would only have appeared to cover its first day. Fixed by
  bucketing each entry into every local day it overlaps. `expandSchedule()`
  and `resolveEffectiveWorkWindows()` themselves were not modified.

Files changed:
- `src/components/schedule/ScheduleRequestModal.tsx`
- `src/components/admin/WorkScheduler.tsx`
- `src/components/dashboard/MyScheduleWidget.tsx`
- `src/components/members/ProfileWeeklySchedule.tsx`
- `src/pages/Calendar.tsx`
- `src/lib/schedule/expand.ts` (added shared `formatTimeOffDateRange` helper)
- `docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md`, `docs/PROJECT_STATE.md`

Verification:
- `npm test -- --run`: 26/26 pass, unchanged (5 pre-existing cases cover
  time-off interval subtraction in `resolveEffectiveWorkWindows`).
- `npx tsc -b`: clean.
- `npm run build`: clean (pre-existing chunk-size warning only).
- Date-math (full-day span construction, no UTC/off-by-one drift under
  America/Denver) verified with a rolled-back transaction test directly
  against production (`ncljfjdcyswoeitsooty`) via Supabase MCP.
- Modal UI verified in a local dev preview: mode switching, no stale
  "Soon" badge, correct today-based date defaults, multi-day date-range
  selection all behave correctly.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: this session's
  local dev preview had no reachable Supabase backend (every request
  resolved to `localhost` and failed — a pre-existing environment
  limitation unrelated to this change, confirmed via network inspection).
  The actual submit → pending row → admin approve/deny round trip and
  dark-mode/mobile screenshots could not be captured live. Recommend a
  short manual pass on the PR's Vercel preview before merge.
- Token note: exact token total not visible in this tool.

Signature:
- CLAUDE:
