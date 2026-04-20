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

### TODO — gaps the user hasn't filled in yet

<!-- Ask about these when naturally relevant; don't batch-interrogate. -->

1. **Success metric**: what does "the app is working" look like in
   three months? Daily team usage? KPIs rising? Fewer
   bug-reports-per-week? (User hasn't explicitly defined this.)
2. **Priority roadmap beyond the UI refresh**: after Overview + Hub
   + Assign land, what matters most? Real flywheel event ledger?
   Member onboarding? Analytics depth? DB-backed theme/layout sync?
3. **Studio pain points this is replacing**: what was the team
   using before? What would definitely-be-worse if we got this
   wrong?
4. **Business vision**: is this app only for Checkmark Audio, or
   could it become a product sold to other studios? Changes a lot
   of design decisions around multi-tenancy, auth, and branding.
5. **Non-negotiable rules the user has said to previous sessions
   that might not be persisted**. Always worth asking early.

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

## Active plans

### In progress — UI design refresh

Matching `/Users/bridges/GITHUB/Checkmark Workspace-UI-Draft/`
mockups across the three highest-impact surfaces:

- ✅ **Overview (`/`)** — 4 widgets: Tasks / Notifications /
  Calendar / Booking. Shell + gradient + widget-card styling done.
  Click title → floating modal with full content. Drag-to-reorder.
- ✅ **Admin Hub (`/admin`)** — 5 widgets (+ 1 promoted from bank):
  Assign / Notifications / Flywheel / Team / Approvals /
  Shortcuts. Same grid rhythm as Overview.
- 🟡 **Assign (`/admin/templates`)** — hero header + filter search +
  bubble-card template grid + click-to-preview modal. Cards
  currently match mockup: 4-task preview + "…" overflow indicator,
  h-[290px] uniform, 2-line title wrap.

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

## Recent + next

### Just shipped (most recent first)

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

- Individual template editing — user mentioned this right after the
  mockup seed. Edit modal works; verify the UX on each of the 6
  seeded templates.
- Any remaining visual delta between current Assign page and the
  mockup (user has been iterating tightly here).
- After Assign lands: either start the flywheel event ledger OR
  the next page from the Workspace-UI-Draft folder (check if
  there's more than `index.html` + `assign.html`).

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
