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
| **Latest commit (main)** | `d1c046b` — feat(assign): comprehensive /admin/templates Assign-page redesign (PR #9) |
| **Currently active** | **PR #10 open on `claude/assignment-polish-pr10`** — assignment-system polish pass bundling 3 items: (1) **nested-modal stability**: `FloatingDetailModal` now tracks a module-level stack; z-index derives from depth (60 + 10 × depth) and Escape only closes the topmost modal (fixes the "modals close automatically" bug). (2) **Hard-delete templates**: new `delete_task_template` RPC + "Delete" button in `TemplatePreviewModal`. Past `assigned_tasks` survive untouched via the FK SET NULL shipped in PR #8. (3) **Batch cancel UI**: Recent assignments section on the Assign page with per-row Cancel button → `cancel_task_assignment_batch`. |
| **Prior active** | Assign-page redesign (PR #9, merged `d1c046b`). Full `/admin/templates` rewrite onto `task_templates` + 4 modals + `MemberMultiSelect` extraction. |

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
| 2026-04-22 | (PR #10, pending) | **Assignment-system polish.** 3 bundled concerns: (1) `FloatingDetailModal` stacking: module-level stack tracks mount order; `z-index = 60 + depth × 10`; Escape handler guards on `stack[-1] === id` so a single keypress closes only the topmost modal. Backdrop opacity steps down with depth so parent peeks through — clear visual hierarchy. Body scroll lock coordinates with stack (only releases when stack empties). (2) Hard-delete templates: new `delete_task_template` RPC (admin guard, returns `{ items_removed, assignments_preserved }` so the UI can show an honest toast); `deleteTaskTemplate` query helper; Delete button in `TemplatePreviewModal` footer with confirm copy that explains past assignments stay intact. Past `assigned_tasks` survive untouched thanks to the FK `ON DELETE SET NULL` shipped in PR #8. `task_template_items` cascade. (3) Batch cancel UI: new `fetchRecentTemplateBatches` query helper reads `task_assignment_batches` directly (admin RLS) with recipient counts + cancelled state; new `RecentAssignmentsSection` component on Assign page renders last 10 batches with per-row Cancel action wired to `cancel_task_assignment_batch` + cache invalidation of `assigned-tasks` so recipients see the batch vanish without refresh. Cancelled batches stay in the list (muted) so admins can see what they've recalled. |
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
- ✅ **Assign-page redesign** (2026-04-22, `d1c046b` / PR #9, merged). Full `/admin/templates` rewrite targeting `task_templates`. Card grid + filter + 4 modals + extracted `MemberMultiSelect`.
- ⏳ **PR #10 assignment-system polish** (in flight). Modal stacking fix + hard-delete templates + batch cancel UI. Scoped per user feedback after exercising the PR #9 preview.
- ⏳ **Admin Hub "Task Group" tile redesign**: now that `TemplateAssignFlowModal` exists, the Hub's Task Group tile opens it directly with a template picker prepended. Small, high-UX-leverage follow-up.
- **Phase 3+ (deferred)**: assignment history UI, `mark_all_read`, fold assigned-tasks summary into `member_overview_snapshot`, drag-to-reorder template items, unify `report_templates` into `task_templates`, wire real-data Team Tasks / Studio Tasks widgets back onto the Tasks page.
- **Cloudflare migration (queued)**: timing was "once assignment system stable on prod." After PR #9 + PR #10 settle for a day or two, migrate Vercel → Cloudflare Pages as a single-concern PR per `feedback_cloudflare_migration_timing.md`.

**UI design refresh — scoped pilot** (paused): Apply the v1.0 design system PDF to the live app on three pages first. See `~/.../My Drive/Checkmark Audio — Design System · Print.pdf` for the visual spec.

**Locked constraints:**
- ✅ Keep top nav (do not refactor to sidebar even though PDF shows sidebar)
- ✅ Keep current menu names (Overview, Tasks, Calendar, Booking, Forum + admin: Hub, Assign, Members, Analytics, Settings)
- ✅ Keep current header as-is
- ✅ Do not modify Settings dropdown content

**Progress:**
- ✅ **Overview (member) — complete.** 4 widgets: Calendar (weekday strip) / Tasks (flywheel pills + rotating sort) / Booking (CTA) / Notifications (unread tracking). Row 1 Tasks+Notifications, row 2 Calendar+Booking. TODAY eyebrow on every widget.
- ✅ **Admin Hub — complete.** 5 widgets in a 3×4 grid: Assign (2×2) + Notifications (1×1), Flywheel (2×2) + Team (1×1), Approvals (1×2). Functional Assign tiles open modals (Session→CreateBookingModal, Task→AssignTaskModal, Group→AssignGroupModal). Notifications widget has admin Post + Channel create. Flywheel aggregates team KPIs per stage. Approvals inlines approve/reject.
- ⏳ **Assign (admin)** — user called this out as the worst-looking page; redesign when ready.

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
