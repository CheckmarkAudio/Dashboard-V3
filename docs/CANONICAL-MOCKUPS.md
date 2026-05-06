# Canonical visual mockups (for Claude Code & implementers)

All paths are **from the repository root**. Open these PNGs side-by-side with code when implementing UI.

## Frozen global chrome (Menu-Sidebar)

| What | File |
|------|------|
| Spec (read first) | `docs/Menu-Sidebar/README.md` |
| Header + sidebar mockup | `docs/Menu-Sidebar/menu-sidebar-v5.2-reference.png` |
| Logo | `docs/Menu-Sidebar/checkmark-audio-logo.png` |
| Team Hub icon | `docs/Menu-Sidebar/team-hub-icon-reference.png` |

## Main menu pages — **canonical** mockups

| Menu label | Canonical PNG | Archive / variants (same folder) |
|------------|---------------|-----------------------------------|
| **Overview** | `docs/pages/Overview/overview-v1.2.png` | `overview-v1.png` |
| **Tasks** | `docs/pages/Tasks/tasks-v2.2.png` | `tasks-v2.1.png`, `tasks-v2.0.png`, `tasks-v1.1.png`, `tasks-v1.0.png` |
| **Calendar** | `docs/pages/Calendar/calendar-v1.2.png` | `calendar-v1.1.png`, `calendar-v1.0.png` |
| **Booking Agent** | `docs/pages/Booking Agent/booking-agent-v1.5.png` | `booking-agent-v1.4.png` … `booking-agent-v1.0.png` |
| **Idea Board** | `docs/pages/Idea Board/idea-board-v1.1.png` | `idea-board-v1.0.png` |

## Current Live Visual Anchors

Use these live app surfaces as the highest-priority visual references for the current Checkmark UI skin:

| Anchor | Route | Source | What To Preserve |
|--------|-------|--------|------------------|
| **Booking page** | `/sessions` | `src/pages/Sessions.tsx` | Light-mode structure, clean table/list lines, calm surface contrast, gold CTA, token-backed borders, no noisy chrome. |
| **My Tasks widget** | `/daily` and Overview widget grid | `src/components/tasks/MyTasksCard.tsx` via `TeamTasksWidget` | Widget rhythm, compact title-first task rows, pending divider behavior, row metadata discipline, embedded body-only pattern inside `DashboardWidgetFrame`. |

When a mockup and a current live anchor disagree, do not guess. Preserve the live anchor unless the user explicitly asks to move away from it.

For light-mode border/nesting work, the desired family resemblance is: Booking page line structure + My Tasks row/widget rhythm.

## Extra reference images (optional context)

| File | Notes |
|------|--------|
| `docs/visual-refs/tasks-flywheel-color-reference.png` | KPI stage colors used on Tasks / Calendar week blocks. |
| `docs/visual-refs/implementation-handoff-context.png` | Screenshot of handoff checklist (which pages have drafts). |

## Wiring table

See **`docs/navigation-route-map.md`** for menu label ↔ route ↔ component (fill `*TBD*` as you implement).

## Human brief template

Use **`docs/How-to-hand-off-visuals-to-Claude.md`** for copy-paste instructions to any coding agent.
