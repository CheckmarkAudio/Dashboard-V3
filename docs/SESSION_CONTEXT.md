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

### Change provenance tags

When writing handoff notes, use these tags so future Claude/Codex sessions
can tell what happened where without rereading the whole thread:

- **`CODEX:`** repo/code/documentation changes authored in Codex
- **`CLAUDE:`** repo/code/documentation changes authored in Claude Code (parallel to CODEX:; added 2026-05-01)
- **`MANUAL-SUPABASE:`** SQL or dashboard changes run manually in Supabase
- **`MCP-APPLIED:`** SQL applied to Supabase via Claude's MCP tools (recorded in `migration_history`, unlike `MANUAL-SUPABASE:` which is SQL-Editor-only)
- **`LIVE-VERIFIED:`** confirmed on the live Vercel site by the user
- **`ADVISOR-VERIFIED:`** confirmed via Supabase Security Advisor / `get_advisors` MCP call

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

#### Canonical chrome dimensions (PR #63, measured 2026-04-30 at 1440×900)

Captured here so the next chrome change has hard numbers, not a vibe.

**Two-pane admin pages** — reference: **Settings** (`/admin/settings`).
Used by Settings, Members (`/admin/my-team`), Assign (`/admin/templates`).

```
<div className="max-w-6xl mx-auto animate-fade-in">      // outer
  <div className="mb-6">…<h1 className="text-2xl font-bold">…</h1></div>
  <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-stretch">
    <aside className="bg-surface rounded-xl border border-border p-2 space-y-1">…</aside>
    <section className="bg-surface rounded-xl border border-border p-6 min-h-[320px]
                        min-w-0 overflow-hidden">                 // table-friendly
      …
    </section>
  </div>
</div>
```

- `items-stretch` (NOT `items-start`) so sidebar bottom is flush
  with right-pane bottom even when the rail is short.
- `min-w-0 overflow-hidden` on the right-pane `<section>` whenever it
  holds a wide table — without `min-w-0`, CSS Grid's default
  `min-width: auto` lets the table push the rounded border past the
  grid track and off-screen.
- Measured at 1440 viewport: grid `x=144 right=1296 w=1152`; aside
  `w=280`; right pane `w=848`; gap `24px`.

**Full-width member pages** — reference: **Calendar** (`/calendar`).

```
<div className="max-w-6xl mx-auto animate-fade-in">
  <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 items-stretch">…</div>
</div>
```

Same `max-w-6xl` constraint, slightly wider sidebar (300 vs 280) and
tighter gap (gap-3 vs gap-6).

**Widget-grid surfaces** — reference: **Overview** (`/`). Three
column stacks via `WorkspacePanel` + `DashboardWidgetFrame` per widget;
row-spans `0.5 / 1 / 1.5 / 2 / 3` (340px row × multiplier + 16px gap).

**How to use this:** before claiming a chrome change verified, run the
attached snippet from `feedback_chrome_reference_check.md` to compare
`getBoundingClientRect()` numbers between the changed page and the
canonical reference. The numbers must match. User trigger phrase:
**"reference-check it"**.

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

### Completed emergency track — 2026-05-01 security stabilization

- **`CODEX:`** authored two repo migrations:
  `20260501090000_harden_security_surface.sql` and
  `20260501093000_lock_remaining_intern_views.sql`, plus Vercel
  security headers in `vercel.json`.
- **`MANUAL-SUPABASE:`** user ran the SQL in Supabase project
  `ncljfjdcyswoeitsooty` ("Checkmark Intern Manager") and cleared
  Security Advisor from 6 `Security Definer View` errors to
  **0 errors**.
- **`LIVE-VERIFIED:`** user deployed from `main` to Vercel and
  sanity-checked login, dashboard, leads, clients, bookings, and
  notifications. No obvious security-related regression surfaced.
- Remaining work from this track is follow-up only:
  Supabase Security Advisor still shows warnings (not errors), and a
  non-security `/daily` realtime crash was observed separately.

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

### 2026-05-01 security stabilization handoff

- **`CODEX:`** Generated/appended the following repo-side hardening:
  - `supabase/migrations/20260501090000_harden_security_surface.sql`
  - `supabase/migrations/20260501093000_lock_remaining_intern_views.sql`
  - `vercel.json` security headers (CSP, frame deny, nosniff,
    referrer policy, permissions policy)
  - `src/components/tasks/MyTasksCard.tsx` realtime-channel crash fix
    candidate (separate from the security work; deploy only if desired)
- **`MANUAL-SUPABASE:`** User manually executed SQL in Supabase SQL
  Editor for project `ncljfjdcyswoeitsooty`. First pass removed the
  initial Security Definer View findings; second pass cleared the last
  6 remaining view errors. Result: Security Advisor **Errors = 0**.
- **`LIVE-VERIFIED:`** User pushed/deployed to Vercel from `main`;
  deployment reached `Ready`; sanity check passed on login, dashboard,
  leads, clients, bookings, and notifications.
- **Interpretation for future sessions:** if a later bug appears in
  leads/clients/bookings and smells like permissions, compare against
  the two 2026-05-01 migrations first. If it smells like routing/UI
  crash, do **not** assume the security work caused it — a separate
  realtime subscription bug was observed on `/daily`.

### Tier 3 — Interface tweaks + page-by-page fixes (started 2026-04-30)

User delivered a wide-scope tweaks list + answered the 8 open questions. Plan = 10 Leans in dependency order. **Lean 1 SHIPPED via PR #72.** Lean 2 (theme + gradient) is next.

**Locked decisions** (full answers in `docs/PROJECT_STATE.md` Active section):

1. Login disappeared ~2 days ago; user manually disabled login for previews and suspects entanglement. Lean 1 audits the preview-auto-login env vars + hostname guard.
2. Widget grid → option (a): widgets **locked to their current row**, horizontal swap only.
3. Studio Tasks rooms → single widget with **section dividers** (`Control room` / `Studio A` / `Lobby` / `Studio B`); backend adds a `room` column on `assigned_tasks`.
4. Booking status hover → research Figma + Monday for the smooth pattern; add `cancel_session` / `confirm_session` / `reschedule_session` RPCs if missing.
5. Show-completed default-on → local-date; tasks roll off at midnight; older completions land on a new **Completed Tasks** log page in the Members admin left rail (folded into Lean 10).
6. Gradient → body-level, very subtle, not on cards.
7. Forum presence → online when site open (site-based heartbeat).
8. Assign bulk-delete → top-level bar in the main pane, scoped to the currently-viewed member.

| # | Lean | One-line scope |
|--|--|--|
| 1 | Critical fixes | login back · clock-out modal de-jam · "+ Book a Session" position |
| 2 | Theme & gradient | light-mode tone-down to grey/gold/black + subtle site gradient (incl. pinch of forum violet) |
| 3 | Widget grid containment | **SHIPPED PR #81** — single-row carousel (1/2/3 per page on phone/tablet/desktop), arrow + dot nav, drag-to-swap horizontal only, edge-hold 600ms auto-advance during drag |
| 4 | Calendar polish | click booking → detail modal · notes persist across nav · brighter notes + ♪ bullets |
| 5 | Booking interactions | click booking → detail/edit · hover status → action popover |
| 6 | Tasks tweaks | undo request-to-take · Studio Tasks room dividers (Control room / Studio A / Lobby / Studio B) |
| 7 | Admin Hub rearrangement | drop flywheel + quick assign · MemberHighlights at top · Notifications + Task Requests rs2 · today_calendar in middle |
| 8 | Forum polish | longer · own-messages right-aligned · presence bubbles · Troubleshooting → corner button |
| 9 | Forum media uploads | upload button · image/video preview |
| 10 | Assign page revamp | Select / Select-all / Delete · default-on Show Completed (today) · retire Legacy Assign → Assign Log page (toggle pattern) |

Tier 3 supersedes the prior Tier 2 EmailJS-first sequence; EmailJS + ExportButtons + flywheel ledger remain queued behind Tier 3.

### Just shipped (most recent first)

- **PR #82 — Admin direct-delete for assigned tasks — 2026-05-02 (in flight).** User pivoted off Lean 4 mid-session: "lets first do a assign and tasts polish. we really need to get the edit delete tasts function going asap." Delete was the gap — Edit per-row already exists via the pencil → SingleTaskEditModal → `admin_update_assigned_task` (PR #40). Locked model: **admin direct delete = immediate**; **member-side delete = request-to-delete approval flow** (queued as the next PR; see Member-side request flow note below). **Backend** (`MCP-APPLIED:` migration `admin_delete_assigned_tasks`, captured at `supabase/migrations/20260502120000_admin_delete_assigned_tasks.sql`): `admin_delete_assigned_tasks(p_task_ids uuid[])` returns `{ deleted_count }`. SECURITY DEFINER, admin-guarded via `is_team_admin()`, team-scoped via `team_id = get_my_team_id()`, search_path locked to `public`, EXECUTE locked to `authenticated` only. Single bulk RPC takes uuid[] so per-row (1) and bulk (N) hit the same path — same shape as PR #76's hardened admin write/delete RPCs. Cascade verified before writing: `task_reassign_requests.task_id` → CASCADE; `task_requests.approved_task_id` → SET NULL; no FKs from notifications/batches/recipients to `assigned_tasks`. **No notification side effect** in this RPC — admin direct-delete is the explicit choice; if member-side wants delete, that's the request flow's job. `ADVISOR-VERIFIED:` 0 ERRORS, only the by-design `authenticated_security_definer_function_executable` WARN that every SECURITY DEFINER RPC granted to authenticated triggers (matches the 68-warn baseline shape). **Frontend helper** ([adminTasks.ts](src/lib/queries/adminTasks.ts)): new `adminDeleteAssignedTasks(taskIds: string[])` helper that no-ops on empty array. **UI** ([AssignAdmin.tsx](src/pages/admin/AssignAdmin.tsx)): (1) per-row hover-only Trash icon (rose hover, opacity-0 → opacity-100 group-hover) opens `window.confirm("Delete \"X\"? This can't be undone.")` and fires the mutation; (2) new "Select" toggle button in the top action bar (between Save as Template and Templates ▾, disabled when no member or zero tasks); selecting morphs the top bar to `N selected · Select all/Clear all · Delete · Cancel` with a two-step confirm on Delete — first click flashes the button into rose-filled "Confirm delete N" state with the same shadow as `AdminEditSessionsModal.tsx`'s delete CTA, auto-resets after 4s if no follow-up; (3) selected rows get a rose-tinted bg + ring; (4) bulk select-checkbox renders to the LEFT of the existing complete-toggle so the eye lands on what's checked first; (5) per-row Edit + Trash hide in selectMode so the bulk bar is the one place the admin acts from; (6) per locked-decision #8 the bulk action is scoped to the currently-viewed member only (selectMode + selectedIds reset on member change via `useEffect` keyed on `selectedMember?.id`). On success the mutation invalidates `['assign-page-member-tasks', memberId]` + `['assigned-tasks']` + `['admin-assigned-tasks']` + `['team-assigned-tasks']` + `['studio-assigned-tasks']` so member-side widgets reflect deletes immediately. **Out of scope this PR** (deferred): `/daily` admin Trash on Studio + Team Board task rows — those rows are `<button>` click-toggle with hover-overlay for request-to-take; adding admin Trash there clashes with both interactions and would need its own overlay treatment. Admins can canonically delete via /admin/templates which is the central admin task editor. **Member-side request flow (next PR sketch)**: extend `task_requests.kind` enum to `'create' | 'edit' | 'delete'` (or sibling tables matching the existing one-table-per-type pattern with `task_reassign_requests`); members see "Request edit" + "Request delete" buttons where admins see Edit + Trash; PendingTaskRequestsWidget + ApprovalLogWidget extend to render the new kinds; on approve, fire actual update or delete; on decline, optional note (matches existing pattern). **Verified**: `npm run build` clean (2.74s); /admin/templates renders the new Select button correctly at desktop; only pre-existing Supabase auth errors in dev preview console (no JS errors from this PR). **`CLAUDE:`** authored.
- **PR #81 — Lean 3: widget grid carousel containment — 2026-05-02 (merged `f81ff07`).** Closes the user-reported "widgets slip way down the page" funkiness — the prior 3-column CSS grid let a dragged widget land anywhere in any column, including empty space below other widgets, which collapsed columns to mismatched heights. New model: single-row horizontal carousel with paged navigation. **Page size**: phone (<640px) = 1 widget; tablet (640-1024px) = 2; desktop (≥1024px) = 3 — desktop is visually identical to the prior layout (3 widgets across at 432×696px on the live `member_overview` / `admin_overview` / `member_tasks` scopes). **Navigation**: when widgets exceed page size, ChevronLeft/ChevronRight buttons appear at the row edges (vertically centered, dimmed at boundary) plus a row of page dots below (long gold = current, dim short = others). Both hidden when there's only 1 page. **Drag**: drop on another widget = swap order (cross-page swaps work because the widget DOM stays mounted regardless of which page is visible — cursor coords pick the target). Drop on empty space, edge sensor, or self = no-op (snap back). No vertical drag at all. **Auto-advance during drag**: holding the dragged widget against the row's left or right edge for 600ms pages the carousel in that direction. Re-arms on success → continuous paging during sustained hold. Edge sensors (`edge-left` / `edge-right` droppables, 64px wide gradient overlays) only mount while a drag is active so they don't interfere with normal interactions. **PR #34 invariant preserved**: `onDragEnd` is still the single commit point for layout mutation. `onDragOver` exists but only manages the auto-advance edge timer (via `edgeTimerRef` + `edgeSideRef`) — never mutates widget order. The cascading-swap bug class can't recur. **Data model**: `WorkspaceWidgetState.col` is preserved as a sort hint when migrating older layouts but no longer drives rendering. `swapWidgets(a, b)` exchanges `order` only (and rolls `col` along). `moveWidgetByDropTarget` / `reorderWidgets` / column droppables (`col-N`) all retired — confirmed no callers remain via repo grep. `WORKSPACE_LAYOUT_VERSION` 34 → 35 so any saved 3-column layouts flush to the new flat-row defaults. **User-confirmed scope** (multi-turn convo): option (b) auto-advance over option (a) defer-cross-page; "traditional side scroller" rejected in favor of carousel-with-arrows; mouse drag still the swap mechanism. **Files**: full rewrite of [WorkspacePanel.tsx](src/components/dashboard/WorkspacePanel.tsx) (~410 lines); simplified [useWorkspaceLayout.ts](src/hooks/useWorkspaceLayout.ts) (~135 lines, dropped `moveWidget` / `moveWidgetByDropTarget` / `reorderWidgets`); LAYOUT_VERSION bump in [registry.ts](src/domain/workspaces/registry.ts:562). **Verified at 1440 / 768 / 375**: desktop 3 widgets all 432×696px no nav (1 page); tablet 2 widgets per page across 2 pages with prev disabled / next active / 2 dots; mobile 1 widget per page across 3 pages. Click-Next at tablet translated card 0 from x=25 → x=-694 (off-screen) and card 2 from x=745 → x=25 (visible) — page transition translates correctly. **`tsc --noEmit` clean**. Auto-advance during drag is wired but not headless-testable; user should sanity-check by dragging a widget to a row edge in the Vercel preview. **`CLAUDE:`** authored.
- **Codex blueprint methodology — 2026-05-01 (commit `c79689b` "blueeprint" on main).** New parallel track for stabilizing UI surfaces before visual polish: wireframe-first blueprints. Files added by Codex:
  - `docs/interaction-blueprint-backlog-2026-05-01.md` — priority-ordered backlog of surfaces needing blueprints (Tier 1: `/sessions` booking board, ClientsPanel; Tier 2: Hub widget interactions, Members admin)
  - `docs/route-admin-action-map-2026-05-01.md` — audit of admin action coverage per route
  - `docs/mockups/blueprint-gallery.html` — index of in-progress blueprints
  - `docs/mockups/booking-admin-blueprint.html` — `/sessions` board wireframe
  - `docs/mockups/clients-panel-blueprint.html` — ClientsPanel wireframe
  - `docs/mockups/interaction-blueprint-template.html` — empty template for future blueprints

  Method (per the backlog doc): identify canonical owner page → identify wired backend capabilities → identify hidden vs missing actions → low-fidelity blueprint → user approves placement → implement only after approval. **`CODEX:`** authored.

- **PR #79 — Lean 2: theme + body gradient — 2026-05-01 (merged `243b3c8` at rev17, 17 revisions in flight).** Long iterative pass through user feedback to land the light-mode design system. Final state on main:
  - **Body**: `#dcdcdc` light neutral grey
  - **Cards**: `#ffffff` pure white (high-contrast against grey body, "Helperbird-style" punch)
  - **Borders**: `#1c1c22` black ink (sharp definition)
  - **Gold**: `#f0a623` vibrant marigold (HSL 36° / 87% / 54%) — saturated orange-yellow, not muddy bronze
  - **`text-gold` light-mode override**: `#7a510f` deep amber (HSL 38° / 78% / 27%) — readable on white cards AND on translucent marigold pill backgrounds (`bg-gold/35` etc.)
  - **Tailwind accent shades remap in light mode**: `text-violet-300/400` → violet-700, `text-sky-300/400` → sky-700, `text-emerald-200/300/400` → emerald-700/800, `text-rose-200/300/400` → rose-700/800, `text-amber-200/300/400` → amber-700/800, `text-red-300/400` → red-700, `text-cyan-300/400` → cyan-700, `text-fuchsia-300/400` → fuchsia-700. Specificity-(0,2,0) override scoped to `:root[data-theme='light']`. Sets the legibility standard for any future component using these accent classes.
  - **NotificationsPanel translucent bgs**: bumped `/15 → /35` for forum (violet) / task (gold) / booking (sky) category badges + the "N New" pulse pill. Calendar booking blocks (rev10) at `/35` are the saturation benchmark.
  - **MemberHighlights**: horizontal name pills (avatar 36px circle + first name + thin black border) on the left side, justified right are 3 borderless social-stat blocks (40px filled black tile + bold count, no platform label).
  - **Calendar booking blocks**: `bg-gold/8` / `border-gold/20` / `hover:bg-gold/12` → `/35` / `/70` / `/50` so client appointments pop at a glance.
  - **Locked decision #6 honored**: all gradients body/shell-level only; cards verified flat via DOM (`backgroundImage: none`).

  **`CLAUDE:`** authored. Branch `claude/lean2-theme-gradient` carries an unmerged commit `337e7a5` "rev18 darken light-mode chrome" — experimental dark-chrome inversion (widgets/header/menu dark grey + white text). User requested at session-end but didn't visually validate; treat as exploratory until they express interest.
- **PR #78 — Lean 7: admin Hub cleanup — 2026-05-01 (merged `f9e5de8`).** "Dashboard cleanup" pass per the locked Tier 3 plan. (1) Dropped `admin_quick_assign` + `admin_flywheel` from `admin_overview` placements (kept registered with empty `defaultPlacements` so saved layouts sanitize cleanly via the layout-version bump). Quick Assign duplicated the dedicated Assign page; Flywheel read decorative without the event ledger backing it. (2) `admin_task_requests` col 1 rs1 → rs2; `admin_notifications` col 3 rs1 → rs2 — both now anchor their columns at full height. (3) New `admin_today_calendar` widget (col 2 rs2) reusing the existing `TodayCalendarWidget` component (`CalendarDayCard` wrapper); separate AdminWidgetId keeps the disjoint Member/Admin invariant intact. (4) `MemberHighlights` rendered between the Hub PageHeader and the WorkspacePanel — same component the member Overview uses (PR #61). `WORKSPACE_LAYOUT_VERSION` 32 → 33 so saved Hub layouts pick up the new defaults. Smoke-verified in dev preview at 1440×900: Task Requests / Today / Notifications all top-aligned at y=276; Team at y=988 (rs2 stacking math confirmed); no Quick Assign / Flywheel anywhere. **`CLAUDE:`** authored.
- **PR #77 — Docs catch-up for PRs #73-#76 + Tier 1 audit — 2026-05-01 (merged `ca89128`).** Pure docs pass. Updated PROJECT_STATE.md Snapshot table (latest commit, currently active, prior active rows + new Security advisor baseline row), extended SESSION_CONTEXT.md provenance tag convention (`CLAUDE:`, `MCP-APPLIED:`, `ADVISOR-VERIFIED:` parallel to Codex's tags), added "Just shipped" entries for PRs #73-#76 + Tier 1 audit, created `docs/security/README.md` orienting future sessions. **`CLAUDE:`** authored.
- **PR #76 — Tier 1 audit follow-up: team-scope 3 admin write/delete RPCs — 2026-05-01 (merged `09a4f45`).** Closes the only finding from the Tier 1 SECURITY DEFINER RPC audit. Three functions (`admin_delete_session`, `admin_update_session`, `admin_update_assigned_task`) keyed their SELECT-FOR-UPDATE / DELETE / UPDATE on row id alone — no `team_id` predicate. Not exploitable today (single-tenant, every row already belongs to the one team), but a real cross-team write surface the moment multi-tenant lands. Fix: add `v_team uuid := public.get_my_team_id();` declaration + 6 `AND team_id = v_team` predicates (3 functions × 2 statements each). All other guards preserved verbatim — `is_team_admin()` reject, `auth.uid() IS NULL` reject, `SET search_path TO 'public'`, `SECURITY DEFINER`, every notification side effect (`session_reassigned` on cancel, `session_reassigned` on reassign, `task_edited` on task update). **`MCP-APPLIED:`** via `apply_migration` (recorded in `migration_history` as `team_scope_admin_writes`); **`ADVISOR-VERIFIED:`** 0 ERRORS, no new warnings introduced. **`CLAUDE:`** authored.
- **Tier 1 SECURITY DEFINER RPC audit — 2026-05-01 (no PR; research output in chat).** Audited the 15 Tier 1 functions Codex flagged in `docs/security/security-warning-shortlist-2026-05-01.md`: `owner_reset_member_password`, `owner_set_member_role`, all 6 `admin_*` write/read RPCs, the `admin_recent_*` log RPCs, and the 5 client RPCs. **Findings:** 12 functions safe-as-is (well-guarded for single-tenant), 3 functions with future-proofing gap (closed by PR #76 above), 0 high-priority fixes. Notes in chat covered each function's: sensitive data, current guard pattern, authenticated-EXECUTE acceptability, tightening worth making, regression risk. Two items deferred for product decision: `admin_recent_approvals` OR-scope (single-tenant safe), and `get_clients` / `search_clients` admin-tier requirement (engineers + marketing may legitimately need read access). **`CLAUDE:`** read-only research.
- **PR #75 — Delete VITE_DEMO_MODE bypass + production smoke test + drift-audit auth-bypass extension — 2026-05-01 (merged `b261b4a`).** Closes the regression class behind PR #72's "login page is gone" incident. Three pieces: (1) `VITE_DEMO_MODE` env-gated bypass deleted from `ProtectedRoute.tsx`, `AuthContext.tsx`, `supabase.ts` — now build-time `import.meta.env.DEV` only, can never mount on a deployed site. (2) `.github/workflows/production-smoke-test.yml` runs on push-to-main + daily 13:00 UTC + manual dispatch; curls live URL, asserts no `'Dev Admin'` / `'VITE_DEMO_MODE'` strings in production bundle, `/login` returns 200. (3) `/drift-audit` slash command extended with new "Auth bypass surface (REGRESSION GUARD)" section: greps for `return <>{children}</>`, `import.meta.env.X === 'true'`, hardcoded mock-user identifiers. **`CLAUDE:`** authored.
- **PR #74 — Tighten chat_channels + chat_messages RLS — 2026-05-01 (merged `6535226`).** Closes the two `rls_policy_always_true` advisor warnings that left chat surface open to anon-key writes + authenticated impersonation. Replaces the 4 wide-open PUBLIC-role policies with 6 auth-scoped policies: chat_channels SELECT for active team members, INSERT/UPDATE/DELETE admin-only via `is_team_admin()`; chat_messages SELECT for active team members, INSERT requires `sender_id = auth.uid()::text` (impersonation guard) + active team membership. UPDATE/DELETE on chat_messages intentionally NOT added — app doesn't expose edit/delete and we don't want untested RLS surface. **`MCP-APPLIED:`** as migration `chat_rls_tighten`. **`ADVISOR-VERIFIED:`** both `rls_policy_always_true` warnings cleared. **`CLAUDE:`** authored.
- **PR #73 — Drift detective system — 2026-05-01 (merged `fbb5977`).** User asked Claude to "be a detective" — proactively monitor + prevent drift across docs, code, schema, branches, and PRs. Three-layer system installed at `.claude/`: (1) `SessionStart` hook `check-drift.sh` runs 4 checks every session start (docs vs main, branch behind main, open PRs CONFLICTING, supabase types vs newest migration); (2) `PreToolUse` Bash hook `pre-commit-docs-guard.sh` warns before `git commit` that stages `src/**` or `supabase/**` without touching `docs/PROJECT_STATE.md` or `docs/SESSION_CONTEXT.md`; (3) `/drift-audit` slash command for on-demand 8-check deep audit (extended in PR #75 with auth-bypass section). New memory `feedback_drift_detective_mode.md` captures the discipline; "be a detective" is the trigger phrase. **`CLAUDE:`** authored.
- **PR #72 — Lean 1: login back · clock-out modal de-jam · "+ Book a Session" vertical center — 2026-04-30 (merged `ab3c340`).** Three critical-fix items in one PR.
  - **(1) Auth bypass hardened on TWO sites.** `ProtectedRoute.tsx` was the obvious one — added `isProductionAlias()` helper + AND-guard so the `import.meta.env.DEV || VITE_DEMO_MODE === 'true'` bypass refuses to mount when `window.location.hostname === 'dashboard-v3-dusky.vercel.app'`. After user reported incognito on prod still showed no login page, found the SECOND bypass: `AuthContext.tsx` `DevAuthProvider` was hard-coding a fake "Dev Admin" user under the same env check, mounted at the provider level so `ProtectedRoute` never even saw real auth. Same hostname guard applied. Defense-in-depth: even if Vercel still has `VITE_DEMO_MODE=true` baked into a stale build, production hostname refuses to bypass regardless of any env var or any stale build. Local dev (`hostname=localhost`) still mounts Dev Admin mock — verified.
  - **(2) `SelfReportModal` portaled to `document.body`.** Modal was rendering inside `<header className="backdrop-blur-md">` in `Layout.tsx`. CSS spec quirk: `backdrop-filter` creates a containing block for `position: fixed` descendants → re-anchored modal to the header (top of page) instead of the viewport. Symptom: "modal jammed at the top of the website with first half cut off". Fix: `import { createPortal }` + render at `document.body` so fixed positioning is viewport-relative again. Same fix the `NotificationsBell` dropdown uses.
  - **(3) `PageHeader` outer flex `items-start` → `items-center`.** Action button now vertically centers with the title block instead of top-aligning with the icon chip. Verified: "Book a Session" centerY=176 matches h1 centerY=176, offset=0px on `/sessions`.
  - User action item post-merge: trigger fresh production redeploy on Vercel so new bytes serve; consider removing `VITE_DEMO_MODE=true` from Production env scope as hygiene (code is hardened either way).
- **PR #71 — Capture Tier 3 plan in docs (no code) — 2026-04-30 (in flight).** User delivered a wide-scope UI tweaks list right before stepping away. Captured the raw list verbatim + a 10-Lean plan + 8 open questions in PROJECT_STATE.md Active section so nothing is lost between sessions. Tier 3 supersedes Tier 2 (EmailJS pushed back). User will answer the open questions on return; another doc pass at that point will lock the plan and kick off Lean 1.
- **PR #70 — Retire `New` + `Required` row tags sitewide — 2026-04-30 (merged `8c01316`).** User: "remove all of the red new tags and required tags... we will implement an urgency mechanic but for now i want it all gone free from distraction." Removed display tags from MyTasksCard, AssignedTaskBoards, TaskDetailModal, AdminEditTasksModal, AddFromTemplateModal preview, TemplateAssignFlowModal preview, TemplatePreviewModal, TemplateEditorModal item list. Also dropped the `Priority` chip from PendingTaskRequestsWidget. Author-facing toggle labels stay (active edit controls, not passive tags). The `isNew` flag itself stays — drives the gold-tinted row background as a subtler signal of freshness.
- **PR #69 — Task row metadata = role + first-name + last-initial + due-date; retire stage pills; add Self/Assigned filter on My Tasks — 2026-04-30 (merged `b0bab20`).** New helpers in `tasks/shared.tsx`: `formatShortName`, `rolePositionFor` (maps `team_members.position` to lowercase short tags; owner returns null), `isSelfAssigned`, `<SourceFilterRow>`. My Tasks now reads as `[role] · First L.` plain text with a gold `DUE` column header. Stage pill row removed (deferred to flywheel-event-ledger PR — not archived).
- **PR #68 — Restore Notifications widget on Overview + Hub with shared sleek panel + Post/Channel quick-actions — 2026-04-30 (merged `4a69dbb`).** User asked for the dedicated Notifications widget back on Overview (same dimensions as My Tasks + Calendar) with the new sleek look; also wanted the Post quick-action available on BOTH the Overview widget and the Admin Hub widget so anyone can quick-post from their dashboard. (1) `forum_notifications` placement restored to `member_overview` col 3 rs2 (w=432 h=696, flush with cols 1–2). Top-bar dropdown bell stays — both surfaces coexist. (2) `AdminNotificationsWidget` refactored to render the shared `<NotificationsPanel />`; ~270 lines of inline channel/assignment row + duplicate RPC helpers retired. (3) New shared `<NotificationsPostActions />` (`src/components/notifications/NotificationsPostActions.tsx`) owns the Post + Channel buttons + their two modals (moved out of `adminHubWidgets.tsx`); renders ABOVE the panel on both widgets. Channel-list query dedupes off the same `['overview-notifications']` cache key. `WORKSPACE_LAYOUT_VERSION` 31 → 32.
- **PR #67 — Notifications bell to rightmost slot, drop redundant sign-out button — 2026-04-30 (merged just prior).** Two-line layout cleanup. `<NotificationsBell />` moved from between `<SocialLinks />` and the theme toggle to the FINAL slot of the right cluster (after the avatar). The standalone `LogOut`-icon Sign out button removed entirely — the `SelfReportModal` already has a Log Out path that fires both `clock_out` AND `signOut`, so the dedicated icon was redundant. `LogOut` import dropped. Verified at 1440: bell `rightEdge=1389`; dropdown anchors flush right (`right=1383, x=1023, w=360`).
- **PR #66 — Buttery-smooth notifications dropdown — 2026-04-30 (merged just prior).** Polish pass on the dropdown PR #65 introduced. User asked me to look at how Figma does notifications to make it feel "buttery smooth" — researched Figma / Linear / Vercel patterns and translated to concrete CSS. (1) Open transition: `opacity 0→1`, `scale(0.96) translateY(-4px) → scale(1) translateY(0)`, 180ms `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo); `transformOrigin: top right`. Two-frame `entered` state defers the to-state class one rAF so the browser actually animates from the from-state. (2) Frosted backdrop (`bg-surface/95 backdrop-blur-xl`) + layered three-stop shadow (`0_1px_2px_18% / 0_8px_24px_32% / 0_16px_48px_40%`). (3) Row interactions: `transition-[background-color,border-color,transform] duration-150 ease-out` (was `transition-all`, sluggish), `active:scale-[0.995]` tactile press. (4) `scroll-smooth` on body + autofocus on open. Verified byte-level: from/to states + transition declaration + 360×147 settled box + frosted blur + layered shadow + auto-focus all match.
- **PR #65 — Overview header glow-up — beveled MemberHighlights, standardized gold CTA, social icons, notifications dropdown bell — 2026-04-30 (merged just prior).** Five user-spec items in one PR. (1) `MemberHighlights` bubbles: `gap-3` → `gap-5` and a beveled gold pill ring (multi-stop gradient + hairline + inset highlight + soft glow; hover deepens). (2) Standardized gold CTA shape (`h-10 px-4 rounded-2xl` + `shadow-[0_6px_14px_rgba(214,170,55,0.18)]`) across Overview Book a Session, Sessions Book/Add Client, and Layout Clock In — replaces the way-too-feathery `0_14px_28px_22%`. (3) IG / TikTok (custom inline SVG) / YouTube link strip in the global top bar (`SocialLinks.tsx`) — frontend-only stubs, hrefs blank until backend wire-up. (4) `NotificationsPanel` extracted from the old `ForumNotificationsWidget` so the new top-bar dropdown bell and the (now-unplaced) widget share one body; new category badges (forum=violet MessageSquare, task=gold ClipboardList, booking=sky Calendar) on each row. (5) `NotificationsBell` lives in the Layout top bar — click opens a 360px portal-anchored dropdown that stays open until X / Escape / outside-click (per user spec — does NOT close on row click). `forum_notifications` removed from `member_overview` placements; Overview is now a focused 2-col layout (My Tasks + Calendar). `WORKSPACE_LAYOUT_VERSION` 30 → 31.
- **PR #64 — Retire Clients top-nav, fold into Bookings/Clients toggle on `/sessions` — 2026-04-30 (merged just prior).** User flagged the standalone Clients menu (PR #51) as drift — clients belonged with bookings, not as a separate top-nav entry. Deleted the nav link, the `/admin/clients` route, the `APP_ROUTES.admin.clients` constant, and the `ClientsAdmin.tsx` page itself. Extracted a self-contained `src/components/clients/ClientsPanel.tsx` (search + active/archived toggle + clients table + editor modal — same chrome as before, no PageHeader so the parent page owns the header) with a `registerAddClient` callback so the parent's "+ Add Client" header button can fire the panel's editor without prop drilling. Refactored `src/pages/Sessions.tsx` with a `view: 'bookings' | 'clients'` state driven by URL hash (`#clients` deep-links to the Clients tab). Page header dynamic: title stays "Booking" but the action button swaps "Book a Session" ↔ "Add Client", and the bookings-only category pills (All / Engineer / Consult / Trailing / Music Lesson / Education) hide when Clients is active. Reference-checked at 1440×900: both views have identical outer chrome `max-w-6xl mx-auto` x=144 right=1296 w=1152 — flush with Settings/Members/Calendar.
- **PR #63 — Chrome consistency fixes — Members section overflow + Members & Assign sidebar bottom-flush — 2026-04-30 (merged just prior).** Recurring chrome bugs flagged by the user. (1) Members right-pane `<section>` got `min-w-0 overflow-hidden` so the rounded border stays inside the `max-w-6xl` grid track even when the 8-column member table loads — CSS Grid's default `min-width: auto` on `1fr` tracks was the root cause. (2) Both AssignAdmin and TeamManager grids switched `items-start` → `items-stretch`; the Assign aside also lost `h-fit sticky top-4`. Sidebars now grow to match their right-pane heights (Assign: 552/552 flush; Members: 612/612 flush, mirroring `/calendar`'s `grid-cols-[300px_1fr] gap-3 items-stretch`). User explicitly asked for Members stretch even with only 2 rail items today (more sections coming). **Canonical chrome dimensions captured** in `feedback_chrome_reference_check.md` AND in the "Canonical chrome dimensions" subsection of this doc — at 1440×900 the two-pane admin grid is `x=144 right=1296 w=1152`, aside `w=280`, right pane `w=848`, gap `24px`. New process memory: verify chrome via `getBoundingClientRect()` numbers vs the canonical reference BEFORE claiming verified. User trigger phrase: "reference-check it".
- **PR #62 — Members > Clock Data shift history table — 2026-04-30 (merged just prior).** Closes the loop on PR #50 by populating the Clock Data left-rail slot PR #58 reserved. New SECURITY DEFINER RPC `admin_list_clock_entries(p_member_id?, p_limit?)` returning `{entry_id, member_id, member_name, clocked_in_at, clocked_out_at, duration_minutes, notes}`; admin-guarded via `is_team_admin()`, team-scoped, capped at 500 rows. Migration `20260430000000_admin_list_clock_entries.sql` applied to staging — only the standard SECURITY DEFINER advisor warnings (same shape as PR #50's RPCs). New `fetchAdminClockEntries(memberId?, limit?)` helper + `timeClockKeys.adminEntries(memberId)` cache key. New `ClockDataSection.tsx` renders inside the existing left-rail layout: "Shift history" h2 + Clock icon + "All members" filter `<Select>` + table (member linked to `/profile/{id}`, clocked-in, clocked-out / "ON SHIFT" emerald pill, `Hh Mm` duration, line-clamp-2 notes). Empty / loading / error states match the existing admin chrome.
- **PR #61 — Overview UI refresh — 2026-04-29 (merged just prior).** Four UI changes the user asked for after running the merged PRs in preview. (1) Booking moved off the Overview grid: `booking_snapshot` widget de-placed (kept in registry, no `member_overview` placement) and replaced with a "+ Book a Session" primary button in the Overview page-header `actions` slot. The button opens the same canonical `CreateBookingModal`; refetch wiring for `MemberOverviewContext` preserved by wrapping the button inside the provider. (2) Notifications widget elongated: `forum_notifications` rowSpan 1.5 → 2 so col 3 height matches My Tasks (col 1) + Calendar (col 2). (3) New `MemberHighlights` component (`src/components/members/MemberHighlights.tsx`) — Instagram-story-style horizontal scroll row of circular member avatars (60px circle, gold gradient ring, first-name label), positioned between the page header and the workspace grid. Reads `team_members.status = 'active'` via `fetchTeamMembers`; each tile is a React Router `<Link>` to `/profile/{id}` honoring the user-entities-clickable rule. Initials fallback when `avatar_url` is null. (4) MyTasksCard no longer renders `task.description` inline under the title — the description is reserved for the expanded `TaskDetailModal` (clicking the row body), so rows stay compact and "notes belong only in the expanded view". Other task surfaces (Studio Tasks, Team Board) already had no inline description, so no change there. `WORKSPACE_LAYOUT_VERSION` 29 → 30 so saved Overview layouts shed `booking_snapshot` and pick up the new Notifications rowSpan.
- **PR #50 — Persist Clock In/Out + 'On the Clock' Hub widget — 2026-04-29 (merged just prior).** First Tier 2 slice, originally drafted 2026-04-29 morning then rebased on top of PRs #58/#59/#60 before merge. Backend: new `time_clock_entries` table (one open shift per user, partial unique index) + 4 SECURITY DEFINER RPCs (`clock_in()` idempotent, `clock_out(p_notes)`, `get_my_open_clock_entry()`, `admin_currently_clocked_in()`); migration `20260429000000_time_clock_entries.sql` applied to staging, advisors clean. Frontend: header Clock button now React-Query-backed (cache key `['my-open-clock-entry']`) so clock-out in one tab updates the others; SelfReportModal Close + Log Out paths fire `clock_out` alongside existing behavior. New `AdminClockInWidget` ("On the Clock") on admin Hub col 3 below Team (rowSpan 0.5) with live elapsed counter (ticks every minute, refetches every 60s). New `src/lib/queries/timeClock.ts` with the 4 RPC wrappers. `WORKSPACE_LAYOUT_VERSION` 28 → 29 so saved Hub layouts pick up the new col-3 widget. Followup queued: populate Members > Clock Data pane (PR #58 reserved) with shift history table — this PR ships only the live "currently clocked in" view, not historical shifts.
- **PR #58 — Members admin left-rail restructure — 2026-04-29 (merged just prior).** Extracted `SectionNavItem` from AdminSettings into a reusable shared `AdminSectionNavItem` (`src/components/admin/AdminSectionNavItem.tsx`) generic over section-key type. AdminSettings now imports the shared component (~30 lines of duplicate code deleted). TeamManager (`/admin/my-team`) restructured: standard `<h1>Members</h1>` + count badge + Add Member button (no subtitle per PR #60), two-pane grid below — left rail with **Roster** (default, current toolbar + filter pills + 8-column table) and **Clock Data** (placeholder section with "coming soon" empty state). Stripped inner `widget-card` chrome from the table since it was double-boxing against the new right-pane card. Sets up the shell that PR #50 (Clock In/Out v2) drops Clock Data content into.
- **PR #60 — Remove all page-header subtitles — 2026-04-29 (merged just prior).** User asked for a "modern, simple, sleek" pass on the title pages. Removed the descriptive subtext under every page's `<h1>` — 11 PageHeader callers got their `subtitle` prop deleted (Hub · Templates · TeamManager · TemplateLibrary · ClientsAdmin · Sessions · DailyNotes · Dashboard · DailyChecklist · Pipeline · Leads); 4 inline `<p className="text-text-muted mt-1">` page-header subtitles deleted (AdminSettings · AssignAdmin · Reviews · Schedule). PageHeader component itself untouched — subtitle prop still supported for any future use. Login subtitle preserved (helps unauthenticated users orient).
- **PR #59 — Assign right-pane top alignment — 2026-04-29 (merged just prior).** PR #57 fixed the page-header rhythm but the right pane's top edge still floated below the sidebar's Members card because the toolbar row (Settings for Tasks · Save as Template · Templates ▾) lived above the main card. Folded the toolbar INSIDE the main card with a hairline divider, wrapped main in `rounded-xl border border-border bg-surface p-5`, switched sidebar + main from `rounded-2xl` to `rounded-xl`, `gap-4` → `gap-6`, added `items-start` on the grid. Both panes now start at the same Y, exactly mirroring Settings.
- **PR #57 — Assign page header alignment — 2026-04-29 (merged `ad76452`).** AssignAdmin was missing the `<h1>` + subtitle block every other admin page (Settings) opens with — sidebar/main-content cards sat higher and read as misaligned. Added `<h1>Assign</h1>` + "Assign tasks to your team members" subtitle + `mb-6`, mirroring [AdminSettings.tsx:163-166](src/pages/admin/AdminSettings.tsx:163) exactly.
- **PR #56 — Full-page Templates manager — 2026-04-29 (merged `27799b3`).** New page at `/admin/template-library` (471-line `TemplateLibrary.tsx`) extracts the templates UI from the Assign sidebar into a dedicated full-page surface — same role-tag filter pills, search, archive toggle, friendly per-role thumbnails as the inline widget but with breathing room. Routes added; AssignAdmin sidebar's "Templates" link routes here. Onboarding corner badge removed from thumbnails (legacy widget kept consistent so visual language doesn't fork).
- **PR #55 — React Router Link in sidebar — 2026-04-29 (merged `97e4eea`).** Sidebar's "Templates" + "Legacy Assign" entries were `<a href>` — full-page reload dropped React Query cache. Switched to `<Link>` so navigation stays SPA.
- **PR #54 — Isolate legacy widget Assign view — 2026-04-29 (merged `5c3fc06`).** Old widget-grid Assign (Task Requests · Approval Log · Edit · Assign · Assign Log · Templates) moved from `/admin/templates` to `/admin/assign-classic`. `/admin/templates` exclusively renders the new member-centric editor. Sidebar got a "Legacy Assign — old widget-grid view" entry routing to the classic page.
- **PR #53 — Checkbox flicker fix + template preview-before-apply — 2026-04-29 (merged `a7c223f`).** Bug: clicking one checkbox flashed every other in the list yellow because parent re-renders created brand-new arrow callbacks, defeating React.memo on TaskRow. Fix: `useCallback` for `onToggle`/`onEdit` so memoized rows skip re-renders. New preview-before-apply step on Apply Template — review items in a modal, uncheck unwanted ones, then apply.
- **PR #52 — New Assign page visual scaffold — 2026-04-29 (merged `5a7c2a6`, started as draft).** Mockup of the boss-sketched member-centric Assign page: left rail with members + Templates link + Legacy shortcut; main pane with top-bar pill buttons (Settings for Tasks · Save as Template · Templates dropdown) + "All Tasks for {member}" row-by-row editor. Two follow-up commits in the same PR (`1de2246` wire to real task data via existing RPCs; `3ac44ad` promote to canonical replacing the widget-grid Assign). The widget-grid version was preserved at `/admin/assign-classic` (per PR #54).
- **PR #51 — Clients table + admin page + booking-modal picker — 2026-04-29 (merged `a17d4c9`).** New `clients` table (name, email, phone, notes, archived). New `/admin/clients` admin page for managing the client list. Booking modal gained a clients dropdown + empty-state hint linking to the admin page. Foundation for Tier 2 EmailJS booking confirmations + reminders that need a real `clients` row to email.
- **PR #49 — Add Member email-setup flow + unified TeamManager — 2026-04-29 (merged `f297884`).** Owner-only "Add Member" button on Members admin opens a modal that creates the auth user + `team_members` row + sends a Supabase password-reset email so the new hire sets their own password (matches Bridget onboarding pattern). Built on top of existing `admin-create-member` edge function. Members admin previously two surfaces (read-only roster + separate TeamManager) — merged into one table-styled `TeamManager`. Top-nav Members link repointed at TeamManager.
- **PR #48 — Mark-all-read for notifications — 2026-04-29 (merged `2fd6603`).** First Tier 2 slice. Backend + UI wired in one PR. First Tier 2 slice (the easiest of the three). Backend + UI wired in one PR.
  - **Backend** (migration `20260426000000_mark_all_read_rpcs.sql`, applied to staging): two SECURITY DEFINER RPCs — `mark_all_channels_read()` upserts a `chat_channel_reads` row per channel for `auth.uid()` returning `{ success, channels_marked }`; `mark_all_assignment_notifications_read()` bulk-UPDATEs `assignment_notifications` WHERE `recipient_id = auth.uid() AND is_read = false` returning `{ success, notifications_marked }`. Both reject anonymous callers (28000) and lock `search_path = 'public'`. Supabase advisors clean (no new warnings caused by these RPCs).
  - **JS query helpers**: `markAllAssignmentNotificationsRead` added to `src/lib/queries/assignments.ts` (sibling of the existing `markAssignmentNotificationRead`). `markAllChannelsRead` co-located inline in each widget file (`memberOverviewWidgets.tsx` + `adminHubWidgets.tsx`) — mirrors the existing `markChannelRead` pattern. Refactor to a shared module deferred since the inline duplicate is small and matches the existing convention.
  - **UI**: new "Mark all read" button (CheckCheck icon + bold label) in the eyebrow row of `ForumNotificationsWidget` (member Overview) and `AdminNotificationsWidget` (admin Hub), beside the rose unread pill. Hidden when `totalUnread === 0`. Click fires both RPCs in parallel via `Promise.all`, optimistically sets every channel's `unread_count = 0` and every assignment's `is_read = true` in cache (`['overview-notifications']` + `['overview-assignment-notifications', userId]`). On any error, both query keys invalidate so server-truth flows back.
  - User confirmed Option A (one button per widget that clears both sections) over Option B (two buttons, one per section). Final scope follows that.
  - Verified: `tsc --noEmit` clean, `npm run build` 2.75s, migration applied to staging without advisor warnings caused by the new RPCs.
- **PR #47 — Assign-page + Overview-page default widget orders updated — 2026-04-25 evening (merged `7d9a5a0`).** Pure visual cleanup, three revs.
  - **rev1**: User asked for the Assign widget (col 2 top, was rs 1) to match the Edit widget's compact height (col 1 middle, rs 0.5) so they read as a consistent twin-button pair. `AdminAssignWidget` rowSpan: 1 → 0.5; `AssignTile` body collapsed from a large icon-with-hint card to a twin-button row (icon + label inline) matching `EditButton` exactly.
  - **rev2**: User dragged the Assign-page widgets into a layout they liked and asked for it to be the new default. Updated placements: col 1 = `admin_assign_log` (top) → `admin_approval_log`; col 2 = `admin_assign` (rs0.5) → `admin_edit_tasks` (rs0.5) → `admin_task_requests`; col 3 = `admin_templates` (rs2 unchanged). Reordered `ADMIN_WIDGET_REGISTRATIONS` array so within-column order resolves: `admin_assign_log` registered ahead of `admin_approval_log`; `admin_edit_tasks` registered ahead of `admin_task_requests`. Hub overview placements unchanged (`admin_task_requests` still stacks under `admin_quick_assign` in col 1 of `admin_overview`).
  - **rev3**: Same pattern, Overview page. User asked to lengthen My Tasks to match Calendar and shrink Notifications "so they all fit good together". Updated placements: `team_tasks` member_overview rowSpan 1 → 2 (matches Calendar height); `booking_snapshot` col 2 → col 3 (top, rs0.5 unchanged); `today_calendar` stays col 2 rs2 (now fills col 2 alone); `forum_notifications` rs2 → rs1 so col 3 (Booking 170px + gap + Notifications 340px ≈ 526px) reads as a balanced stack vs the rs2 widgets in cols 1-2 (~696px each). The Tasks-page (`/daily`) `team_tasks` placement at rs2 was already correct and was unchanged.
  - **rev4**: User asked to extend Notifications to fill the empty space below it in col 3. Math: cols 1-2 are 696px (rs2). With Booking rs0.5 (170) + gap (16), Notifications needs ~510px to flush. None of the existing rs (0.5/1/2/3) gives that, so added `1.5` to `WidgetRowSpan` union (rs1.5 = 1.5 × 340 + 0.5 × 16 = 518px). Bumped `forum_notifications` Overview rs1 → rs1.5; col 3 now = 170 + 16 + 518 = 704px (8px taller than cols 1-2 — visually flush). Confirmed via dev DOM inspection: My Tasks 696, Calendar 696, Booking 170, Notifications 518.
  - `WORKSPACE_LAYOUT_VERSION` 24 → 28 (rev1 → 25, rev2 → 26, rev3 → 27, rev4 → 28).
  - No DB / RPC changes (one tiny additive type-union change in rev4). Verified each rev: `tsc --noEmit` clean, `npm run build` clean, dev preview confirms widget placement + heights.
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

- **Assign-page redesign is the active priority** (per `project_assign_redesign_priority.md` memory). The page got rebuilt-from-scratch in PRs #52–#57 around the boss's member-centric sketch (left rail of members + per-member task editor on the right). What's next on this redesign:
  - The boss-sketched **Save as Template** + **Settings for Tasks** top-bar buttons are currently visual stubs — both need real implementations.
  - User has answers queued from a prior session (the API errored on images right at the end of the last conversation) about specific design decisions on this page; revisit those before doing more visual work.
- **Tier 2 operational maturity is paused** while the Assign redesign stabilizes:
  - PR #50 (Clock In/Out persistence + Hub widget) is on a branch but NOT merged. Pick back up after Assign settles.
  - **Booking + session reminders via EmailJS** — needs the `clients` table from PR #51 (already shipped), so backend-ready. Templates + cancel flow.
- **Cloudflare migration** queued for once the dust settles.
- **Phase 3 deeper** (post-Tier 2): flywheel event ledger (highest-leverage future work), daily-checklist fold-in (`source_type='daily_checklist'` reserved in the enum — cron writes that shape), unify `report_templates` into `task_templates`, contract ledger.
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
- GitHub Desktop / worktree gotcha (hit on 2026-05-01): Desktop may
  be opened on a Claude worktree branch such as `claude/dreamy-buck`
  while the real shipping changes live on `/Users/bridges/GITHUB/Dashboard-V3`
  checked out to `main`. If Desktop says `fatal: 'main' is already
  used by worktree`, do **not** force-switch branches inside that
  worktree window; open the real local repository path directly.
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
