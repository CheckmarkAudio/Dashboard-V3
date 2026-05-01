# Project State — Checkmark Audio Dashboard

> **Single source of truth** for what's live, what's in flight, what's deferred.
> Read this BEFORE doing any work to understand current context.
> Updated each meaningful commit.

---

## Snapshot

| | |
|--|--|
| **Live URL** | https://dashboard-v3-dusky.vercel.app |
| **Hosting** | Vercel (auto-deploys from `main`) |
| **Database** | Supabase project `ncljfjdcyswoeitsooty` ("Checkmark Intern Manager") |
| **Latest commit (main)** | PR #61 in flight — `feat(time-clock): Members > Clock Data shift log table`. PR #50 (Clock In/Out persistence) + #58 (Members left-rail) + #60 (remove subtitles) + #59 (Assign alignment) merged just prior. |
| **Currently active** | **Tier 2 maturity sequence in motion.** User unblocked everything on 2026-04-29 by answering the batch of Tier 2 questions (clock-in/out spec, EmailJS path, exports, flywheel feels-decorative, future chat/forum direction). Assign-page redesign moved to maintenance — the "Save as Template" + "Settings for Tasks" stubs deferred. Active sequence: ✅ PR #58 Members left-rail restructure → **PR #50 Clock In/Out persistence (in flight)** → next: populate Members Clock Data pane with shift history (queued follow-up to PR #50) → EmailJS confirmations + 24h reminder + 1hr-after review-ask cron → reusable `<ExportButtons />` → flywheel event ledger (Tier 2 PRs write rows as side effects so the widget stops feeling decorative). |
| **Prior active** | PR #58 restructured Members admin around Settings-style left-rail; PR #60 removed page-header subtitles for the modern/sleek pass; PR #59 fixed Assign right-pane alignment. |

---

## Architecture (where things live)

| Area | Implementation |
|--|--|
| **Hosting** | Vercel; `vercel.json` at repo root; SPA rewrites + smart cache headers |
| **Auth** | Supabase Auth, `flowType: 'implicit'`, `lock` disabled in `src/lib/supabase.ts` |
| **Recovery flow** | Inline `<script>` in `src/index.html` detects `#type=recovery` BEFORE supabase-js init; `src/components/auth/RecoveryGate.tsx` intercepts every route when flag is set |
| **Owner protection** | 3 layers: DB triggers (`protect_owner_update`, `protect_owner_delete`), `OWNER_EMAIL` constant in `src/domain/permissions/index.ts`, email-first `getAppRole(email)` |
| **Permission model** | `owner` / `admin` / `member` roles; `team_members.role` is `'admin' \| 'intern'` in DB (intern = member-tier) |
| **Account creation** | `admin-create-member` edge function (proper GoTrue admin API) called from `TeamManager.tsx`; or direct SQL with `auth.users` + `auth.identities` + `team_members` for ad-hoc adds |
| **Account access UI** | `src/components/admin/AccountAccessPanel.tsx` — owner-only role toggle + password reset; `owner_set_member_role()` and `owner_reset_member_password()` RPCs |
| **Tables** | Renamed to `team_*` with `intern_*` compat views (Phase B done; Approach A column rename deferred) |
| **Code splitting** | Per-route `React.lazy()` in `src/features/{member,admin}/routes.tsx`; `<Suspense>` in `Layout.tsx` |
| **Theme** | `light` \| `dark` \| `system`; `src/contexts/ThemeContext.tsx`; localStorage-only (DB persistence deferred) |
| **Design tokens** | `src/index.css` `@theme` block — brand gold scale 50-950, neutrals, semantic status, flywheel stages, animations. **This is canonical** — matches the v1.0 PDF design system. |

---

## Vision & origin

**Business**: Checkmark Audio — a music studio in Albuquerque (recording, mixing, education, artist development).

**Why this dashboard exists**: streamline ops for a small growing team. Increase productivity, workflow, and quality of services delivered. The team includes ADHD employees, so the UX needs to be engageable, clickable, and satisfying — not bureaucratic.

**The flywheel model** (the core conceptual framework):
The business runs on a 5-stage flywheel — **Deliver → Capture → Share → Attract → Book**. Each stage feeds the next. Operations should track health across all five stages and surface where momentum is breaking.

**The three core entities** that feed flywheel KPIs:
- **Bookings** — calendar appointments (creating one increments Book-stage KPI)
- **Tasks** — team activities to complete (checking one off increments the relevant stage KPI)
- **Sessions** — completing the actual booked work (closing one increments Deliver-stage KPI)

**The current build is foundation work.** The flywheel event ledger that derives KPIs from this entity activity is **deferred** (see Deferred section). Today's analytics show empty-state placeholders.

**Earlier evolution** (briefly):
- Codex did Phase 1 architecture work (permissions, route split, workspace foundation, blueprint at `docs/REBUILD-BLUEPRINT.md`).
- Code-quality and architectural critiques drove subsequent reform: real-data migration off mock contexts, admin/member symmetry, responsive widgets, theme toggle.
- An auth-bug saga (PKCE recovery race, supabase-js lock contention, GoTrue raw-SQL incident with Bridget) drove the auth hardening you see today.
- The intern→team rename Phase B closed the biggest naming-debt item with zero downtime.
- Vercel migration replaced GitHub Pages, eliminating the "hard refresh after every deploy" friction.

---

## Key architectural decisions (the reasoning, not just the what)

These are the load-bearing decisions. If you're considering reversing one, read the rationale first.

**1. Vercel over GitHub Pages**
- *Why:* edge CDN, automatic preview URLs per branch, smart cache invalidation, no manual "hard refresh" needed, ~30s deploys.
- *Trade-off:* Vercel free tier is technically "personal use" per ToS — for a small low-traffic internal tool, enforcement is reputation-based and we accept that risk. Pro is $20/mo if ever needed.
- *Date:* 2026-04-16 — commits `5be53d9` (prep) + `3ca605d` (migration).

**2. Compat views for table renames (Stripe/Shopify pattern)**
- *Why:* rename DDL is atomic; old code keeps working transparently through views; code sweep can happen at any pace; trivially reversible (just drop the views).
- *Trade-off:* views add ~1KB metadata total, zero runtime cost (Postgres inlines simple `SELECT *` views at plan time).
- *Date:* 2026-04-17 — migration `intern_to_team_rename_phase_b`. See `docs/intern-rename-resume/02-strategy.md`.

**3. 3-layer owner protection**
- *Why:* defense-in-depth — a UI bug OR DB drift OR code refactor must not be able to lock the primary admin out of their own app.
- *Layers:* (1) DB triggers `protect_owner_update`/`protect_owner_delete` coerce any change back; (2) `OWNER_EMAIL` constant hardcoded in `src/domain/permissions/index.ts`; (3) `getAppRole(email)` returns `'owner'` based on email match alone, before ever reading the profile.
- *Date:* 2026-04-16 — built reactively after Bridget's login race exposed the need.

**4. Implicit auth flow over PKCE**
- *Why:* PKCE encodes password-recovery URLs as `?code=XXX` query params. The entire `RecoveryGate` + inline-script detection layer was built for the `#type=recovery&access_token=...` hash format. PKCE would require rebuilding every detection layer.
- *Trade-off:* implicit is marginally less secure than PKCE for SPAs, but for an admin-provisioned-accounts model on a known domain, implicit is fine.
- *Date:* 2026-04-16 — commit `50b852a` ("I believe in you Claude").

**5. Code splitting via React.lazy + Suspense**
- *Why:* pre-split bundle was 1.1MB. Admin pages — especially `BusinessHealth.tsx` which pulls in the 308KB recharts library — should not load for member-only employees.
- *Trade-off:* per-route lazy loading adds a brief loading spinner on first navigation; Suspense boundary in `Layout.tsx` makes the loading state consistent across routes.
- *Date:* 2026-04-17 — commit `ba76dfb`.

**6. Disable `navigator.locks` in supabase-js**
- *Why:* stuck-state lock errors (`"Lock was released because another request stole it"`) cannot be retried away — the lock is held until the other tab releases it. Multi-tab is rare in this app's actual usage.
- *Trade-off:* if two tabs ever refresh tokens simultaneously, both refresh — Supabase's server tolerates this (last write wins, session stays valid).
- *Date:* 2026-04-16 — in `src/lib/supabase.ts`.

**7. Email-based password reset over admin-shared temp passwords**
- *Why:* matches Gmail/Apple/professional UX; no plaintext passwords in chat or email; recovery link auth is industry-standard.
- *Trade-off:* requires email infrastructure (Supabase auto-handles this on free tier); admin can still send temp passwords via Account Access UI for special cases.
- *Date:* 2026-04-16.

**8. Approach B for rename (tables only, defer columns)**
- *Why:* simple `SELECT *` compat views (~80 lines of SQL) instead of column-aliasing views (~200 lines). Half the code-sweep surface. Lower typo risk per migration attempt.
- *Trade-off:* column names like `intern_id` remain inconsistent with the renamed `team_members` table for now. Cleanup is a future focused session (Approach A — see `docs/intern-rename-resume/`).
- *Date:* 2026-04-17.

---

## Timeline

| Date | Commit | What landed |
|--|--|--|
| 2026-04-16 | `5be53d9` | Vercel migration prep (removed deployToRoot, added vercel.json) |
| 2026-04-16 | `f3a9442` | Connected to Checkmark Intern Manager Supabase project |
| 2026-04-16 | `2a1aaf3` | Login flow hardening (legacy JWT, transient-error retry, owner row triggers) |
| 2026-04-16 | `8026094` | Demo mode bypass for missing env vars |
| 2026-04-16 | `4eccde5` | Recovery email flow — RecoveryGate, email-based reset |
| 2026-04-16 | `5169163` | Hardened signOut — local clear before server revoke |
| 2026-04-16 | `50b852a` | Auth: PKCE → implicit, deferred async in onAuthStateChange, eager recovery render |
| 2026-04-16 | `97d5ff6` | Inline recovery-hash detection in `src/index.html` (beats supabase-js init race) |
| 2026-04-16 | `887c902` | Clock-out modal "Log Out" button actually signs out |
| 2026-04-17 | `0e6ddc7` | Phase 4 cleanup — removed GH Pages workflow + stale build artifacts |
| 2026-04-17 | `2c0d285` | Stripped placeholder data (forum mocks, TaskContext seeds, Flywheel mockup) |
| 2026-04-17 | `473f04c` | Analytics + Flywheel merged into one page; "Content" nav renamed to "Forum" |
| 2026-04-17 | `b0ec210` | Profile/MyTeam/Forum/Overview rewired to real `intern_users` queries |
| 2026-04-17 | `9a82a12` | `sessions.assigned_to` column added; bookings persisted to Supabase |
| 2026-04-17 | `ba76dfb` | Code-split routes via React.lazy + Suspense in Layout |
| 2026-04-17 | `4ac735c` | **Phase B rename** — 10 `intern_*` tables → `team_*` + compat views; 103 source refs updated; `src/types/database.ts` regenerated |
| 2026-04-17 | (DB only) | Created accounts: Richard Baca (engineer), Matthan Bow (intern) — temp pw `ChangeMe2026!` |
| 2026-04-18 | `c08b7e4` | Overview Piece 1 — removed Admin Shortcuts / Approval Queue / duplicate Today Schedule / Daily Snapshot; renamed "Today Schedule" → "Calendar" |
| 2026-04-18 | `1d88558` | Overview Piece 2 — Tasks widget readable fonts (14px body) + TODAY eyebrow |
| 2026-04-18 | `96d6d10` | Overview Piece 2.5 — smarter 3-pass stage mapping + rotating All-tab sort so colors span flywheel stages |
| 2026-04-18 | `bcfd644` | Overview Piece 3 — Calendar widget: TODAY anchor + Mon–Sun weekday strip with today highlighted in gold |
| 2026-04-18 | `e210c2b` | Overview Piece 4 — Booking widget: TODAY anchor + UPCOMING TODAY count + "+ Book a Session" CTA |
| 2026-04-18 | `07daea6` | Overview Piece 5B — forum recent-activity feed (transient, superseded by 846673b) |
| 2026-04-18 | migration | `chat_channel_reads` table + RLS + `mark_channel_read()` RPC + `get_channel_notifications()` RPC for per-user unread tracking |
| 2026-04-18 | `846673b` | **Overview Piece 5A** — Discord-style Notifications widget: per-channel unread badges, optimistic mark-read on click, realtime refresh on new messages |
| 2026-04-18 | `8347d79` | Overview reorder — Tasks/Notifications on top row, Calendar/Booking on bottom; layout version bumped to 3 so all users pick up the new default |
| 2026-04-18 | `5a18d9d` | **Admin Hub redesign** — 5 widgets (Assign, Flywheel, Team, Notifications, Approvals) in a 2-big-left + 3-right grid; added rowSpan support; Hub.tsx simplified to PageHeader + WorkspacePanel; admins no longer see member widgets on Hub |
| 2026-04-20 | `df1b0a4` | **Overview visual polish** — `MyTasksCard.embedded` prop kills the double "My Tasks" title + double `widget-card` border when mounted inside `DashboardWidgetFrame`; Day/Week toggle collapses onto the stage-pill row. Rebalance row spans (team_tasks 3 → 2, forum_notifications 1 → 2) so both Overview columns terminate at the same Y — zero dead space. Layout version bumped 7 → 8 to flush saved layouts. |
| 2026-04-20 | `28246f7` | **Phase 1 Step 1 — load-perf instrumentation.** Opt-in `perfTrace` module (`src/lib/perfTrace.ts`); wraps auth / overview batch / streak / checklist paths. Console emits a grouped cold-start waterfall when `localStorage.debugPerf = '1'`. No prod overhead. |
| 2026-04-20 | `cf39bb6` | perf: satisfy strict TS in production build (tsconfig happy path). |
| 2026-04-20 | `a6e0a83` | perf: gate the Overview flush on `profile` so the waterfall captures real queries, not just `auth:getSession`. Fixes early-flush bug where `MemberOverviewContext.refetch()` early-returns when `!profile`, flipping `loading` false before queries run. |
| 2026-04-20 | — | **Perf baseline locked.** Production cold-start on `dashboard-v3-dusky.vercel.app` is 1,289ms over 8 checkpoints. Longest single span: `overview:batch` 427ms. Three `auth:fetchProfile:byId` fetches — tied to the `"Multiple GoTrueClient instances"` warning. Full waterfall in `docs/SESSION_CONTEXT.md` → Performance baseline. |
| 2026-04-20 | `c719ef2` (PR #1) | **Phase 1 Step 2A — duplicate Supabase client removed.** Deleted `src/lib/chatSupabase.ts` (second `createClient` with default auth config colliding on the same storage key); consolidated 8 call sites in `Content.tsx` + `adminHubWidgets.tsx` to the main `supabase` client. Preview cold-start drops to 998ms / 7 checkpoints / `overview:batch` collapses 427→185ms. `"Multiple GoTrueClient instances"` warning GONE. One parallel `auth:fetchProfile:byId` remains (was 3×, now 2×). |
| 2026-04-20 | `341d2d1` (PR #2) | **Phase 1 Step 2A' — profile-fetch dedupe.** Added `handledForUserId` ref + `maybeFetchProfile` wrapper in `AuthContext.tsx` so the `getSession().then(fetchProfile)` and `onAuthStateChange(INITIAL_SESSION)` paths no longer both fire. Ref releases on transient errors, sign-out, and `rejectAndSignOut` so retries + sign-in cycles still work. 2×→1× profile fetch. Architectural hygiene win; latency-wise ~stable since the two fetches were parallel. `refreshProfile()` intentionally bypasses the dedupe so admin profile edits still re-read. |
| 2026-04-20 | `85b7df7` (PR #3) | **Phase 1 Step 2B — cron-materialize checklist instances + client fast-path.** 3 Supabase migrations (`enable_pg_cron_and_cron_run_log`, `cron_materialize_checklists_function`, `schedule_materialize_checklists_cron`) + 1 client change in `useChecklist.ts`. pg_cron runs daily at 11:00 UTC (5am MDT / 4am MST) calling `cron_materialize_checklists()` which iterates active members and calls the existing RPC — results logged to `cron_run_log`. Client hits `team_checklist_instances` directly before falling back to the RPC. On cold start the RPC never fires. −~170ms on critical path. |
| 2026-04-20 | `4e666b9` (PR #4) | **fix(perf-trace): gate Overview flush on completed-batch-for-profile-id.** Surfaced the TRUE post-2B waterfall — previous "870ms / 7 checkpoint" reading on PR #2 was an artifact: the flush fired early when `profile` arrived, before the second `refetch` pass started. Added `lastLoadedProfileId` ref set only inside `refetch`'s success path; tightened flush gate to `profile && lastLoadedProfileId.current === profile.id && !loading && !daily.loading`. Mirrors the `handledForUserId` pattern from PR #2. No user-facing behavior change — pure measurement correctness. |
| 2026-04-20 | — | **True cold-start locked: 826ms on PR #4 preview.** 6 clean checkpoints, `checklist:rpc` absent (backend-prepared state holds). Longest single span: `checklist:items` 265ms (items fetch for the 22 daily rows). Remaining ~100ms gap between profile-fetch end (@266ms) and parallel batch start (@372ms) is the React.lazy / provider-mount gap that 2C will naturally shrink. Full day net: **1,289ms → 826ms = −36% / −463ms**. |
| 2026-04-21 | `357562c` (PR #5) | **Phase 1 Step 2C — snapshot RPC.** One `member_overview_snapshot(p_user_id, p_date)` SECURITY DEFINER function replaces four parallel client waves (`overview:batch` + `overview:streak` + `checklist:lookup` + `checklist:items`). Server derives `submission_type` from `team_members.position` (authoritative read path per Codex peer-review); `mustDoConfig.ts` still owns the write path. Indexes added on `deliverable_submissions`, `sessions`, `member_kpis`. `MemberOverviewContext` split into outer provider + inner `MemberOverviewLoaded` that mounts fresh when snapshot arrives; `useChecklist` accepts validated `PreloadedChecklist` with metadata-match check. Preserves pre-2C `kpi_entries` ordering bit-for-bit (flagged latent bug for separate PR). Preview cold-start locked: **470ms with 3 checkpoints** — ONLY `auth:getSession`, `auth:fetchProfile:byId`, `overview:snapshot`. Server-side RPC execution 7.3ms per EXPLAIN ANALYZE. Full Phase 1 Step 2 arc: 1,289ms → 470ms = **−64% / −819ms**. |
| 2026-04-22 | `ec8d3b7` (PR #11) | **Unify member task surface.** AssignGroupModal rewired to new RPC pipeline (fires notifications). MyTasksCard rewrites to read `assigned_tasks` directly via `fetchMemberAssignedTasks` with optimistic complete + realtime. Mock MyTasksContext + CreateTaskModal deleted. AssignedTasksWidget retired, content folded into `team_tasks`. `WORKSPACE_LAYOUT_VERSION` 9→10. Click-to-highlight: notification → `highlight-task` CustomEvent → MyTasksCard scrolls + flashes. |
| 2026-04-22 | `0b09313` (PR #12) | **Scope foundation + three-column Tasks page.** Migration adds `assigned_tasks.scope` ('member'|'studio') + `completed_by` + indexes + `assigned_to` nullable + scope-vs-assignee CHECK. Two new RPCs: `get_team_assigned_tasks`, `get_studio_assigned_tasks`. `/daily` rebuilt around three cards (My · Studio · Team) reading the real data. New `AssignedTaskBoards.tsx` component with graceful fallback when migration unapplied. |
| 2026-04-22 | `9cf9bf5` (PR #13) | **Assign page redesign + session-assign pipeline + preview auto-login.** `/admin/templates` now three sections: Quick Assign widget (inline compose) + Assign-a-Session tile + Templates grid. Session-assign: new `assign_session` RPC, `sessions.assigned_to` update + notification atomic; `assignment_notifications` gains `session_id` (XOR with `batch_id`). `get_assignment_notifications` rewritten LEFT JOIN style to surface both shapes. Notification click routing branches on `session_id`. Preview auto-login: `Login.tsx` reads `VITE_PREVIEW_LOGIN_*` env vars and silently signs in when hostname matches `dashboard-v3-git-*.vercel.app` (production alias hardcoded excluded). |
| 2026-04-22 | `aa53c79` (PR #14) | **Studio scope write-path + scope-aware completion guard.** `assign_custom_task_to_members` gains `p_scope` param (defaults 'member'; 'studio' creates single row, no recipients, no notifications). `complete_assigned_task` branches on scope: member → assignee+admin only; studio → any authenticated team member. `assigned_tasks.recipient_assignment_id` relaxed nullable. QuickAssignWidget gets Members/Studio toggle in header; studio mode hides recipient picker and shows pool-semantics note. `completed_by` now recorded on every completion. |
| 2026-04-22 | `eef4ff3` (PR #15) | **Session polish.** `/sessions` listens for `highlight-session` CustomEvent (shipped in PR #13) — scroll-and-flash on the matching row, mirrors PR #11 MyTasks pattern with a pending-highlight buffer. New `findEngineerConflict` helper + amber warning banner in SessionAssignModal when selected engineer has overlapping booking; non-blocking (studios sometimes double-book on purpose). |
| 2026-04-22 | `c0e6a47` (PR #16) | **User task requests + admin approval queue.** New `task_requests` table with RLS. 5 RPCs (`submit_task_request`, `approve_task_request`, `reject_task_request`, `get_pending_task_requests`, `get_my_task_requests`). Approval atomically materializes an `assigned_tasks` row + fires notification; reject stores optional note. `assignment_notifications` gains `task_request_id`; XOR CHECK relaxed to "exactly one of (batch, session, task_request)". Enum gets 3 new types. MyTasksCard adds "+ Task" button + expandable pending-requests strip. New `PendingTaskRequestsWidget` on admin Hub (span 2). `WORKSPACE_LAYOUT_VERSION` 10→11. |
| 2026-04-23 | `a13dbe4` (PR #17) | **Rich +Task modal.** Bottom-of-list placement (Monday.com "+ Add item" pattern); title + description + flywheel stage picker + due-date; tags carry through to the request → approval → materialized task. Fixes the prior 1-line modal that missed stage tagging. |
| 2026-04-23 | `148257a` · `c07a7ea` (PRs #18–#19) | **Unified admin task modal + Hub placement flip.** Consolidated 3 overlapping admin modals (AssignTaskModal, AssignCustomTaskModal, AssignGroupModal) into one Hub-owned Quick Assign modal with recipient + scope + template triggers. Hub's Assign widget flipped to lead with Quick Assign (high-traffic); Flywheel / Team / Notifications reordered per use frequency. |
| 2026-04-23 | `0054dea` · `6924b41` (PRs #20–#21) | **Assign Trello-style 3-column layout.** `/admin/templates` split into Assign / Approve / Templates columns. Pinned-tile pattern at top of Assign column; canonical Ableton-style filter pills with counts on Templates. Equal-width columns so tiles don't jostle when content changes. |
| 2026-04-23 | `371a547` · `e789f33` (PRs #22–#23) | **Overview 3-column layout + shared CalendarDayCard.** Overview grid flattened to 3 equal columns; Tasks + Booking split from one stacked card into two standalone widgets so drag-reorder treats them independently. New `CalendarDayCard` extracted — same day-view renders inside the Overview Calendar widget AND on the `/calendar` page (chevron day-nav + notes). |
| 2026-04-23 | `7f03e7e` (PR #24) | **Hub 3-column layout.** Hub rebuilt to Quick Assign+Approvals · Flywheel · Notifications+Team. Equal-width columns, uniform widget chrome, mixed row-spans. |
| 2026-04-23 | `f9b4279` · `ac8615d` (PRs #25–#26) | **TaskDetailModal + split click surfaces + notification click routing.** Task row splits into two click targets: checkbox (complete) vs body (open detail modal). New `TaskDetailModal` shows full task with description, scope, flywheel tag, recipients, complete/cancel actions. Notification clicks route by status (`task_request_submitted` → Hub approval; `task_request_approved` → highlight the materialized task). |
| 2026-04-23 | `b594b2b` · `ebd833e` (PRs #27–#28) | **Flywheel widget wired to real task counts + cache fix.** Hub flywheel widget now reads `assigned_tasks` aggregated per stage; dual-opacity bars (opaque = completed, translucent = assigned-open). PR #28 fixed a cache-invalidation miss — approving a tagged request now invalidates `['team-assigned-tasks']` + `['studio-assigned-tasks']` so the flywheel updates without refresh. Completion in MyTasksCard invalidates same keys. |
| 2026-04-24 | `c266640` · `334e55f` (PRs #29–#30) | **WorkspacePanel restored across all 4 pages + per-page scopes.** Overview / Hub / Tasks / Assign all on `WorkspacePanel` with equal-width 3-column grid, drag-reorder via `DashboardWidgetFrame` grip, expand-to-modal via the maximize icon. PR #30 fixed regressions: `TASKS_WIDGET_DEFINITIONS` + `ASSIGN_WIDGET_DEFINITIONS` exported with scope filtering so each page gets the right widgets (e.g. Tasks shows `team_tasks` + `studio_tasks` + `team_board`; Assign shows `admin_assign` + `admin_task_requests` + `admin_templates`). Row-spans restored so Overview column-1 stacks Tasks+Booking under a 2-row Calendar/Notifications. `WORKSPACE_LAYOUT_VERSION` 11→14. |
| 2026-04-24 | `76884fa` (PR #31) | **Hide workspace controls bar site-wide.** All 4 pages pass `showControls={false}`. With the decision to keep all widgets visible + non-removable for now, the "Arrange your …" card added nothing the widget frames don't already do. Drag + expand still work (they live on each widget's frame, not the controls card). |
| 2026-04-24 | `a48b081` (PR #32) | **Column-snap widget grid with smooth drag.** `WorkspacePanel` rewrite from implicit row-major flow to 3 independent `SortableContext` column stacks. Widget state gains `col` (1..3); `order` is now per-column. Grid renders via 3 Tailwind `grid-cols-3` columns with `verticalListSortingStrategy` inside each. Smoothness fixes: `DragOverlay` renders a widget-shaped gold-outlined ghost tracking the cursor; original slot dims to 0.35 opacity with a dashed gold ring as "card goes here" affordance; cross-column moves happen live so target-column siblings glide out of the way; `closestCorners` as collision detection (the dnd-kit multi-container recommendation). `moveWidgetByDropTarget(activeId, overId)` handles both `col-N` droppable ids and widget ids; all destination resolution happens inside `setLayout`'s functional update so rapid-fire onDragOver calls can't race. `WORKSPACE_LAYOUT_VERSION` 14 → 15. |
| 2026-04-24 | `dd105b0` (PR #33) | **Taller Tasks widgets + compact Booking button + `assignee.name` bug fix.** Three focused changes: (1) `/daily` task widgets (My Tasks · Studio Tasks · Team Tasks) bumped from rowSpan 1 (340px) to rowSpan 2 (696px) so long queues show many rows at a glance. (2) `BookingSnapshotWidget` stripped to just TODAY eyebrow + a prominent "+ Book a Session" button — upcoming-today counter + next-session detail removed. New fractional rowSpan 0.5 (~170px) supported by `widgetHeight()` and `WidgetRowSpan` type. Moved from col 1 (under My Tasks) to col 2 (above Calendar) so it acts as a quick-action chip on the schedule. (3) Fixed the `column assignee.name does not exist` error on /daily Team Tasks widget — `get_team_assigned_tasks` RPC referenced `assignee.name` but `intern_users` has no `name` column (correct is `display_name`). New migration `20260424090000_fix_assignee_display_name.sql` applied to prod Supabase. `WORKSPACE_LAYOUT_VERSION` 15 → 16. |
| 2026-04-24 | `f95f3a5` (PR #34) | **Direct cross-column widget swap.** Dragging widget A onto widget B in a different column now performs a DIRECT 1-for-1 swap — A takes B's slot, B takes A's old slot in one atomic move. No cascading push-down / stacking. First attempt committed the swap live via `onDragOver`, which caused a cascading-swap bug (every widget the cursor brushed got swapped with the active one, piling widgets into whichever column the cursor ended in — screenshot showed 3 widgets stacked in col 3 and col 1 empty). Fix: remove `onDragOver` entirely. `onDragEnd` is now the single commit point. During the drag the `DragOverlay` ghost follows the cursor and nothing else moves; on release, exactly one swap/move/reorder happens based on the drop target. New `swapWidgets(aId, bId)` helper on `useWorkspaceLayout`. Same-column reorder still uses `useSortable`'s built-in transform preview + insert-on-drop (the list-reorder feel was already smooth). |
| 2026-04-24 | `46c140a` (PR #35) | **Remove double-boxed chrome on Studio + Team widgets.** Studio Tasks and Team Tasks widgets on /daily were rendering their own `widget-card` wrapper + bold heading INSIDE the outer `DashboardWidgetFrame` — visible nested-card double-box. Stripped the inner Card + CardHeader from `AssignedTaskBoards`. Now renders body-only (show-completed toggle + scrollable task list), matching the MyTasksCard embedded pattern. Both boards are only used as widgets so we always-embed without an `embedded?` branch. |
| 2026-04-24 | `d602c67` (PR #36) | **Flywheel stage pills + right-aligned due date.** Three changes across MyTasksCard + AssignedTaskBoards: (1) Stage filter pills back at the top of My Tasks (Overview + /daily) and Team Tasks (/daily) — All on its own row, 5 stages below (no scroller). (2) Due date moved from the sub-meta line to a right-aligned column on each row ("Today" / "Apr 25" / "—" placeholder). (3) Widget descriptions cleared on team_tasks/studio_tasks/team_board. Header "N open" line + bottom-of-list show-completed text removed. Show-completed becomes an icon-only eye toggle in a sticky footer bar alongside the +Task button. Pending-requests chip moves to the same footer. Helpers added: `taskStage(category)` + `formatDueShort(dueDate)`. |
| 2026-04-24 | `5634e94` (PR #37) | **Restore pending→Submit flow + tighten can_complete.** Two bugs + restored UX pattern. (1) `get_member_assigned_tasks` RPC was missing `can_complete`, `scope`, `assigned_to`, `assigned_to_name` — client defaulted `can_complete: false` so every My Tasks checkbox was disabled. RPC recreated to emit them. (2) `get_team_assigned_tasks.can_complete` allowed `is_team_admin()` override → admins could check off any team-member's task. Tightened to strict `scope='studio' OR assigned_to=caller`. (3) Restored the pending→Submit Completed flow on all three task widgets: clicking a checkbox adds id to local `pendingIds` set (visual flip only, no RPC); SubmitBar at the bottom is greyed when empty, gold when ≥1 pending; clicking Submit commits all queued toggles via parallel RPC calls. Both migrations applied to prod. |
| 2026-04-24 | `da916e8` (PR #38) | **Peer "Request to take" reassignment.** Hover a teammate's task in Team Tasks → gold "Request to take this task" overlay → click fires RPC → assignee gets a notification → opens Approve/Decline modal. Approval atomically moves `assigned_tasks.assigned_to` to the requester. New table `task_reassign_requests` (id, task_id, requester_id, current_assignee_id, status, note, resolved_at, resolver_id). New notification enum values (`task_reassign_requested/_approved/_declined`) + new `task_reassign_request_id` column on `assignment_notifications` with updated XOR check. Four RPCs: `request_task_reassignment`, `approve_task_reassignment`, `decline_task_reassignment`, `get_my_incoming_reassign_requests`. New `TaskReassignRequestModal` component lists pending incoming with Approve/Decline rows + optional decline note. Notification widget routes `task_reassign_*` types to the modal / cache invalidation. |
| 2026-04-24 | `683199c` (PR #39) | **Tier 1 closeout — studio tile + admin hub parity + race safety.** Three loose-end fixes from PRs #37–#38. (1) Studio Task surface — 4th tile on `AdminAssignWidget` opens `AdminTaskCreateModal` with `initialScope="studio"` preset. (2) Admin Hub reassign parity — `AdminNotificationsWidget` mirrors the Forum widget's `task_reassign_request_id` routing. (3) Approve race safety — `approve_task_reassignment` rejects if the task's `assigned_to` no longer matches the request snapshot, auto-cancels the stale request. Migration applied to prod. |
| 2026-04-24 | `c8f617e` (PR #40) | **Edit Tasks widget + admin RPC.** New admin-only "Edit Tasks" library on the Assign page. Two RPCs: `admin_list_all_assigned_tasks` (every live task across the team, ordered by completion → due date → recency) and `admin_update_assigned_task` (partial update via COALESCE + `p_clear_*` flags + `task_edited` notification to assignee). New notification enum value `task_edited` reuses `batch_id` as the polymorphic ref. New widget `AdminEditTasksWidget` (count + CTA) + `AdminEditTasksModal` (search by title, assignee filter, show-completed toggle, click-to-expand inline edit form for title/description/stage/due date). |
| 2026-04-25 | `3fcb2ab` (PR #41) | **Assign-page reorg per user sketch.** First slice of the user-sketched 5-PR redesign. Layout shuffle to: col 1 = Task Requests + Edit Tasks, col 2 = Assign (now 2 tiles only: +Task + +Booking — Studio Task reachable via Task modal's scope toggle, Task Group folded into PR #42's Add-from-template flow), col 3 = Templates. `AssignGroupModal` deleted (template-apply temporarily uses the Templates wizard). +Session tile renamed to +Booking for clearer copy. `WORKSPACE_LAYOUT_VERSION` 17 → 18. Followup PRs queued: #42-#46. |
| 2026-04-25 | `6541f32` (PR #42) | **Row-by-row +Task modal with Add-from-template.** Replaces single-task `AdminTaskCreateModal` on the Assign page with a row-by-row composer. Top-of-modal Members/Studio toggle replaces buried scope dropdown; "+ Add task" appends a blank row; "+ Add from template" opens `AddFromTemplateModal` (pick template card → tick items → "Add N tasks") which appends imports as editable rows. Each row: title / description / flywheel stage / due date / required. Backend: new `assign_custom_tasks_to_members` (plural) RPC accepts a jsonb array of task drafts + recipients + scope; for member scope = ONE batch + N×M tasks + ONE notification per recipient ("3 new tasks") instead of N separate notifications. Studio scope = M shared rows. Hub Quick Assign keeps the simpler single-task modal. |
| 2026-04-25 | `132afc7` (PR #43) | **Edit widget split + Edit Bookings backend/modal.** The `admin_edit_tasks` widget becomes a compact twin-button "Edit" widget at rowSpan 0.5 — Edit Task (PR #40 modal) + Edit Booking (new). Three RPCs: `admin_list_all_sessions` (upcoming first, toggle past), `admin_update_session` (partial update + `session_reassigned` notification when assignee changes), `admin_delete_session` (best-effort cancellation notification before delete). New `AdminEditSessionsModal` with search-by-client, assignee filter, include-past toggle, inline click-to-expand edit form (client / date / start-end / room / engineer / status), delete-with-confirm. Soft amber overlap warning when the edited time collides with another session for the same engineer (non-blocking). User-facing copy "Session" → "Booking" + "All engineers" → "All assignees" (matches Edit Tasks). Col 1 registration order swapped so Task Requests sits on top of Edit per the sketch. WORKSPACE_LAYOUT_VERSION 18 → 20. |
| 2026-04-25 | `b75f7de` (PR #44) | **Assign Log widget + studio task visibility fix.** New widget in col 2 under Assign tile widget: 3-column rows (title / "First L." assignee / "Today" or short "Apr 25"), task + studio + session interleaved by recency. New RPC `admin_recent_assignments` returns one row per (subject, assignee). **Mid-PR fix**: studio tasks created via `assign_custom_task[s]_to_members` had `recipient_assignment_id = NULL`, but `get_studio_assigned_tasks` + `get_team_assigned_tasks` INNER-JOINed the recipient chain to scope by team — silently dropping every studio row. Fix: denormalize `team_id` directly onto `assigned_tasks` (new column + backfill); both insert RPCs set it via `get_my_team_id()`; both fetchers filter by `t.team_id` directly. `admin_recent_assignments` projection switched from `row_to_jsonb(r)` (which fails on anonymous-record subqueries) to explicit `jsonb_build_object`. WORKSPACE_LAYOUT_VERSION 20 → 21. |
| 2026-04-25 | `8c863dc` (PR #45) | **Approval Log widget.** New widget in col 1 between Task Requests (top) and Edit (bottom) per the sketch. Surfaces BOTH approved and declined task_requests, labelled by outcome (green ✓ / rose ✕ + title + requester "First L." + relative time, decline rows show reviewer note italic on a 2nd line). New RPC `admin_recent_approvals` orders by `task_requests.reviewed_at` DESC. Approval/decline mutations on `PendingTaskRequestsWidget` invalidate `['admin-log']` so new entries appear immediately. WORKSPACE_LAYOUT_VERSION 21 → 22. |
| 2026-04-25 | (PR #48, in flight) | **Mark-all-read for notifications.** First Tier 2 slice. Migration `20260426000000_mark_all_read_rpcs.sql` adds two SECURITY DEFINER RPCs: `mark_all_channels_read()` (upserts a `chat_channel_reads` row per channel for `auth.uid()`, returning `{ success, channels_marked }`) + `mark_all_assignment_notifications_read()` (bulk UPDATE on `assignment_notifications` WHERE `recipient_id = auth.uid() AND is_read = false`, returning `{ success, notifications_marked }`). Both reject anonymous callers with SQLSTATE 28000 + `SET search_path = 'public'`. New "Mark all read" button slots into the eyebrow row of `ForumNotificationsWidget` (member Overview) and `AdminNotificationsWidget` (admin Hub), beside the rose unread pill — hidden when `totalUnread === 0`. Click fires both RPCs in parallel via `Promise.all`, optimistically zeros every channel + assignment unread in react-query cache (`['overview-notifications']` + `['overview-assignment-notifications', userId]`), and on error invalidates both keys so server truth flows back. New `markAllAssignmentNotificationsRead` helper in `src/lib/queries/assignments.ts`; `markAllChannelsRead` co-located inline in each widget file (mirrors the existing `markChannelRead` pattern — they're sibling helpers, refactor deferred). |
| 2026-04-25 | `7d9a5a0` (PR #47) | **Assign + Overview default widget orders updated.** Pure visual cleanup, four revs. (rev1) `AdminAssignWidget` rowSpan 1 → 0.5 + `AssignTile` collapsed to twin-button row matching `EditButton`. (rev2) Assign-page placements per user drag: col 1 = Assign Log → Approval Log; col 2 = Assign (rs0.5) → Edit (rs0.5) → Task Requests; col 3 = Templates (rs2). Reordered `ADMIN_WIDGET_REGISTRATIONS` array so within-column order resolves. Hub overview placements unchanged. (rev3) Overview-page placements per user drag: `team_tasks` rs1 → rs2 to match Calendar height; `booking_snapshot` col 2 → col 3 (top, rs0.5 unchanged); `today_calendar` fills col 2 alone (rs2 unchanged); `forum_notifications` rs2 → rs1 so col 3 reads as a balanced stack. Tasks-page placements unchanged. (rev4) Added `1.5` to `WidgetRowSpan` union (heights now: 0.5=170, 1=340, 1.5=518, 2=696, 3=1052); bumped `forum_notifications` Overview rs1 → rs1.5 so col 3 (Booking 170 + gap 16 + Notifications 518 = 704px) sits near-flush with cols 1-2 at rs2 (696px). `WORKSPACE_LAYOUT_VERSION` 24 → 28. |
| 2026-04-25 | `6b23dbb` (PR #46) | **Templates Arrange-by + per-role thumbnails.** Closes out the user-sketched Assign-page redesign. `AdminTemplatesWidget`: existing "Include archived" toggle renamed to "Show archived" per sketch; new Arrange-by selector (A–Z / Newest / Role) sits right of the toggles; Role arrangement groups templates under role-tag dividers (Engineer / Marketing / Intern / Dev / Admin / Ops / extras alphabetically / "No role" last). The big-card grid is replaced with friendly thumbnail tiles in a 2-per-row grid. Each tile is a circular gold icon bubble + template name (line-clamp 2) + task count; the icon glyph is keyed off the template's `role_tag` (Headphones=engineer, Megaphone=marketing, GraduationCap=intern, Code2=dev, Briefcase=admin, Settings=ops, FileText=default). Onboarding templates get a tiny emerald GraduationCap badge at the icon corner. Search / filters / Arrange-by row stays pinned at top while the grid scrolls. Each thumbnail opens the same `TemplatePreviewModal` the cards used. Iterations: rev1 first pass shipped a separate `admin_template_preview` widget below Templates, but the user asked for the thumbnails INSIDE Templates instead — so that widget + `TemplateCard.tsx` were deleted and Templates rowSpan went 2 → 3. rev2 returned rowSpan to 2 (col 3 felt unbalanced vs cols 1-2) and resized tiles bigger / friendlier with per-role icons per the user reference image. WORKSPACE_LAYOUT_VERSION 22 → 24. |
| 2026-04-29 | `f297884` (PR #49) | **Add Member email-setup flow + unified TeamManager.** Owner-only "Add Member" button on the Members admin page opens a modal that creates the auth user + `team_members` row + sends a Supabase password-reset email so the new hire sets their own password (matches the Bridget onboarding pattern). Built on top of the existing `admin-create-member` edge function. Members admin was previously two surfaces (read-only roster + separate TeamManager); merged into one table-styled `TeamManager` so admin Members → Add Member flows in one click. Top-nav Members link repointed at TeamManager. |
| 2026-04-29 | `2fd6603` (PR #48) | **Mark-all-read for notifications.** Migration `20260426000000_mark_all_read_rpcs.sql` adds two SECURITY DEFINER RPCs: `mark_all_channels_read()` (upserts a `chat_channel_reads` row per channel for `auth.uid()`) + `mark_all_assignment_notifications_read()` (bulk UPDATE on `assignment_notifications` WHERE `recipient_id = auth.uid() AND is_read = false`). Both reject anonymous callers + lock `search_path = 'public'`. New "Mark all read" button in `ForumNotificationsWidget` + `AdminNotificationsWidget` eyebrow row fires both RPCs in parallel via `Promise.all`, optimistically zeros every unread in cache, invalidates on error. Hidden when `totalUnread === 0`. First Tier 2 maturity slice merged. |
| 2026-04-29 | `a17d4c9` (PR #51) | **Clients table + admin page + booking-modal client picker.** New `clients` table (name, email, phone, notes, archived). New `/admin/clients` admin page for managing the studio's client list. Booking creation modal now includes a clients dropdown + empty-state hint that links to the admin page. Foundation for Tier 2 EmailJS booking confirmations + reminders (which need a real `clients` row to email). |
| 2026-04-29 | `5a7c2a6` (PR #52, draft) | **New Assign page visual scaffold.** Mockup of the boss-sketched member-centric Assign page: left rail with members list + Templates link + Legacy Assign shortcut, main pane shows "All Tasks for {member}" with row-by-row editor, top-bar pill buttons (Settings for Tasks · Save as Template · Templates dropdown). Visual scaffold only — no real data yet. Later in the same session this was promoted to canonical `/admin/templates` (replacing the widget-grid Assign page) via two follow-up commits in the same PR (`1de2246` wire to real task data, `3ac44ad` make canonical). |
| 2026-04-29 | `a7c223f` (PR #53) | **Kill checkbox re-render flicker + template preview-before-apply.** Bug: clicking one task's checkbox made every other checkbox in the list flash yellow because every parent render created brand-new arrow functions for `onToggle`/`onEdit`, defeating React.memo on TaskRow. Fix: stable callbacks via `useCallback` so memoized rows actually skip re-renders. New template preview-before-apply step — clicking "Apply template" opens a modal listing the template's items with checkboxes; admin reviews, unchecks any they don't want, then applies; replaces the prior "instant-apply" pattern that landed the whole template in one click. |
| 2026-04-29 | `5c3fc06` (PR #54) | **Isolate legacy widget Assign view + add sidebar shortcut.** The old widget-grid Assign page (Task Requests · Approval Log · Edit Tasks · Assign · Assign Log · Templates) moved from `/admin/templates` to `/admin/assign-classic`. `/admin/templates` now exclusively renders the new member-centric Assign page from PR #52. New sidebar entry on the Assign page: "Legacy Assign — old widget-grid view" routes to `/admin/assign-classic` so admins can still reach the widget surface during the transition. |
| 2026-04-29 | `97e4eea` (PR #55) | **Use React Router Link for sidebar nav so legacy works.** The new Assign page sidebar's "Templates" + "Legacy Assign" entries were `<a href>` tags — clicking did a full-page reload, which dropped React Query cache and broke the SPA feel. Switched to React Router's `<Link>` so navigation stays client-side. One-line fix per item. |
| 2026-04-29 | `27799b3` (PR #56) | **Full-page Templates manager.** New page at `/admin/template-library` (471-line `TemplateLibrary.tsx`) extracts the templates UI from the Assign sidebar widget into a dedicated full-page surface — same role-tag filter pills, search, archive toggle, friendly per-role thumbnails as the inline widget, but now with room to breathe. Routes added in `src/app/routes.ts` + `src/features/admin/routes.tsx`. AssignAdmin sidebar's "Templates" link routes here. Onboarding corner badge removed from thumbnails (the legacy widget kept consistent so the visual language doesn't fork). |
| 2026-04-29 | (PR #50, in flight) | **Persist Clock In/Out + 'On the Clock' Hub widget.** First Tier 2 slice. New `time_clock_entries` table with one open shift per user enforced by partial unique index + 4 SECURITY DEFINER RPCs (`clock_in()` idempotent, `clock_out(p_notes)`, `get_my_open_clock_entry()`, `admin_currently_clocked_in()`); migration `20260429000000_time_clock_entries.sql` applied to staging, advisors clean. Header Clock button moved from `useState` to `useQuery` + `useMutation` with cache key `['my-open-clock-entry']` invalidating across tabs. SelfReportModal (Close + Log Out paths) now fires `clock_out` alongside its existing behavior. New `AdminClockInWidget` ("On the Clock") on admin Hub col 3 below Team (rowSpan 0.5) with live elapsed counter ticking every minute, refetches every 60s. New `src/lib/queries/timeClock.ts` with the 4 RPC wrappers + cache key factory. `WORKSPACE_LAYOUT_VERSION` 28 → 29 for the new widget id. Followup queued: populate Members > Clock Data pane (PR #58 reserved) with shift history table. |
| 2026-04-29 | (PR #61, in flight) | **Members > Clock Data shift log.** Fills the "Clock Data" rail item PR #58 reserved. Migration `20260429120000_admin_list_clock_entries.sql` adds one new SECURITY DEFINER RPC `admin_list_clock_entries(p_member_id, p_limit)` returning recent shifts (entry_id, member_id, member_name, clocked_in_at, clocked_out_at, duration_minutes computed at query time, notes), admin-guarded via `is_team_admin()` + scoped to `get_my_team_id()`, sorted clocked_in_at DESC, hard cap 500. Reuses the existing PR #50 table + RLS — no schema changes. New `fetchClockEntries` wrapper + `entries(memberId)` cache key in `src/lib/queries/timeClock.ts`. TeamManager's clock-data section now renders a 5-column table (Member · Clock In · Clock Out · Duration · Notes) inside the Settings-pattern right-pane card, with a member filter dropdown above (reuses the existing roster — no second fetch). Open shifts surface an "ON SHIFT" emerald pill in the Clock Out column + `—` duration; closed shifts show a readable "Apr 29, 2026 · 9:14 AM" timestamp + compact "1h 23m" / "8h" / "1d 4h" duration. 60s refetch + window-focus refetch so a clock-out from another tab updates here. Notes column surfaces the "what went well / improve" reflections the clock-out modal collects. Member avatars/names link to `/profile/:id`. Column model is CSV-friendly for the upcoming `<ExportButtons />` work. |
| 2026-04-29 | (PR #59, in flight) | **Fix Assign right-pane top alignment.** The toolbar (Settings for Tasks · Save as Template · Templates ▾) was rendered as a row above the main card, which pushed the "All Tasks" card top edge below the sidebar's Members card top edge — visually misaligned vs Settings. Folded the toolbar INSIDE the main pane card with a hairline divider below it (now `<main className="rounded-xl border border-border bg-surface p-5">` wraps both), so both the sidebar and main card start at the same Y on the grid. Also: aligned `rounded-2xl` → `rounded-xl` on the sidebar + main card, `gap-4` → `gap-6`, added `items-start` to the grid — exact Settings rhythm. The inner "Title row" lost its own card chrome since it's now nested. |
| 2026-04-29 | (PR #58, in flight) | **Members admin restructured around Settings-style left-rail.** Extracted `SectionNavItem` from AdminSettings into a reusable `AdminSectionNavItem` component at `src/components/admin/AdminSectionNavItem.tsx` (generic over a section-key type). TeamManager now wraps its existing roster (search + filter pills + 8-column member table) as the "Roster" view inside a left-rail layout; new "Clock Data" rail item shows a "coming soon" empty state that PR #50 (Clock In/Out v2) will populate with shift data. Page header simplified to the standard `<h1>Members</h1>` + count badge + Add Member button (no subtitle per PR #60's modern/sleek pass) + `mb-6` rhythm matching Settings/Assign. Stripped the inner `widget-card` chrome from the table (was doubling up against the right-pane card chrome). Foundational for the Tier 2 Clock In/Out v2 PR. |
| 2026-04-29 | `ad76452` (PR #57) | **Add page header to Assign so it aligns with Settings rhythm.** AssignAdmin was jumping straight into its two-column grid with no `<h1>` + subtitle, while every other admin page (Settings) opens with a "Title + subtitle, mb-6" header block. That made the sidebar/main-content cards sit higher on the viewport and read as misaligned. Added `<h1>Assign</h1>` + "Assign tasks to your team members" subtitle, mirroring [AdminSettings.tsx:163-166](src/pages/admin/AdminSettings.tsx:163) exactly. |
| 2026-04-29 | (PR #60, in flight) | **Remove subtitle text from all page headers — modern/sleek pass.** User wants every "title page" to read as just an h1, no descriptive subtext. Touched 15 files: 11 PageHeader callers (Hub · Templates · TeamManager · TemplateLibrary · ClientsAdmin · Sessions · DailyNotes · Dashboard · DailyChecklist · Pipeline · Leads) had their `subtitle="..."` props deleted; 4 inline `<p className="text-text-muted mt-1">` page-header subtitles deleted (AdminSettings · AssignAdmin · Reviews · Schedule). PageHeader component itself was left untouched (subtitle prop still supported). Login page subtitle preserved (helps unauthenticated users orient). |
| 2026-04-22 | `09ec6fc` (PR #10) | **Assignment-system polish merged.** 3 bundled concerns: (1) `FloatingDetailModal` stacking: module-level stack tracks mount order; `z-index = 60 + depth × 10`; Escape handler guards on `stack[-1] === id` so a single keypress closes only the topmost modal. Backdrop opacity steps down with depth so parent peeks through — clear visual hierarchy. Body scroll lock coordinates with stack (only releases when stack empties). (2) Hard-delete templates: new `delete_task_template` RPC (admin guard, returns `{ items_removed, assignments_preserved }` so the UI can show an honest toast); `deleteTaskTemplate` query helper; Delete button in `TemplatePreviewModal` footer with confirm copy that explains past assignments stay intact. Past `assigned_tasks` survive untouched thanks to the FK `ON DELETE SET NULL` shipped in PR #8. `task_template_items` cascade. (3) Batch cancel UI: new `fetchRecentTemplateBatches` query helper reads `task_assignment_batches` directly (admin RLS) with recipient counts + cancelled state; new `RecentAssignmentsSection` component on Assign page renders last 10 batches with per-row Cancel action wired to `cancel_task_assignment_batch` + cache invalidation of `assigned-tasks` so recipients see the batch vanish without refresh. Cancelled batches stay in the list (muted) so admins can see what they've recalled. |
| 2026-04-22 | `d1c046b` (PR #9) | **Assign-page comprehensive redesign merged.** Replaces the legacy `/admin/templates` page (which wrote directly to `report_templates`) with a surface built entirely on the new `task_templates` system via PR #6 + PR #8 RPCs. **New files**: `src/lib/queries/taskTemplates.ts` (13 RPC wrappers + `taskTemplateKeys` factory); `src/components/admin/templates/{TemplateCard,TemplatePreviewModal,TemplateEditorModal,TemplateDuplicateModal,TemplateAssignFlowModal,index}.tsx`; `src/components/members/MemberMultiSelect.tsx` (extracted from Hub's AssignTaskModal so Hub + new Assign wizard share identical recipient UI); 11 new TS types in `src/types/assignments.ts`. **Rewrites**: `src/pages/admin/Templates.tsx` from 1069 → 360 lines (hero + stats + filter bar + card grid + empty state + "New Template" CTA). **Deleted**: `src/components/templates/TemplateAssignModal.tsx`, 100-line `PRESET_TEMPLATES` hardcoded seed list, ~800 lines of legacy page code. Modals: Preview (FloatingDetailModal + item list + Archive/Duplicate/Edit/Assign footer) → Editor (create or edit; per-item inline edit/delete + add-item form) → Duplicate (rename + confirm) → Assign (3-step wizard: recipients → items → confirm with summary). Architectural call (user-confirmed): REPLACE entirely; report_templates admin moves to PublishChecklistModal pathway. **Known issue**: nested modals share `z-[60]`; stacked preview + sub-modal backdrops overlap click targets. Queued for PR #10 fix. |
| 2026-04-22 | `3a4ade7` (PR #8) | **Task-assignment Phase 2 backend merged.** 1 FK-tweak migration (`assigned_tasks.source_template_id` + `source_template_item_id` → `ON DELETE SET NULL` so admins can delete/evolve templates without losing team progress); 1 RPC migration with 6 admin-only SECURITY DEFINER functions + one non-breaking filter on `get_member_assigned_tasks`. New RPCs: `update_task_template`, `update_task_template_item`, `delete_task_template_item`, `duplicate_task_template`, `cancel_task_assignment_batch` (also hides open tasks), `assign_template_preview` (read-only, same item-ownership validation as the real assign RPC). `get_member_assigned_tasks` now filters `ar.status = 'active'` so cancelled batches vanish from the Assigned-To-You widget. All guarded with `is_team_admin()`, cross-template injection rejected with SQLSTATE 22023. No frontend changes — this PR exists to ship the schema admins need before the comprehensive Assign-page UI lands. |
| 2026-04-22 | `8821785` (PR #7) | **Task-assignment MVP frontend merged.** Widget visibility model formalized: `accessVisibility` (`personal` / `shared` / `admin` / `role_scoped`) + `dataScope` (`self` / `team` / `target_user` / `global`) added to `WorkspaceWidgetRegistration`; disjoint `MemberScope` / `AdminScope` types preserve admin/member invariant while enabling multi-page placement within a side. `WorkspaceWidgetRegistration` swaps `defaultSpan`/`defaultRowSpan` → `defaultPlacements: WidgetPlacement[]` so a widget can declare placements on multiple pages. Added MemberWidgetId `assigned_tasks`; `team_tasks` + `assigned_tasks` both claim `member_overview` + `member_tasks` placements. New `AssignedTasksWidget` (~200 lines) in `memberOverviewWidgets.tsx`: `useQuery` + `completeAssignedTask` optimistic toggle + `postgres_changes` subscription on `assigned_tasks`. Extended `ForumNotificationsWidget` + `AdminNotificationsWidget` with a second `useQuery` for assignment notifications, a parallel realtime subscription on `assignment_notifications` filtered by `recipient_id`, and an "ASSIGNMENTS" section below the channels list with optimistic mark-read. Added 4th "Custom Task" tile to `AdminAssignWidget`; new inline `AssignCustomTaskModal` with multi-recipient select + title/description/category/due/required form, calls `assign_custom_task_to_members` RPC. `src/types/assignments.ts` + 5 new query helpers in `src/lib/queries/assignments.ts`. `DailyChecklist.tsx` replaced with a widget-grid shell for the new `member_tasks` scope (pulls `TASKS_WIDGET_DEFINITIONS` filtered by placement from `widgetRegistry`). `WORKSPACE_LAYOUT_VERSION` 8 → 9. Mock `TeamTasksCard` + `StudioTasksCard` retired (neither was DB-backed). |
| 2026-04-21 | `951be5c` (PR #6) | **Task-assignment Phase 1 backend merged.** 2 migrations: (1) 5 enums + 6 tables (`task_templates`, `task_template_items`, `task_assignment_batches`, `assignment_recipients`, `assigned_tasks`, `assignment_notifications`) + 7 hot-path indexes + RLS via existing `is_team_admin()`; (2) 11 SECURITY DEFINER RPCs covering template library CRUD + 3 atomic assignment actions (custom / full / partial) + member read+complete + notifications. Additive — zero changes to `report_templates`, `task_assignments`, or `team_checklist_*`; 2C cold-path untouched. Server-side `get_member_assigned_tasks`: 3.2ms. Seed data from smoke tests kept (see Known seed data). Frontend UI pending Codex handoff PR. |

---

## Active

**Phase 1 — Stabilize the foundation** (in progress): Load-perf work from the Codex 4-phase roadmap.

- ✅ **Step 1 — instrumentation + prod baseline** (2026-04-20). 1,289ms cold start, waterfall in `SESSION_CONTEXT.md`.
- ✅ **Step 2A — Duplicate Supabase client** (2026-04-20, `c719ef2` / PR #1). Deleted `src/lib/chatSupabase.ts`; consolidated 8 call sites to the main `supabase`. Preview cold-start 998ms (↓22%), `overview:batch` 427→185ms, `"Multiple GoTrueClient instances"` warning GONE.
- ✅ **Step 2A' — Profile-fetch dedupe** (2026-04-20, `341d2d1` / PR #2). `handledForUserId` ref + `maybeFetchProfile` wrapper in `AuthContext.tsx`. 2×→1× profile fetch.
- ✅ **Step 2B — cron-materialize + client fast-path** (2026-04-20, `85b7df7` / PR #3). pg_cron at 11:00 UTC, `cron_materialize_checklists()`, `cron_run_log`. Client short-circuits the RPC when instance exists. `checklist:rpc` no longer fires on cold start. −~170ms.
- ✅ **fix(perf-trace) flush-gate race** (2026-04-20, `4e666b9` / PR #4). `lastLoadedProfileId` ref; flush now fires only after a real batch completes for the current profile. True cold start revealed: **826ms with 6 honest checkpoints**, longest `checklist:items` 265ms.
- ✅ **Step 2C — Snapshot RPC** (2026-04-21, `357562c` / PR #5). `member_overview_snapshot(p_user_id, p_date)` — one RPC replaces the four-wave waterfall. Codex peer-review refinements incorporated (server-derived `submission_type`, `PreloadedChecklist` metadata match-check, atomic sub-queries in one transaction). **Preview cold-start locked: 470ms / 3 checkpoints / 7.3ms server-side.** Full Phase 1 Step 2 arc: **1,289ms → 470ms = −64%**, landed well inside the 500–700ms target with margin.

**Phase 1 Step 2 CLOSED.** Next structural lever is hosting (Cloudflare migration) once the site has 1–2 stable days on prod post-2C. Timing remains Claude's judgment call per `feedback_cloudflare_migration_timing.md`.

**Phase 1 — Assignment System** (in progress): First-class admin workflow for assigning custom tasks / full templates / partial templates to one or many members, with notifications.

- ✅ **Phase 1 backend — schema + RPCs** (2026-04-21, `951be5c` / PR #6, merged). 6 tables + 5 enums + 7 indexes + RLS via `is_team_admin()`; 11 SECURITY DEFINER RPCs (4 library CRUD, 3 atomic assign actions, 2 member read+complete, 2 notifications). Codex peer-review refinements incorporated (`assignment_recipients` rename to avoid collision, `PreloadedChecklist`-style metadata validation surface, single-transaction atomicity, enums over text). Additive — does NOT touch `report_templates`, `task_assignments`, or `team_checklist_*`. 2C cold-path untouched.
- ✅ **Phase 1 frontend MVP** (2026-04-22, `8821785` / PR #7, merged). Custom-task assign only. New `AssignedTasksWidget` on Overview + Tasks (multi-page placement via `defaultPlacements` in registry). `AssignTaskModal` admin surface behind the Hub Assign widget's "Task" tile. Notifications widget extended with Assignments section + realtime. Widget-visibility model formalized (`accessVisibility` + `dataScope`). `/daily` restructured into a widget grid; mock Team/Studio cards retired. Post-merge: 4th "Custom Task" tile consolidated back into the existing "Task" tile (commit `46d3339` before merge) so the Hub stays 3 tiles as per the original design.
- ✅ **Phase 2 backend prep** (2026-04-22, `3a4ade7` / PR #8, merged). 6 admin-only RPCs for template editing + batch cancel + assignment preview. `ON DELETE SET NULL` FK tweak + `ar.status = 'active'` filter. Ships the schema the comprehensive Assign-page UI now calls.
- ✅ **Assign-page redesign** (2026-04-22, `d1c046b` / PR #9). Full `/admin/templates` rewrite targeting `task_templates`. Card grid + filter + 4 modals + extracted `MemberMultiSelect`.
- ✅ **Phase 1 polish** (PR #10) — modal stacking + hard-delete templates + batch cancel UI.
- ✅ **Unified MyTasks + scope model** (PRs #11, #12, #14) — retired Assigned-To-You widget, three-column Tasks page, studio scope end-to-end (column + RPCs + UI toggle + completion guard).
- ✅ **Assign page reform** (PR #13) — Quick Assign inline compose + Assign-a-Session tile + Templates section; session-assign pipeline via new `assign_session` RPC; preview auto-login.
- ✅ **Session polish** (PR #15) — click-to-flash on `/sessions`, engineer conflict warning on reassign.
- ✅ **User task requests + admin approval queue** (PR #16) — self-serve "+ Task" button for members; Hub approval widget for admins.
- **Phase 3+ (deferred)**: assignment history UI, `mark_all_read`, fold assigned-tasks summary into `member_overview_snapshot`, drag-to-reorder template items, unify `report_templates` into `task_templates`, template RPCs accept `p_scope` (studio templates), notification click routing for `task_request_*` types.
- **Cloudflare migration (queued)**: timing "once stable on prod" — after this six-PR session settles for a day or two, migrate Vercel → Cloudflare Pages as a single-concern PR per `feedback_cloudflare_migration_timing.md`.

**UI design refresh — scoped pilot** (paused): Apply the v1.0 design system PDF to the live app on three pages first. See `~/.../My Drive/Checkmark Audio — Design System · Print.pdf` for the visual spec.

**Locked constraints:**
- ✅ Keep top nav (do not refactor to sidebar even though PDF shows sidebar)
- ✅ Keep current menu names (Overview, Tasks, Calendar, Booking, Forum + admin: Hub, Assign, Members, Analytics, Settings)
- ✅ Keep current header as-is
- ✅ Do not modify Settings dropdown content

**Progress:**
- ✅ **Overview (member) — complete.** Column-snap grid. Col 1: My Tasks. Col 2: Booking button (rs 0.5) above Calendar (rs 2). Col 3: Notifications (rs 2).
- ✅ **Admin Hub — complete.** Column-snap grid: Col 1 Quick Assign + Task Requests · Col 2 Flywheel (rs 2) · Col 3 Notifications + Team. Flywheel reads real `assigned_tasks` per stage (dual-opacity done/open bars). Reassign-request notifications open the same Approve/Decline modal as the member-side widget.
- ✅ **Tasks (`/daily`) — complete.** Column-snap grid: My Tasks · Studio Tasks · Team Tasks — each at rowSpan 2 (~696px). Stage filter pills + right-aligned due dates + pending→Submit Completed flow. Hover a peer's row → "Request to take this task" overlay → assignee approves or declines.
- 🟡 **Assign (`/admin/templates`) — second redesign in progress (PRs #52–#57 merged).** The widget-grid Assign page from PRs #41–#46 (Task Requests · Approval Log · Edit · Assign · Assign Log · Templates in three columns) was preserved at `/admin/assign-classic` but moved out of the canonical Assign route per the user's new boss-sketched direction: a member-centric task editor where you pick a member from a left rail and edit their full task list on the right (much more like Monday.com's row-by-row board than a widget grid). Current state on `/admin/templates`:
  - **Left rail**: Members list (active members only, click selects) + sticky bottom links: Templates (routes to the new full-page Templates manager at `/admin/template-library` per PR #56) + Legacy Assign (routes to `/admin/assign-classic` per PR #54).
  - **Main pane**: Top bar pill buttons (Settings for Tasks · Save as Template · Templates dropdown). Body shows "All Tasks for {selected member}" with row-by-row editor + + Add Task button + counters (N tasks · N complete). Apply-template flow opens a preview-before-apply modal (PR #53) so admin reviews items before they land.
  - **Page header (PR #57)**: `<h1>Assign</h1>` + "Assign tasks to your team members" subtitle so the page aligns with Settings rhythm.
  - **Performance fix (PR #53)**: stable `useCallback` refs so React.memo on `TaskRow` actually skips re-renders. Fixes the "all checkboxes flash yellow when one task toggled" bug.
  - **Templates page (PR #56)**: friendly per-role thumbnail grid + search + role-tag pills + Onboarding/Show-archived toggles + Arrange-by selector (A–Z / Newest / Role). Same pattern as the inline widget on `/admin/assign-classic`, but full-page.
  - **Still on the table**: the boss-sketched "Save as Template" + "Settings for Tasks" top-bar buttons are visual stubs in PR #52's scaffold; both need real implementations next.

All 4 refreshed pages share the same grammar: column-snap `WorkspacePanel` + `DashboardWidgetFrame` (drag grip + expand). Controls bar hidden. Drag model (PR #34): during drag only the `DragOverlay` ghost moves; on drop, cross-column = direct 1-for-1 swap, same-column = sortable insert+shift, empty column = append to that column.

**Out of scope for now:** all other pages. User wants to validate the design language on the highest-impact surfaces first.

---

## Known state / seed data on prod

Rows created by smoke-tests that live on prod Supabase and will be visible to users when the assignment-system UI ships:

- **Template**: `Marketing Onboarding` (4 items, onboarding=true, role_tag='marketing')
  - Items: Set up profile photo / Read brand guide / Connect to content calendar / Shadow two client sessions
- **Assignments**:
  - Full `Marketing Onboarding` → Gavin Hammond (4 tasks)
  - Custom task `Call vendor re: Q2 campaign` → Gavin + Matthan Bow (2 tasks total)
  - Partial `Marketing Onboarding` (items 1+2) → Matthan Bow (2 tasks)
- **State**: Gavin completed "Set up profile photo" + marked one notification read; all else unread/incomplete.

**Why kept**: useful seed data for Codex's frontend PR to render against.

**How to recover if wiped**: `docs/seed_data/task_assignment_phase_1_seed.sql` — run as admin via Supabase SQL editor. Recreates equivalent rows (fresh UUIDs).

**How to clean when ready**: admin UI will gain a "Cancel batch" / "Delete template" surface in Phase 2. Until then, direct SQL: `DELETE FROM task_assignment_batches WHERE title IN ('Marketing Onboarding', 'Marketing Onboarding (selected)', 'Call vendor re: Q2 campaign')` — cascades to recipients + tasks + notifications.

---

## Deferred (not yet built)

### QuickAdd pattern + member task suggestions
**Status:** Designed, not built. On hold until UI design refresh lands.

Phased plan (decisions locked):
- Phase 1: `<QuickAddButton>` + `<QuickAddModal>` reusable components, wire to chat channels first
- Phase 2: Roll out to projects, leads, sessions, positions; simplify TeamManager add flow
- Phase 3: Member-side "Suggest a task" UI hooking into existing `task_edit_requests` schema
- Phase 4: Animations, optimistic UI, undo toasts, empty-state CTAs

Locked design choices:
- **Hybrid suggestions**: members can add to OWN checklist instantly; shared-template additions need admin approval
- **Inline `+ Add X` buttons** per section (no FAB)

Existing infrastructure to leverage:
- `task_edit_requests` table with `change_type` enum (`'add'` / `'rename'` / `'delete'`) and `status` enum
- `approve_task_edit_request()` RPC
- `ApprovalsPanel.tsx` admin UI (already shows pending requests + approve/reject)

### Approach A — column rename
- `intern_id` → `member_id` in 9 tables
- 4 function names containing "intern" (cosmetic)
- 20 indexes whose names still contain "intern" (cosmetic)
- Compat view drop (whenever; free to leave forever)
- See `docs/intern-rename-resume/` for detailed plan

### Other
- **Theme DB persistence** — currently localStorage; coupled with profile pictures (both touch user table)
- **Profile pictures + banners** — Supabase Storage upload; column on `team_members`
- **React Query** everywhere — currently barely used; would make re-navigation instant
- **DnD widget reordering** — replace up/down arrows with `@dnd-kit/core`
- **"View as member" admin toggle** — admins QA member experience without a second account
- **GitHub Pages workflow disable** — Phase 4 manual step on user side (Settings → Pages → Source: None)
- **`CreateBookingModal` real-data write path** — currently inserts to mock `TaskContext`
- **Real Forum/chat send-receive** — channels seeded but no UI to send messages
- **Onboarding flow** — wizard for new team members vs. current "owner manually creates row + sends reset email"
- **Flywheel event ledger** (Phase 2 of original blueprint) — immutable event table; analytics derives from event history. **This is the highest-leverage future work** for tracking quality/productivity.
- **Domain features**: real Performance Reviews, Lead Tracking, Education Students, Projects, KPI Dashboard

---

## Done

- ✅ **Vercel migration** — replaces GitHub Pages; preview URLs; no more hard-refreshes
- ✅ **Auth hardening** — recovery, sign-out, owner protection, transient-error retry, lock-disable, implicit flow, inline hash detection
- ✅ **Owner lockdown** — 3 layers (DB triggers + code constant + email-first resolver); `checkmarkaudio@gmail.com` cannot be demoted or deleted
- ✅ **Account Access UI** — owner-only role toggle + password reset
- ✅ **Email-based password reset** — proper Supabase email flow, not temp-password sharing
- ✅ **Placeholder data cleanup** — forum mocks deleted, TaskContext seeds emptied, Flywheel mockup gracefully empty
- ✅ **Analytics merged with Flywheel** — one page, all charts; old `/admin/flywheel` route redirects
- ✅ **Forum nav rename** — "Content" → "Forum" (also: 5-stage flywheel restored on member Overview)
- ✅ **Theme toggle** — light/dark/system with sun/moon header button
- ✅ **Sessions + Calendar real data** — migrated off mock `TaskContext`
- ✅ **Member Overview real data** — daily checklist, today's sessions, KPI trend, must-do progress
- ✅ **Admin shared overview context** — single fetch, all admin widgets share state
- ✅ **Responsive widget grid** — `auto-fit + minmax(320px, 1fr)` + container queries on widget internals
- ✅ **Code splitting** — per-route React.lazy, separate chunks per page (BarChart 308KB only loads on Analytics)
- ✅ **Schema rename Phase B** — 10 `intern_*` → `team_*` with compat views; atomic migration; 0 data risk
- ✅ **Two new accounts** — Richard Baca (engineer/intern role), Matthan Bow (intern/intern role)
- ✅ **Overview refresh (4 widgets)** — Calendar + Tasks + Booking + Notifications, each with a TODAY eyebrow; readable fonts; flywheel stage rotation on the All-tab; Discord-style unread tracking backed by `chat_channel_reads` + `get_channel_notifications()` RPC with realtime + optimistic mark-read on click.
- ✅ **Admin Hub (5 widgets)** — Assign / Notifications / Team / Flywheel / Approvals, mixed-row-span grid. Assign widget includes `AssignTaskModal` + `AssignGroupModal` (new inline modals that write directly to `team_checklist_items` and `task_assignments`). Notifications widget adds admin post + create-channel flows. Flywheel aggregates team KPIs. Approvals inlines approve/reject RPC calls.

---

## Recovery instructions

If a Claude session dies mid-task:

1. **Read this file FIRST** for project context
2. **Read `docs/intern-rename-resume/`** if rename work was active
3. `git log --oneline -10` to see recent activity
4. `git status` to see uncommitted changes
5. Check `~/.claude/projects/-Users-bridges-GITHUB-Dashboard-V3/memory/MEMORY.md` for any private context notes
6. Ask the user what they were working on if anything is unclear

**The auto-memory system at `~/.claude/projects/.../memory/` survives across sessions. The repo's `docs/` folder also survives. Both are equally valuable for recovery.**

---

## How to update this file

After any meaningful commit or decision:

1. **Update the snapshot** (latest commit hash + active line)
2. **Append to the timeline** — date, commit, one-line summary
3. **Move items between Active / Deferred / Done** as state changes
4. **Keep total length under 400 lines** — archive old completed work into `docs/PROJECT_STATE_ARCHIVE.md` if needed

Don't update for every push. Update for meaningful milestones (a feature shipped, a deferral decision, a config change that affects future work).
