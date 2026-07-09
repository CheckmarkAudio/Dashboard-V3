# Navigation route map (Menu-Sidebar ↔ pages)

Fill this in as you lock each screen. **Product owner:** add **PNG filenames** inside the draft folder for that menu (see **Draft folder** column). **Implementer (Claude / dev):** add **URL path** and **component file** when wired.

**Frozen shell:** `docs/Menu-Sidebar/README.md` + `docs/Menu-Sidebar/menu-sidebar-v5.2-reference.png`

**Draft folders:** `docs/pages/<Menu label>/` — see `docs/pages/README.md`.

## Main menu

| Menu label (Menu-Sidebar) | Draft folder (put mockups here) | URL path (code) | Page component (code) | Visual draft file(s) | Notes |
|---------------------------|----------------------------------|-----------------|-------------------------|------------------------|-------|
| Overview | `docs/pages/Overview/` | `/` | `src/pages/Dashboard.tsx` | `overview-v1.png`; **current:** `overview-v1.2.png` | v1.2: calendar widget is **single-day (today)** agenda view, not month grid; updates conceptually each calendar day. v1: month mini-widget. Section titles will become links later. |
| Tasks | `docs/pages/Tasks/` | `/daily` | `src/pages/DailyChecklist.tsx` | **current:** `tasks-v2.2.png`; archive: `tasks-v2.1.png`, `tasks-v2.0.png`, `tasks-v1.1.png`, `tasks-v1.0.png` | Flywheel KPIs grid, Priority Tasks, Projects with status tags, Daily Maintenance checklist. |
| Calendar | `docs/pages/Calendar/` | `/calendar` | `src/pages/Calendar.tsx` | **current:** `calendar-v1.2.png`; archive: `calendar-v1.1.png`, `calendar-v1.0.png` | Weekly grid with flywheel-colored event blocks, My week / Team toggle, month mini-view. |
| Booking Agent | `docs/pages/Booking Agent/` | `/sessions` | `src/pages/Sessions.tsx` | **current:** `booking-agent-v1.5.png`; archive: `booking-agent-v1.4.png` … `booking-agent-v1.0.png` | Category filter tabs (Engineer, Consult, Training, Music Lesson, Education), gold Book a Session CTA, booking table. |
| Idea Board | `docs/pages/Idea Board/` | `/content` | `src/pages/Content.tsx` | **current:** `idea-board-v1.1.png`; archive: `idea-board-v1.0.png` | Suggestions form with flywheel categories, Troubleshooting report form, Inspo board link collection. |

## Admin menu

| Menu label (Menu-Sidebar) | Draft folder (put mockups here) | URL path (code) | Page component (code) | Visual draft file(s) | Notes |
|---------------------------|----------------------------------|-----------------|-------------------------|------------------------|-------|
| Team Hub | `docs/pages/Team Hub/` | `/admin` | `src/pages/admin/Hub.tsx` | | |
| Assign Tasks | `docs/pages/Assign Tasks/` | `/admin/templates` | `src/pages/admin/Templates.tsx` | | |
| Members | `docs/pages/Members/` | `/admin/my-team` | `src/pages/admin/MyTeam.tsx` | | |
| Metrics | `docs/pages/Metrics/` | `/admin/health` | `src/pages/admin/BusinessHealth.tsx` | | |
| Settings | `docs/pages/Settings/` | `/admin/settings` | `src/pages/admin/AdminSettings.tsx` | | |

## Header (not in sidebar)

| Area | Behavior | Visual draft | Notes |
|------|------------|--------------|-------|
| Profile (right) | Account + sign out | *(same as Menu-Sidebar mockup)* | Full-width sticky header per v5.2; logo + title left, profile + sign-out right. |

---

All main menu pages are implemented against their canonical mockups from `docs/CANONICAL-MOCKUPS.md`.
