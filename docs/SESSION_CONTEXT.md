# Session Context — Checkmark Audio Dashboard

> **New Claude session? Read this FIRST, before writing or editing anything.**
>
> This doc is the handoff briefing. It exists so that any API error,
> token limit, or fresh conversation doesn't cost the user hours of
> re-explaining vision and constraints. Keep it accurate. Update the
> "Recent + next" section before you end the session.

---

## How to use this doc

1. On session start, read this file end-to-end plus `docs/PROJECT_STATE.md`.
2. Before starting real work, ask the user 1–3 tight questions ONLY if
   a genuinely needed detail is missing. Don't re-interrogate — this
   doc exists precisely so you don't have to.
3. Before ending the session, update:
   - **Recent + next** (what just shipped, what's queued)
   - **Active plans** (if the focus shifted mid-session)
   - **Key lessons** (add anything the user called out as a pattern
     to keep / avoid)
4. Commit this doc with any substantive change.

---

## Who + what

**Business**: Checkmark Audio — music studio in Albuquerque, NM.
Recording, mixing, education, artist development.

**Team** (all with dashboard accounts):

| Name | Role | Notes |
|--|--|--|
| Owner (the user) | Owner / Lead Engineer | Identity protected by 3 layers — DB triggers + `OWNER_EMAIL` constant + email-first role resolver |
| Bridget Reinhard | Admin — Marketing / Ops | Uses the app daily; has ADHD |
| Gavin Hammond | Engineer | |
| Studio Intern | Intern | |
| Richard Baca | Engineer (intern tier) | Added April 2026 |
| Matthan Bow | Intern | Added April 2026 |

**The app is for this team, on this domain.** It is not a multi-tenant
product right now. If that changes, flag the implications early.

---

## Vision & intent

### What the app is
A daily-ops dashboard for a small music-studio team. One browser tab
that replaces a pile of spreadsheets, calendars, and group chats.

### What it's NOT
- A corporate / enterprise tool. No "enterprise-y" visuals — ADHD-
  friendly comes first.
- A navigation-heavy app. Users open it, glance, act, and move on.
  Deep pages exist but most work happens on Overview and Hub via
  widget click-to-expand modals.

### Feel the user explicitly wants
- **Satisfying, engageable, clickable**. ADHD-aware.
- **Compact box, readable font**. Shrinking the text to make room
  is the WRONG answer — widgets grow before text shrinks.
- **"Today" is the whole frame**. The Overview must feel anchored in
  the current day — TODAY eyebrow on every widget.
- **Gold / white / black only** on chrome. Flywheel stage colors
  (emerald / sky / violet / amber / rose) are the ONE exception and
  only appear on stage badges and task tags.
- **Widgets look like widgets**, not like a webpage with sections.
  Rounded cards, hairline borders, small subtle shadows, interior
  gradients.

### The flywheel is sacred
Every piece of work in the studio maps to one of five stages:
**Deliver → Capture → Share → Attract → Book**. This is not
decorative. It structures tasks, KPIs, analytics. When in doubt,
route the feature through the flywheel.

### Three core entities feed the flywheel
- **Bookings** — calendar appointments (creating one increments
  Book-stage KPI)
- **Tasks** — daily checklist items (checking off increments the
  relevant stage)
- **Sessions** — actual studio work completed (closing increments
  Deliver)

### The app is NOT just a dashboard

This is the **operating system for Checkmark Audio**. That framing
matters. If the app is where login, task flow, bookings, messaging,
contracts, analytics, and (eventually) accounting/education all
live, then "slow to load on Monday morning" is a business-process
failure, not a UX annoyance. Architecture decisions must reflect
that.

---

## North Star — the 3-month definition of "working"

Five operational must-haves. The app is "working" when all five
are true, not before:

1. **Daily reliability** — every team member can log in, land on
   their own up-to-date workspace, and get through the day without
   friction.
2. **Live operational data** — tasks, bookings, sessions, clock-
   in/out, messages, approvals all update correctly and are stored
   safely.
3. **Clear role separation** — admins can manage + analyze;
   regular users see only what they should.
4. **Fast-first-load performance** — first load of the day is
   still fast, not just warm-cache fast.
5. **Extensible structure** — adding widgets, modules, logs, new
   business areas does not require fragile rewrites.

### The ten concrete outcomes that get us there

(From the user's written vision.)

1. **Well-functioning user base** — every teammate has a personal
   account with personalized tasks / sessions / bookings.
   Onboarding procedures for new hires. Reliable repeat login.
2. **Client communications** — integrate with EmailJS. Booking
   confirmations, recurring session reminders, a fluid cancel-
   one-session workflow (Google-Calendar-style recurrence edits,
   NOT cancel-the-whole-series), non-annoying 5-star review asks.
3. **Trackable** — clock in/out logged, live tasks with durable
   add/edit/delete audit trail, live calendar / bookings /
   sessions / KPIs, client DB, accounting-ready. Admin can
   export to spreadsheet.
4. **Modular / updatable** — widgets + assets are easy to add,
   move, update. Ableton-style (malleable), not Pro-Tools-style
   (archaic).
5. **User communications** — Discord-style clarity. Add / manage
   #channels with zero SQL. Templates + tasks transfer between
   accounts without touching code.
6. **Working modals & links** — anything that looks clickable IS
   clickable. Every user chip / avatar leads to that user's
   profile. Snapshot widgets open modals with the full view. Form
   modals actually persist loggable info.
7. **Distinctive admin / regular-user separation** — admins see
   general + admin menus. Regular users see general + every
   user's profile ONLY. No admin data leakage.
8. **Progress-forward approach** — visible momentum. Streaks.
   Graphs that encourage, not just inform. Progress / regression
   is obvious at a glance.
9. **Contract ledger** — a bank for blank contracts the team can
   send to employees and clients for review + signature.
10. **Security** — client + team data is safe. Role boundaries
    enforced at the DB (RLS), not just the UI.

---

## Golden product principle

> **If something is important enough to appear on the Overview, it
> should already exist in the database before the page opens.**

Corollary: the browser should be a fast presentation layer, not a
business-orchestration engine. Daily checklist generation, weekly
rollups, KPI calculations, etc. all run on the backend / scheduled
jobs. The first page load of the day reads prepared data; it does
not compute it.

---

## Studio pain points we're replacing

These are the things the current manual process gets wrong, and
that the app exists to eliminate:

- Poor data tracking (nothing aggregated, nothing historical)
- Unclear task assignment (who owns what today?)
- Forgetting to book clients, or booking with incomplete info
- Missing review asks to Google Business
- Not enough outreach / reminders to bring clients back
- Employee contracts scattered across drives
- Data-security gaps
- Lost files

If we get this wrong, we regress to those problems. Every feature
should kill at least one of them.

---

## Key lessons & non-negotiable constraints

These are hard-won. We have paid real time for each one. **Do not
relitigate them unless the user brings them up.**

### UX / Visual

- **"Compact" means "the BOX can be efficient, the TEXT cannot
  shrink."** Readability > density. If the widget needs to be
  taller to fit readable text, the widget is taller.
- **Visual taste matters and the user has it.** When they send a
  reference image, it's "what GOOD looks like to me" — not a
  pixel-perfect spec. Pay attention to spacing that breathes,
  fonts that read effortlessly, colors that feel intentional,
  edges that line up.
- **Gold / white / black only** on chrome. If a widget needs a blue
  accent, it needs a better reason. Flywheel stage colors are the
  exception and live only on task stage badges.
- **No navigation-away links in widgets**. "Open X →" at the
  bottom of a widget was explicitly rejected. Clicking the widget
  title opens a floating modal showing that widget's expanded
  content — never the full corresponding page.
- **"Today" is the frame of Overview**. TODAY eyebrow
  (gold caps, tracking wide) at the top of every widget.

### Architecture

- **Overview (`/`) and Admin Hub (`/admin`) MUST NEVER mix
  widgets.** Enforced via two disjoint TypeScript union types
  (`MemberWidgetId` vs `AdminWidgetId`). Registration arrays +
  component maps are typed per-side. Compile-time cross-pollination
  error. Do not loosen this.
- **The Vercel edge cache does not cache `/index.html`**
  (`CDN-Cache-Control: no-store` in `vercel.json`). Assets are
  content-hashed + immutable. This means **no hard refresh is ever
  needed after a deploy**. If a user reports they need to hard-
  refresh, something regressed here.
- **Compat views for table renames, never downtime migrations.**
  The intern→team rename used Approach B (table rename + compat
  views). See `docs/intern-rename-resume/`.
- **Three-layer owner protection**: DB triggers + `OWNER_EMAIL`
  constant + email-first role resolver. Do not remove any of them.
- **Implicit auth flow, not PKCE.** The whole recovery-gate layer
  is built around hash-based recovery tokens. Flipping to PKCE
  breaks it.
- **No state updates inside `onDragOver` for multi-container dnd-kit
  sortables.** A single mouse gesture sweeps the cursor through many
  over-targets; each state update fires a reshuffle, which cascades
  (learned the hard way in PR #34 — widgets piled into whichever
  column the cursor ended in). Commit on `onDragEnd` only. Live
  sibling-shift during drag is provided by useSortable's transform
  previews, not by state changes.

### Performance (added April 2026 based on Codex diagnosis)

- **FAST LOADING IS NON-NEGOTIABLE** for all machines, every time.
  If it's an internet issue out of our control, fine. If it's
  anything else, treat it as a P0 bug.
- **No business orchestration at first render.** Daily checklist
  generation, weekly aggregates, KPI calculations — all run in
  Supabase scheduled jobs / Edge Functions. Browser reads prepared
  data.
- **Snapshot APIs for landing pages.** Overview and Hub each get
  ONE RPC / Edge Function that returns their above-the-fold data
  in a single response. No 8-query startup waterfall.
- **Every hot query has an index.** Verify before merging any
  new fetch path.

### Design consistency

- **No mid-page font drift.** Headers, subtext, body, captions,
  labels — every page uses the same semantic typography tokens
  (see `src/index.css` `.text-display / .text-title / .text-section
  / .text-body / .text-caption / .text-label`). If a widget uses a
  one-off size, it's a bug unless justified inline with a comment.
- **Every widget has the same chrome shape** (widget-card class,
  22px radius, hairline border, gradient).
- **All checklists render the same way** (14px checkbox, 5px
  radius, rose border for critical, muted border for normal).

### User base must remain clickable

- **Every instance of a username / avatar is a clickable
  link to that user's profile.** If it breaks silently again,
  it's a regression — add a test before fixing.
- **Users are distinct entities.** Personalized overviews,
  personalized task assignments. No shared "demo user" fallback
  in production.

### Process

- **One question at a time** to the user. Do not batch 3+ decisions
  into a single AskUserQuestion call unless they're genuinely
  mutually-exclusive choices.
- **Slow is fine, sloppy isn't.** Verify before pushing. Don't
  "optimize for ship speed" at the cost of polish.
- **Trust user interruptions.** If they say something is broken,
  it is. Don't try to convince them it's fine.
- **Update `docs/PROJECT_STATE.md` on meaningful commits.**
  (Timeline + active/deferred/done sections.)
- **Update this doc's "Recent + next" section before session end.**
- **Never run destructive git commands** (force-push, reset-hard,
  branch -D) without the user asking for them explicitly.

---

## Architecture snapshot

- **Frontend**: Vite + React + TypeScript + Tailwind v4 (`@theme`
  block in `src/index.css`)
- **Hosting**: Vercel, auto-deploys from `main`. `vercel.json` at
  repo root.
- **DB + Auth**: Supabase. Project ref `ncljfjdcyswoeitsooty`
  ("Checkmark Intern Manager"). Connection via MCP for admin-side
  work.
- **State / data**: react-query for caches, localStorage for
  widget layout (versioned — see `WORKSPACE_LAYOUT_VERSION`).
- **Drag + drop**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Canonical design**: `Checkmark Audio — Design System · Print.pdf`
  in user's Google Drive, plus the HTML mockups in
  `/Users/bridges/GITHUB/Checkmark Workspace-UI-Draft/` (at least:
  `index.html` = Overview, `assign.html` = Assign page).

### Widget system overview

- `src/domain/workspaces/registry.ts` — `MEMBER_WIDGET_REGISTRATIONS`,
  `ADMIN_WIDGET_REGISTRATIONS`, and bank arrays. Any widget appears
  in EXACTLY one of these two typed arrays.
- `src/components/dashboard/widgetRegistry.tsx` — ties each widget
  id to its React component. Separate typed component maps per side.
- `src/components/dashboard/WorkspacePanel.tsx` — renders the grid,
  dnd-kit, and owns the expand-widget modal state.
- `src/components/dashboard/DashboardWidgetFrame.tsx` — widget
  chrome. Whole title area is a click target (opens floating
  modal). Grip icon = drag handle.
- `src/components/FloatingDetailModal.tsx` — shared modal used by
  BOTH widget click-to-expand and the Assign template preview.
  Dismiss: Esc, X button, backdrop click.

---

## Business ecosystem (long-term)

Checkmark Audio is building a connected set of tools, not a single
dashboard. Rough plan:

1. **This dashboard** — studio-team operating system (current).
2. **Checkmark Accountant** — existing HTML page gets folded into
   this site without feeling grafted-on.
3. **Checkmark Education Portal** — a branch of the site for the
   studio's education program (modules, assignments, student
   progress).
4. **Optional future**: white-label client-site templates sold to
   artists / other studios. Not a priority, but design decisions
   should avoid painting us into a single-tenant corner.

---

## Phased roadmap (from Codex diagnosis, user-agreed)

The UI refresh we've been doing is Phase 0. After it lands, the
work moves to backend/architecture foundations before more UI.

### Phase 1 — Stabilize the foundation

Everything depends on this layer. Start here.

- **Instrument load performance**. Add timing around auth, profile
  fetch, overview snapshot load, and checklist generation.
  Identify the exact startup waterfall.
- **Remove client-side daily generation.** Move to Supabase
  scheduled job / Edge Function so daily checklist instances and
  other "prepare today's data" work happens before the user
  arrives.
- **Build snapshot endpoints**: `member_overview_snapshot(user_id,
  date)` and `admin_hub_snapshot(date)`. One RPC each, returns the
  whole above-the-fold payload.
- **Add / verify DB indexes** for every hot query surfaced in the
  instrumentation.
- **Fix local build reliability** so the repo always builds
  cleanly with no transient failures.

### Phase 2 — Lock in the product model

- Formal **user / profile / role** architecture. Personalized
  overviews per user.
- Formal **task assignment model**: template assignments + custom
  direct assignments + approvals + audit log.
- Formal **sessions / bookings / calendar lifecycle**
  (create → confirmed → completed / cancelled flows).
- Add durable **activity / event log** tables so every key action
  leaves a record (clock in/out, task CRUD, booking changes,
  session status, forum posts, contract signatures, KPI updates).

### Phase 3 — Make it truly operational

- Clock-in/out logging.
- Task / action audit trails.
- Booking + session **reminders** (EmailJS) and cancellation flows
  (Google-Calendar-style recurring edits: one-off cancel doesn't
  cancel the series).
- Admin **spreadsheet exports**.
- Forum **live updates + read-state tracking** (Discord-style).
- **Contract / document bank**.
- **5-star review ask** flow (non-annoying).

### Phase 4 — Polish + scale

- Resolution-proof widget layout (one design, every viewport, no
  "phone version").
- Design-token cleanup pass (typography + spacing consistency).
- Modular widget registry with user-created widgets (minimize the
  need to code for new ones unless fundamentally different).
- Theme / color / branding presets (Ableton-style).
- Accounting integration (fold in existing HTML page).
- Education portal branch.

### Ranking if time forces a trade-off

1. Performance + architecture stabilization (Phase 1)
2. Individualized user data model (Phase 2)
3. Assignment + approval system (Phase 2)
4. Trackable logs + admin exports (Phase 3)
5. Messaging / forum reliability (Phase 3)
6. Analytics / flywheel depth (Phase 3, depends on event ledger)
7. Contract / document bank (Phase 3)
8. Accounting + education (Phase 4)

---

## Active plans

### In progress — UI design refresh

All 4 highest-impact surfaces now share the same grammar:
column-snap `WorkspacePanel` (3 independent column stacks) +
`DashboardWidgetFrame` (drag grip + expand-to-modal). Drag model
(PR #34): during drag only the `DragOverlay` ghost follows the
cursor; on release, cross-column = direct 1-for-1 swap, same-column
= sortable insert+shift, empty column = append. Controls card
hidden; widgets are visible-by-default and non-removable for now.

- ✅ **Overview (`/`)** — 3-col grid: Tasks / Today's Calendar /
  Forum Notifications / Booking Snapshot. Shared `CalendarDayCard`
  with `/calendar`.
- ✅ **Admin Hub (`/admin`)** — 3-col grid: Quick Assign + Approvals ·
  Flywheel (real `assigned_tasks` data, dual-opacity bars) ·
  Notifications + Team.
- ✅ **Tasks (`/daily`)** — 3-col grid: My Tasks · Studio · Team Board.
  Bottom-of-list "+ Task" add pattern; click body → `TaskDetailModal`,
  click checkbox → complete.
- 🟡 **Assign (`/admin/templates`)** — rebuilt from scratch per the
  user's hand-drawn sketch. PRs #41–#45 landed; **PR #46 in flight**
  closes out the sketch:
    - Col 1: Task Requests · Approval Log · Edit twin-button
      (Edit Task + Edit Booking, rs 0.5).
    - Col 2: Assign (2 tiles: +Task / +Booking with row-by-row
      modal + Add-from-template) · Assign Log.
    - Col 3: Templates (rs 2 — friendly thumbnails with per-role
      icons, search/filters/Arrange pinned above scrolling grid).
  PR #46 ships: existing Templates "Include archived" toggle renamed
  to "Show archived"; new Arrange-by selector (A–Z / Newest / Role)
  with Role grouping under section dividers; the big-card grid is
  replaced with a 2-per-row grid of friendly tiles (circular gold
  icon bubble keyed off role-tag — Headphones / Megaphone /
  GraduationCap / Code2 / Briefcase / Settings / FileText fallback —
  + name on two lines + task count). Onboarding templates get a
  tiny emerald GraduationCap badge on the icon corner. Search /
  filters / Arrange row stays pinned while the grid scrolls.
  (Iterations: rev1 first pass shipped a separate
  `admin_template_preview` widget; user asked for it folded into
  Templates instead. rev2 returned rowSpan 3 → 2 and made the tiles
  bigger / friendlier per the user's reference image.)

### Deferred

- Real flywheel event ledger (Phase 2 of original blueprint) — the
  highest-leverage future work. Today's analytics are placeholders.
- Column rename (Approach A): `intern_id` → `member_id` in 9
  tables. Tables are renamed; columns are the cleanup. See
  `docs/intern-rename-resume/`.
- Theme DB persistence (currently localStorage).
- Profile pictures + banners (Supabase Storage).
- React Query everywhere (barely used today).
- Onboarding flow for new hires.
- "View as member" admin toggle.

---

## Performance baseline — Phase 1 Step 2 all landed (2026-04-20)

Opt-in perf tracer at `src/lib/perfTrace.ts` — no-op unless
`localStorage.debugPerf = '1'`. Initial baseline (morning of
2026-04-20, before any Phase 1 Step 2 work):

```
⏱ Overview cold start: 1,289ms  (8 checkpoints, longest overview:batch 427ms)

  @76ms     0ms    auth:getSession
  @76ms   270ms    auth:fetchProfile:byId   ┐
  @80ms   262ms    auth:fetchProfile:byId   │ 3 profile fetches
  @658ms  399ms    checklist:rpc            │
  @659ms  427ms    overview:batch           │
  @666ms  420ms    auth:fetchProfile:byId   ┘
  @1057ms 196ms    checklist:items
  @1085ms 203ms    overview:streak
```

**End-of-day locked baseline (after PRs #1 + #2 + #3 + #4):**

```
⏱ Overview cold start: 826ms  (6 checkpoints, longest checklist:items 265ms)

  @7ms     1ms    auth:getSession
  @8ms   258ms    auth:fetchProfile:byId   ← 1× per PR #2
  @372ms 181ms    overview:batch           ┐
  @372ms 187ms    checklist:lookup         │ parallel
  @553ms 173ms    overview:streak          ┘ next parallel
  @559ms 265ms    checklist:items

  NO checklist:rpc — backend-prepared state is real (PR #3 cron)
```

**Full day: 1,289 → 826ms = −36% / −463ms.** Target was 500–700ms —
we're 125ms above the ceiling, and 2C is the remaining lever.

Dev numbers from the initial probe (21s cold, 7s `overview:batch`)
were a dev-mode artifact — Vite HMR + source maps + slow dev RPC
path. Prod reality is ~1.3s, not 21s. Codex's diagnosis still
points at the right structural issues, just smaller in magnitude.

### What the day's work shipped

1. **PR #1 — `chatSupabase` duplicate client removed.**
   `"Multiple GoTrueClient instances"` warning gone. 1 of 3
   profile fetches eliminated. `overview:batch` 427→185ms
   (concurrent-token-refresh race also resolved). Delta:
   1,289 → 998ms.
2. **PR #2 — `fetchProfile` cold-start race deduped.** `getSession`
   path and `INITIAL_SESSION` event no longer both fire a fetch.
   2×→1× profile fetch. Architectural hygiene — fetches were
   already parallel so latency was ~stable.
3. **PR #3 — cron-materialize checklist instances.** pg_cron at
   11:00 UTC (5am MDT / 4am MST) runs `cron_materialize_checklists()`
   which iterates active members and pre-creates today's rows.
   Client fast-path (`checklist:lookup`) hits the pre-materialized
   row and skips the RPC. `checklist:rpc` no longer fires on cold
   start — backend-prepared state is real. −~170ms.
4. **PR #4 — tracer fix.** Flush was firing too early on a race
   between profile arrival and refetch kickoff. `lastLoadedProfileId`
   ref gates the flush on "real batch completed for this profile."
   Revealed the true post-2B cold start: 826ms (6 honest checkpoints)
   where we previously read 870ms with 7.

### Remaining gaps — targets for Phase 1 Step 2C (snapshot RPC)

- **~100ms gap** from `auth:fetchProfile:byId` end (@266ms) to
  the parallel batch start (@372ms). React.lazy route chunk +
  `MemberOverviewProvider` mount. 2C naturally shrinks this
  because the batch can start earlier when it's one call, not
  four parallel ones.
- **`checklist:items` 265ms** is now the longest span — 22 daily
  rows fetched after the lookup returns the instance id. Folding
  the row fetch into the snapshot RPC eliminates the round-trip.
- **`overview:batch` 181ms + `overview:streak` 173ms + `checklist:items`
  265ms + `checklist:lookup` 187ms = ~806ms of round-trips.** 2C
  collapses these into one ~200–300ms snapshot call. Predicted
  savings: ~200–300ms, putting us comfortably inside the
  500–700ms target.

### Observability added today

- `public.cron_run_log` — admin-read RLS, logs each pg_cron run
  with `users_processed`, `users_failed`, `notes`, `duration_ms`.
  Query: `SELECT * FROM cron_run_log ORDER BY ran_at DESC LIMIT 5;`
- `cron.job` / `cron.job_run_details` — pg_cron built-ins for
  verifying schedules and recent runs.

### Target post-Step 2C

500–700ms on current hosting. 826ms today. 2C is projected to
land us inside the target, after which Cloudflare migration
becomes the natural next move (timing at Claude's judgment per
`feedback_cloudflare_migration_timing.md` memory).

Instrumentation points live in: `main.tsx` (`app:bootstrap`),
`contexts/AuthContext.tsx` (`auth:getSession`, `auth:fetchProfile:byId`,
`auth:fetchProfile:byEmail`), `contexts/MemberOverviewContext.tsx`
(`overview:batch`, `overview:streak`, flush on ready),
`hooks/useChecklist.ts` (`checklist:rpc`, `checklist:items`).

---

## Recent + next

### Just shipped (most recent first)

- **PR #47 — Assign-page + Overview-page default widget orders updated — 2026-04-25 evening (in flight).** Pure visual cleanup, three revs.
  - **rev1**: User asked for the Assign widget (col 2 top, was rs 1) to match the Edit widget's compact height (col 1 middle, rs 0.5) so they read as a consistent twin-button pair. `AdminAssignWidget` rowSpan: 1 → 0.5; `AssignTile` body collapsed from a large icon-with-hint card to a twin-button row (icon + label inline) matching `EditButton` exactly.
  - **rev2**: User dragged the Assign-page widgets into a layout they liked and asked for it to be the new default. Updated placements: col 1 = `admin_assign_log` (top) → `admin_approval_log`; col 2 = `admin_assign` (rs0.5) → `admin_edit_tasks` (rs0.5) → `admin_task_requests`; col 3 = `admin_templates` (rs2 unchanged). Reordered `ADMIN_WIDGET_REGISTRATIONS` array so within-column order resolves: `admin_assign_log` registered ahead of `admin_approval_log`; `admin_edit_tasks` registered ahead of `admin_task_requests`. Hub overview placements unchanged (`admin_task_requests` still stacks under `admin_quick_assign` in col 1 of `admin_overview`).
  - **rev3**: Same pattern, Overview page. User asked to lengthen My Tasks to match Calendar and shrink Notifications "so they all fit good together". Updated placements: `team_tasks` member_overview rowSpan 1 → 2 (matches Calendar height); `booking_snapshot` col 2 → col 3 (top, rs0.5 unchanged); `today_calendar` stays col 2 rs2 (now fills col 2 alone); `forum_notifications` rs2 → rs1 so col 3 (Booking 170px + gap + Notifications 340px ≈ 526px) reads as a balanced stack vs the rs2 widgets in cols 1-2 (~696px each). The Tasks-page (`/daily`) `team_tasks` placement at rs2 was already correct and was unchanged.
  - `WORKSPACE_LAYOUT_VERSION` 24 → 27 (rev1 → 25, rev2 → 26, rev3 → 27).
  - No DB / RPC / type changes. Verified each rev: `tsc --noEmit` clean, `npm run build` clean, dev preview confirms widget placement matches the screenshots.
- **PR #46 — Templates Arrange-by + per-role thumbnails — 2026-04-25 evening (merged `6b23dbb`).** Closes out the user-sketched Assign-page redesign (the last of the seven sketch decisions). Shipped in one consolidated widget across three rev passes.
  - **`AdminTemplatesWidget` enhancements**: existing "Include archived" toggle renamed to **"Show archived"** to match the sketch. New **Arrange-by selector** (A–Z / Newest / Role) sits to the right of the toggles in a segmented pill — gold-on-dark for the active option. Role arrangement groups templates under role-tag section dividers (Engineer / Marketing / Intern / Dev / Admin / Ops, then any extras alphabetically, then a "No role" bucket last).
  - **Friendly per-role thumbnail grid**: 2-per-row grid replaces the previous big-card preview. Each tile is a circular gold icon bubble + template name (line-clamp 2, 12px) + task count. The icon glyph is keyed off the template's `role_tag` via the `iconForRole(roleTag)` map: Headphones=engineer, Megaphone=marketing, GraduationCap=intern, Code2=dev, Briefcase=admin, Settings=ops, FileText=default. Archived templates render at 60% opacity. Onboarding templates get a tiny emerald GraduationCap badge on the top-right of the icon bubble.
  - **Pinned controls + scrolling grid**: search / filter pills / toggles / Arrange-by all sit in `shrink-0` rows at the top; the grid lives in a `flex-1 overflow-y-auto` body so the controls stay visible while the grid scrolls. Templates stays at rowSpan 2 so col 3 reads balanced against cols 1-2 (rev2 corrected the earlier rs3 bump).
  - **Rev history**:
    - **rev0** (`bb8149b`): first pass — added a separate `admin_template_preview` widget below Templates. User feedback: fold it INTO Templates so search/filters/Arrange stay attached.
    - **rev1** (`b8fd600`): merged the thumbnails into Templates; deleted `AdminTemplatePreviewWidget.tsx`, the `admin_template_preview` id, and the now-unused `TemplateCard.tsx`. Bumped Templates rs2 → 3 to fill col 3.
    - **rev2** (this push): col 3 felt disproportionately tall vs cols 1-2, and the small tiles felt sterile. Brought rowSpan back to 2; resized tiles bigger (w-12 h-12 icon, 12px name, p-3 padding, 2-per-row instead of 3); added per-role icons; upgraded the onboarding indicator from a plain emerald dot to a tiny GraduationCap badge.
  - `WORKSPACE_LAYOUT_VERSION` 22 → 24 (rev1 took it 22 → 23, rev2 took it 23 → 24).
  - Verified: `tsc --noEmit` clean, `npm run build` 2.79s, dev preview confirms 6 Assign-page widgets mount in the correct order (Task Requests · Approval Log · Edit · Assign · Assign Log · Templates).
- **Assign-page redesign per user sketch — PRs #41–#45, 2026-04-25.** User hand-drew the Assign page they wanted (col 1: Task Requests + Approval Log + Edit · col 2: Assign + Assign Log · col 3: Templates + Preview). Locked answers to 7 design questions then ran the rebuild as 5 small PRs. Five of six landed; **PR #46 (Templates enhancements + Preview widget) is queued and is the only remaining piece**.
  - **PR #41 `3fcb2ab`** — Column reorg + Assign widget shrunk from 4 tiles → 2 (+Task / +Booking). Studio Task reachable via Task modal scope toggle; Task Group folded into PR #42's Add-from-template. `AssignGroupModal` deleted. `WORKSPACE_LAYOUT_VERSION` 17 → 18.
  - **PR #42 `6541f32`** — Row-by-row +Task modal. Members/Studio toggle at top. "+ Add task" / "+ Add from template" sub-flow that pulls template items into editable rows. New `assign_custom_tasks_to_members` (plural) RPC: ONE batch + N×M tasks + ONE notification per recipient ("3 new tasks"). Hub Quick Assign keeps the simpler single-task `AdminTaskCreateModal`.
  - **PR #43 `132afc7`** — Edit widget split into compact twin-button (Edit Task + Edit Booking, rs 0.5). Three new RPCs for sessions: `admin_list_all_sessions`, `admin_update_session` (fires `session_reassigned` on engineer change), `admin_delete_session`. New `AdminEditSessionsModal` mirrors AdminEditTasksModal — search by client, assignee filter, include-past toggle, click-to-expand inline edit + soft overlap warning + delete-with-confirm. Copy: "Session"→"Booking", "All engineers"→"All assignees". Col 1 registration order swapped so Task Requests sits above Edit per the sketch. v18 → 20.
  - **PR #44 `b75f7de`** — Assign Log widget (col 2 under Assign). 3-column rows: title / "First L." / "Today"|"Apr 25". New `admin_recent_assignments` RPC interleaves member + studio + session rows by recency. **Mid-PR DB structural fix**: studio tasks were silently invisible because both the studio + team fetcher RPCs INNER-JOINed the recipient chain (which is NULL for studio rows) to scope by team. Solution: denormalize `team_id` directly onto `assigned_tasks` (new column + backfill). Both insert RPCs set it via `get_my_team_id()`; both fetchers filter by `t.team_id`. Also: switched the Assign Log's projection from `row_to_jsonb(r)` (broken on anonymous-record subqueries) to explicit `jsonb_build_object`. v20 → 21.
  - **PR #45 `8c863dc`** — Approval Log widget (col 1 between Task Requests and Edit). Surfaces BOTH approved + declined task_requests, labelled by outcome (green ✓ / rose ✕ + title + requester "First L." + relative time, decline rows show note italic on 2nd line). New `admin_recent_approvals` RPC. Approve/decline mutations invalidate `['admin-log']` so new entries appear immediately. Note: `task_requests` column is `reviewed_at` not `resolved_at` — JSON key kept as `resolved_at` for the client. v21 → 22.
  - **Sketch decisions captured (memory for future PRs)**:
    - Approval Log: BOTH approved + declined, labelled by outcome.
    - Assign Log row format: title / "First L." (e.g. "Bridget R") / "Today" or "Apr 25".
    - Templates "Arrange by" = role tag, with role-name dividers in the Preview thumbnail section.
    - Templates "Show archived" = on/off pill, stays on while other filters are picked.
    - Preview widget = file-system-style thumbnails grouped by role tag, clickable to the same template-detail modal.
    - +Task modal: row-by-row format with Members/Studio toggle + "Add from template" sub-flow that picks template items via checkboxes and populates them as editable rows.
    - Edit Booking modal must support: change details, change assignee, delete, reschedule. Soft overlap warning on engineer conflicts.
- **Tier 1 closeout + Edit Tasks library — PRs #37–#40, 2026-04-25 morning.** Closed the loose ends from the task-system rework + shipped the admin Edit Tasks library.
  - **PR #37 `5634e94`** — `get_member_assigned_tasks` was missing `can_complete` etc. → My Tasks checkboxes were disabled. RPC recreated. Team Tasks `can_complete` tightened (drop admin-override). Restored pending→Submit Completed flow on all 3 task widgets.
  - **PR #38 `da916e8`** — Peer "Request to take" reassignment end-to-end. New `task_reassign_requests` table + 3 enum values + 4 RPCs + Approve/Decline modal. Hover overlay on team members' rows in Team Tasks.
  - **PR #39 `683199c`** — Studio Task tile on Assign widget (4th, before #41 shrunk it again), AdminNotificationsWidget reassign parity, approve_task_reassignment race safety (auto-cancels if assignee changed since the request).
  - **PR #40 `c8f617e`** — Edit Tasks library widget on Assign page. `admin_list_all_assigned_tasks` + `admin_update_assigned_task` RPCs. New `task_edited` notification type. Modal with search / assignee filter / include-completed + click-to-expand inline edit form.
- **Layout polish + task UI cleanup — PRs #35–#36, 2026-04-24 afternoon.**
  - **PR #35 `46c140a`** — Studio + Team Tasks on /daily had nested widget-card chrome inside DashboardWidgetFrame (visible "double box"). Stripped inner Card/Header.
  - **PR #36 `d602c67`** — Flywheel stage pills + right-aligned due date back on My Tasks + Team Tasks. Widget descriptions cleared on team_tasks/studio_tasks/team_board. Header N-open line removed. Show-completed becomes an icon-only eye toggle in a sticky footer beside +Task. Pending-request chip moved to same footer. Helpers: `taskStage(category)` + `formatDueShort(dueDate)`.
- **Column-snap grid + smooth drag + direct swap — 3 PRs, 2026-04-24 afternoon.** PRs #32–#34 reworked the widget grid's interaction model.
  - **PR #32 `a48b081`** — `WorkspacePanel` moved from implicit row-major flow to 3 independent column stacks (`col` + per-column `order`). Drag feel made Monday.com-smooth via `DragOverlay` (widget-shaped gold-outlined ghost following the cursor above the grid) + live cross-column move in `onDragOver` so siblings shift out of the way. `closestCorners` collision detection for multi-container drag. Empty column drops supported via `col-N` droppable wrappers. `WORKSPACE_LAYOUT_VERSION` 14 → 15.
  - **PR #33 `dd105b0`** — three focused polish items: (1) Tasks-page widgets all bumped to rowSpan 2 (~696px) so long queues are visible at a glance. (2) Booking widget compacted to rowSpan 0.5 (~170px) as a pure "+ Book a Session" action chip — upcoming-today counter + next-session detail removed. Repositioned from col 1 under My Tasks to col 2 above Calendar. New fractional rowSpan supported by `WidgetRowSpan` type + `widgetHeight()`. (3) Fixed `column assignee.name does not exist` on /daily Team Tasks — `get_team_assigned_tasks` RPC recreated with `assignee.display_name` instead of `.name` (intern_users has no `name` col). Migration applied to prod Supabase. `WORKSPACE_LAYOUT_VERSION` 15 → 16.
  - **PR #34 `f95f3a5`** — cross-column widget-to-widget drag now does DIRECT 1-for-1 swap (A takes B's slot, B takes A's old slot). First attempt committed the swap live in `onDragOver` → caused a **cascading-swap bug**: every widget the cursor brushed got swapped with the active one, piling widgets into whichever column the cursor ended in (screenshot from user showed col 1 empty + 3 widgets stacked in col 3). Fix: removed `onDragOver` entirely. `onDragEnd` is the single commit point now. During drag only the ghost moves; on release, exactly one swap/move/reorder happens based on drop target. New `swapWidgets(aId, bId)` helper on `useWorkspaceLayout`. Same-column reorder still uses sortable's transform preview + insert-on-drop.
  - **Key lesson captured**: live state updates in `onDragOver` during multi-container sortable drags are dangerous — the cursor sweeps through many over-targets in a single gesture, and each one firing a state change causes cascading reshuffles. Commit on drop only.
  - **Net across #32-34**: widget grid went from row-major flow (PR #30) → column-snap explicit placement (#32) → column-snap with direct-swap + Monday-level drag smoothness (#34). The "resolution-proof single layout" roadmap item (Phase 4) gets meaningfully closer.
- **Layout + task-surface consolidation — 15 PRs, 2026-04-23/24 session.** PRs #17–#31 all merged to main. Overview / Hub / Tasks / Assign now share one grammar: `WorkspacePanel` + equal-width 3-column grid + `DashboardWidgetFrame` (drag grip + expand-to-modal). Controls card hidden site-wide.
  - **PR #17 `a13dbe4`** — Rich `+Task` modal (Monday.com "+ Add item" bottom-of-list pattern) with title + description + flywheel stage picker + due-date. Tags carry through request → approval → materialized task.
  - **PRs #18–#19 `148257a` · `c07a7ea`** — Unified admin task modal (consolidated 3 overlapping admin modals into one Hub-owned Quick Assign). Hub's Assign widget reordered to lead with Quick Assign.
  - **PRs #20–#21 `0054dea` · `6924b41`** — Assign Trello-style 3-column layout (Assign / Approve / Templates) + pinned-tile pattern + canonical Ableton-style filter pills with counts.
  - **PRs #22–#23 `371a547` · `e789f33`** — Overview 3-column layout + new shared `CalendarDayCard` (same day-view on Overview widget and `/calendar` page). Tasks + Booking split into standalone widgets so drag-reorder treats them independently.
  - **PR #24 `7f03e7e`** — Hub 3-column layout (Quick Assign+Approvals · Flywheel · Notifications+Team).
  - **PRs #25–#26 `f9b4279` · `ac8615d`** — `TaskDetailModal` + split click surfaces (checkbox = complete, body = detail modal). Notification click routing branches by status (`task_request_submitted` → Hub approval queue; `task_request_approved` → highlight the materialized task).
  - **PRs #27–#28 `b594b2b` · `ebd833e`** — Hub Flywheel widget wired to real `assigned_tasks` data with dual-opacity bars (opaque = done, translucent = assigned-open). PR #28 fixed a cache-invalidation miss — approving a tagged request now invalidates `['team-assigned-tasks']` + `['studio-assigned-tasks']` so the flywheel updates without refresh.
  - **PRs #29–#30 `c266640` · `334e55f`** — `WorkspacePanel` restored across all 4 pages with equal columns + drag-reorder. PR #30 regression-fixed: `TASKS_WIDGET_DEFINITIONS` + `ASSIGN_WIDGET_DEFINITIONS` exported with scope filtering so each page gets the right widgets; row-spans restored (Overview col-1 stacks Tasks+Booking under a 2-row Calendar/Notifications). `WORKSPACE_LAYOUT_VERSION` 11→14.
  - **PR #31 `76884fa`** — Hide workspace controls bar site-wide (`showControls={false}`). With widgets visible-by-default + non-removable, the "Arrange your …" card did nothing the widget frames didn't already do. Drag + expand still work.
  - **Net**: 4 pages share one grammar; task-assign flows all unified through a single modal path; flywheel shows real momentum; task clicks open rich detail; nothing decorative remains in the controls strip.
- **Monday-style task system completed — 6 PRs, 2026-04-22 session.** PRs #11–#16 all merged to main, taking the assignment system from MVP to near-complete.
  - **PR #11 `ec8d3b7`** — Unified MyTasks (retired `AssignedTasksWidget`, MyTasksCard reads real data + click-to-highlight).
  - **PR #12 `0b09313`** — Scope foundation: `assigned_tasks.scope` column + member/studio CHECK + two new RPCs (`get_team_assigned_tasks`, `get_studio_assigned_tasks`). `/daily` rebuilt around three columns (My · Studio · Team).
  - **PR #13 `9cf9bf5`** — Assign page redesign: Quick Assign inline compose + Assign-a-Session tile + Templates grid. Session-assign RPC (`assign_session`) + notifications table extended with `session_id` (XOR with `batch_id`). Notification click routes by subject. **Also shipped preview auto-login**: `Login.tsx` checks `VITE_PREVIEW_LOGIN_*` env vars + hostname pattern; production alias hardcoded excluded. Env vars live in Vercel Preview scope only. No more re-login per PR.
  - **PR #14 `aa53c79`** — Studio scope write-path. `assign_custom_task_to_members` gains `p_scope`; studio mode writes single shared row, no recipients, no notifications. `complete_assigned_task` scope-aware (studio = any team member). Members/Studio toggle in Quick Assign header. `completed_by` recorded.
  - **PR #15 `eef4ff3`** — Session polish: `/sessions` listens for `highlight-session` event (scroll + flash). Amber conflict banner in SessionAssignModal when engineer has overlapping booking (non-blocking).
  - **PR #16 `c0e6a47`** — Self-serve task requests. New `task_requests` table + 5 RPCs + 3 new notification types. "+ Task" button in MyTasksCard header with expandable pending-requests strip. `PendingTaskRequestsWidget` on admin Hub with inline Approve/Decline (optional note on decline). Approval atomically materializes an `assigned_tasks` row. `WORKSPACE_LAYOUT_VERSION` 10→11.
  - **DB delta**: 1 new table (`task_requests`), 4 columns added, 5 enum values, ~12 new RPCs, 2 existing RPCs extended. All migrations applied to staging `ncljfjdcyswoeitsooty`.
  - **Docs-drift discipline was violated** — none of the 6 PRs updated PROJECT_STATE or this file in-PR. Caught up post-session as a docs-only commit to main (per `feedback_pr_flow_threshold.md`: docs-only goes direct).
- **Member task-surface unification — MERGED (PR #11, 2026-04-22).**
  Three bundled fixes surfaced while exercising PR #10 preview:
  1. **AssignGroupModal rewired** to the new RPC pipeline
     (`assign_template_to_members` + `task_templates` + MemberMultiSelect).
     Previously it wrote to legacy `task_assignments` which didn't
     trigger notifications — "Task Group" submissions went into the
     void. Now atomic: batch + recipients + assigned_tasks +
     notifications all fire.
  2. **MyTasksCard rewritten** to read `assigned_tasks` directly.
     Mock arrays (MY_TODAY_SEED / MY_WEEK_SEED), `MyTasksContext`,
     and `CreateTaskModal` deleted — never DB-backed. "My Tasks" is
     now an honest, realtime-subscribed surface.
  3. **`AssignedTasksWidget` retired** from the member widget
     registry — content folded into `team_tasks` (MyTasksCard).
     Members now have ONE place for all tasks. `WORKSPACE_LAYOUT_VERSION`
     9→10 so saved layouts referencing `assigned_tasks` get sanitized.
  4. **Click-to-highlight** wired end-to-end: Notifications widget's
     assignment rows dispatch `highlight-task` CustomEvent with
     `batchId`; MyTasksCard listens, scrolls the first matching task
     into view, flashes a gold ring for ~1.6s. Same wiring on
     AdminNotificationsWidget for symmetry.
  `tsc` clean, build 2.79s, dev-verified (Overview + Tasks pages
  render cleanly, `AssignedTasksWidget` gone, `highlight-task` event
  dispatches without error).
- **Assignment-system polish — MERGED (PR #10, `09ec6fc`).**
  Bundled 3 fixes per user's PR #9 feedback:
  1. **Modal stacking fixed in `FloatingDetailModal`.** Module-
     level stack tracks mount order; `z-index = 60 + depth × 10`;
     Escape closes only the topmost modal (`stack[-1] === id`);
     backdrop opacity steps down with depth so parent peeks
     through. Fixes the "modals close automatically" bug — was
     one keypress firing `onClose` on every open modal.
  2. **Hard-delete templates.** New `delete_task_template` RPC
     (admin-guarded, returns items_removed + assignments_preserved).
     Delete button in Preview modal footer with confirm copy
     explaining past assignments stay intact. Data safety via the
     FK `ON DELETE SET NULL` on `assigned_tasks.source_template_*`
     shipped in PR #8: past rows keep their copied content; only
     the back-pointers become NULL.
  3. **Batch cancel UI.** New `RecentAssignmentsSection` on the
     Assign page (last 10 template batches). Per-row Cancel →
     `cancel_task_assignment_batch` → cancelled recipients vanish
     from member widgets via `assigned-tasks` cache invalidation.
     Cancelled batches stay in the history (muted) so admins can
     see what they recalled.
  Built on branch `claude/assignment-polish-pr10`. `tsc` clean,
  build 2.87s, dev-verified.
- **Assign-page comprehensive redesign — MERGED (PR #9, `d1c046b`).**
  Full replacement of the legacy `/admin/templates` page (which wrote
  directly to `report_templates`) with a surface built entirely on
  the new `task_templates` system. Card grid + filter bar + four
  modals (Preview / Editor / Duplicate / 3-step Assign wizard) + a
  shared `<MemberMultiSelect />` extracted from the Hub's
  AssignTaskModal so both assign surfaces behave identically.
  1069 → 360 lines on the page itself; 8 new component/query files;
  PRESET_TEMPLATES hardcoded list dropped. User's architectural
  call: REPLACE entirely. `tsc` clean, build 2.55s, dev-verified.
  **Known issue flagged by user:** nested modals share `z-[60]` so
  stacked preview + sub-modal backdrops have overlapping click
  targets — modals can feel "unstable." Fix queued for PR #10
  (elevate sub-modals to `z-[70]`, scope Escape to the topmost
  modal, add breadcrumb eyebrow).
- **Task-assignment Phase 2 backend — MERGED (PR #8, `3a4ade7`).**
  6 new admin-only SECURITY DEFINER RPCs: `update_task_template`,
  `update_task_template_item`, `delete_task_template_item`,
  `duplicate_task_template`, `cancel_task_assignment_batch`,
  `assign_template_preview`. All follow PR #6 conventions
  (is_team_admin guard, structured jsonb returns, search_path
  locked). Companion FK tweak on `assigned_tasks`:
  `source_template_id` + `source_template_item_id` → `ON DELETE
  SET NULL` so template edits can't blow up historical assignments.
  `get_member_assigned_tasks` adds `ar.status = 'active'` filter so
  cancelled batches disappear from member view immediately.
  Verified: each RPC smoke-tested against existing seed data;
  RLS confirmed — 4 Phase 2 RPCs reject non-admin with SQLSTATE
  42501; cross-template injection on preview rejected with 22023;
  FK SET NULL confirmed by deleting a template item that had 2
  assigned tasks referencing it, verifying those rows survive with
  `source_template_item_id = NULL`. Types regenerated, build 2.53s.
  Frontend impl deferred to the Assign-page redesign PR.
- **Task-assignment MVP frontend — MERGED (PR #7, `8821785`).**
  Ships the minimum testable assignment slice per
  `docs/assignment-mvp-handoff.md`. Admin Hub Assign widget gains a
  4th "Custom Task" tile → new `AssignCustomTaskModal` → calls
  `assign_custom_task_to_members` RPC (atomic batch + recipients +
  tasks + notifications). New `AssignedTasksWidget` on both member
  Overview AND the restructured Tasks page (validates multi-page
  placement end-to-end). Notifications widget extended with an
  "ASSIGNMENTS" section below channels — both member + admin
  variants, optimistic mark-read, parallel `postgres_changes`
  realtime subscription on `assignment_notifications` filtered by
  `recipient_id`. Widget-visibility model formalized in
  TypeScript: `accessVisibility` + `dataScope` added to
  `WorkspaceWidgetRegistration`; disjoint `MemberScope` /
  `AdminScope` preserve the admin/member invariant while
  `defaultPlacements` enables same-widget cross-page placement
  within a side. `/daily` restructured from a 3-card hand-composed
  layout into a widget grid (`member_tasks` scope). Mock
  `TeamTasksCard` + `StudioTasksCard` retired (neither was
  DB-backed). `WORKSPACE_LAYOUT_VERSION` bumped 8 → 9. `tsc` clean,
  build clean (3.22s), live verified on dev server.
- **Task-assignment Phase 1 backend — MERGED (`951be5c` / PR #6).**
  2 migrations on live Supabase: (1) 6 tables + 5 enums + 7 indexes + RLS
  via `is_team_admin()`; (2) 11 SECURITY DEFINER RPCs covering template
  library, 3 atomic assign actions (custom / full / partial), member
  read+complete, and notifications. Codex peer-review refinements
  incorporated (`assignment_recipients` renamed to avoid collision with
  existing `task_assignments`; `PreloadedChecklist`-style metadata
  validation for future consumer safety; all writes atomic in a single
  transaction; enums over text fields). Additive — does NOT touch
  `report_templates`, `task_assignments`, or `team_checklist_*`; 2C
  cold-path untouched. Frontend UI deferred to Codex handoff PR. Seed
  data kept on prod for frontend testing (see Known state section in
  `PROJECT_STATE.md`).
- **Phase 1 Step 2C — SHIPPED (`357562c` / PR #5, MERGED).** One
  `member_overview_snapshot(p_user_id, p_date)` RPC replaces the
  four-wave Overview cold-start waterfall. Server derives
  `submission_type` from `team_members.position` (authoritative read
  path per Codex peer-review); client `mustDoConfig.ts` still owns the
  write path. New `PreloadedChecklist` type with metadata validation
  (frequency + date_key + target_user_id) so useChecklist rejects
  mis-wired preloads. **Preview cold-start locked: 470ms / 3
  checkpoints / 7.3ms server-side.** Full Phase 1 Step 2 arc:
  **1,289ms → 470ms = −64% / −819ms** from morning baseline.
- **fix(perf-trace) flush-gate race — DONE (`4e666b9` / PR #4).**
  `lastLoadedProfileId` ref in `MemberOverviewContext.tsx` gates
  flush on a real batch having completed for the current profile.
  Revealed true post-2B cold start: 826ms / 6 honest checkpoints.
  Yesterday's "870ms / 7 checkpoints" reading was an artifact.
- **Phase 1 Step 2B — DONE (`85b7df7` / PR #3).** 3 Supabase
  migrations (pg_cron enable + observability log, materializer
  function, daily schedule at 11:00 UTC) + 1 client change in
  `useChecklist.ts`. pg_cron pre-creates today's rows for all
  active members; client fast-path hits them and skips the RPC.
  `checklist:rpc` no longer fires on cold start — backend-
  prepared state is real. −~170ms.
- **Phase 1 Step 2A' — DONE (`341d2d1` / PR #2).** `handledForUserId`
  ref + `maybeFetchProfile` wrapper in `AuthContext.tsx`.
  `auth:fetchProfile:byId` 2×→1×. Architectural hygiene —
  fetches were parallel so latency was ~stable.
- **Phase 1 Step 2A — DONE (`c719ef2` / PR #1).** Deleted the
  duplicate `chatSupabase` client. Preview cold-start drops
  1,289→998ms, `"Multiple GoTrueClient instances"` warning gone,
  `overview:batch` collapses 427→185ms, `auth:fetchProfile:byId`
  drops from 3× to 2×.
- **Phase 1 Step 1 — DONE.** Production cold-start waterfall
  captured + documented. See "Performance baseline" above.
- `a6e0a83` — perf: gate Overview flush on `profile` so the
  waterfall captures the real data-query pass, not just the
  pre-auth noop. First prod trace only saw `auth:getSession`
  because `MemberOverviewContext.refetch()` early-returns when
  `!profile` and `loading` flipped false before the real queries
  ran.
- `cf39bb6` — perf: satisfy strict TS in production build.
- `28246f7` — **Phase 1 Step 1 — load-perf instrumentation.**
  Tiny opt-in `perfTrace` module; wrapped auth, overview batch,
  streak, and checklist-generation paths. Console emits a single
  grouped waterfall on Overview ready. No prod overhead.
- `473f59a` — Assign template cards: cap preview at 4 tasks + "…"
  overflow indicator at bottom-right. Matches Codex mockup.
- `22d511e` — Template cards match mockup: gold "+ Assign" + pill,
  drop the role label under the row.
- `fb84234` — Uniform card height (h-[290px]) + 2-line title wrap
  so "Artist Development" doesn't truncate.
- `d8eca83` — Seeded 6 mockup templates (Intern / Marketing /
  Artist Development / Audio Engineer / Owner / Studio Assistant)
  into `report_templates`. Edit form now renders as a floating
  modal.
- `51fc4c8` — Shared `FloatingDetailModal` component. Widget title
  click opens it; Assign template preview uses it. Removed all
  "Open X →" bottom navigation links from widgets.
- `2185e8e` — Body-click to expand widget (later replaced by
  title-click modal in 51fc4c8).
- `d084211` — Four polish passes (gold nav pill / row hover-lift /
  56px Booking "1" / gold day-tile gradient).
- `ec4bbda` — Dashboard-shell + widget-card CSS + whole-header
  drag. Body radial-gold-glow background.
- `bfc4480` — Drag-to-reorder widgets (dnd-kit) + Widgets tab in
  Settings (per-scope toggle + mini layout preview).
- `846673b` — Discord-style Notifications widget with real unread
  tracking (chat_channel_reads table + `get_channel_notifications`
  RPC).

### Probably next

- **Once PR #46 merges to main**: the user-sketched Assign-page
  redesign is fully shipped. Strategic priorities shift to **Tier 2
  operational maturity** (clock-in/out, EmailJS reminders, mark-all-
  read) and the **Cloudflare migration**. The Assign-page surface is
  considered done for now; treat further changes as polish requests
  rather than the active project.
- **Polish pass — notification click routing for the 3 task-request types.**
  Currently `task_request_approved` falls through to the existing highlight-task
  handler (harmless but not useful — `batch_id` is null). Target: approved →
  highlight the newly-materialized task via `approved_task_id`; admin's
  `task_request_submitted` click → jump to Hub approval widget. Small PR.
- **Tier 2 operational maturity** (per the strategic check-in):
  - **Clock in/out logging** — table + RPC + small UI. Required for the
    "trackable" north-star outcome; admin needs to see "who's on the clock."
  - **Booking + session reminders via EmailJS** — client confirmation email,
    24h reminder, non-annoying 5-star review ask. Templates + cancel flow.
  - **Mark-all-read** for notifications + bulk actions.
- **Cloudflare migration** queued for once the dust settles.
- **Phase 3 deeper**: flywheel event ledger (the highest-leverage future work),
  daily-checklist fold-in (`source_type='daily_checklist'` is already reserved
  in the enum — cron writes that shape), unify `report_templates` into
  `task_templates`, contract ledger.

### Small stragglers worth knowing about

- **Analytics page empty-state needs a recharts guard.**
  `BarChart` logs warnings about negative width/height when
  rendered with zero-dimension data. Observed on `/admin/health`
  with no chart data. Non-blocking, but the empty state should
  gate the chart rather than let recharts try to render.
- **Local prod build has pre-existing `@dnd-kit/*` module
  resolution errors.** Vercel build environment resolves them
  fine. On Phase 1's "fix local build reliability" list.

### Open action items / stashes

- Two git stashes exist on `main` from earlier in this session:
  `pre-*-merge` entries. Most are parallel Codex edits and are
  likely obsolete now. User can `git stash list` to review.

---

## Environment notes

- Working directory: `/Users/bridges/GITHUB/Dashboard-V3/` (main
  repo) and a worktree at `.claude/worktrees/peaceful-zhukovsky/`.
- Branch `claude/peaceful-zhukovsky` tracks the worktree; `main`
  is fast-forwarded from it and pushed to GitHub → Vercel.
- Preview dev server: `npm run dev` or the `preview_start` tool
  with `dashboard-v3-dev` config. Dev mode CANNOT authenticate
  against Supabase, so widgets that require a session render an
  error state. Real verification happens on Vercel.
- The Supabase project has an inline note in several tables about
  the intern→team rename; compat views still route `intern_*`
  references to `team_*` tables. Do not drop the compat views.

---

## The prompt the user pastes at session start

```
Read docs/SESSION_CONTEXT.md and docs/PROJECT_STATE.md before doing
anything else. Follow the orientation instructions at the top.
```

That's it. Everything else this doc contains.
