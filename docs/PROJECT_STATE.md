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
| **Latest commit** | `4ac735c` — "maintanence" (intern→team rename code sweep) |
| **Currently active** | UI design refresh (planning phase — see below) |

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

---

## Active

**UI design refresh — scoped pilot** (current focus): Apply the v1.0 design system PDF to the live app on three pages first. See `~/.../My Drive/Checkmark Audio — Design System · Print.pdf` for the visual spec.

**Locked constraints:**
- ✅ Keep top nav (do not refactor to sidebar even though PDF shows sidebar)
- ✅ Keep current menu names (Overview, Tasks, Calendar, Booking, Forum + admin: Hub, Assign, Members, Analytics, Settings)
- ✅ Keep current header as-is
- ✅ Do not modify Settings dropdown content

**In-scope (refresh these three pages):**
- Overview (member-side)
- Assign (admin)
- Hub (admin)

**Out of scope for now:** all other pages. User wants to validate the design language on the highest-impact surfaces first.

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
