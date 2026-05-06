---
name: ui-consistency
description: Use before Claude changes UI, layout, styling, widget chrome, typography, colors, borders, spacing, responsive behavior, or visual polish in Dashboard-V3. Keeps the app consistent by routing changes through shared tokens, shared CSS classes, and reusable components instead of one-off Tailwind drift.
---

# UI Consistency Skill

Use this skill whenever the task touches visual web development.

## Required Reading

Read these before editing:

1. `docs/ui-standards.md`
2. `docs/claude-web-dev-guardrails.md`
3. `docs/CANONICAL-MOCKUPS.md` when the task touches a page with a canonical mockup
4. `docs/assign-engine-spec-2026-05-03.md` when the task touches Assign, Tasks, requests, approvals, or related RPCs

## Operating Rule

Prefer system-level changes over local patches.

If a visual choice should apply across the site, update one of:

- `src/index.css` design tokens
- `src/index.css` component classes such as `.widget-card`
- shared components such as `DashboardWidgetFrame`, `WorkspacePanel`, or common admin/form controls

Do not scatter new hard-coded radii, font sizes, colors, shadows, or borders across individual pages.

## Workflow

1. Identify the category:
   - token/theme change
   - widget/card chrome change
   - page layout change
   - component polish
   - behavior/data change disguised as UI
2. Locate the shared source of truth.
3. Reuse or update the shared source.
4. Avoid nested cards and duplicated widget chrome.
5. Verify the full page, not only the edited element.
6. Check sibling pages/components for matching border, radius, typography, spacing, and state styling.
7. Build and use the Vercel preview for visual approval when the change matters.

## Default Standards

- Colors come from `src/index.css` tokens.
- Widget cards use `.widget-card` or `DashboardWidgetFrame`.
- Widget grids use `WorkspacePanel`.
- Focus states use `.focus-ring` or the base form focus styles.
- Typography should use semantic classes from `src/index.css` before arbitrary `text-[...]` values.
- Buttons should reuse the existing primary/secondary/destructive hierarchy.
- Accessibility is part of done, not a follow-up.

## Stop Conditions

Stop and ask before continuing if:

- the user asked for polish but the change requires a page redesign
- the task needs a new visual system instead of an existing pattern
- multiple pages disagree and it is unclear which one is canonical
- a local fix would knowingly create inconsistency elsewhere
- a backend/data issue is causing the visual symptom

## Completion Note

In the PR summary, include:

- the shared source updated or reused
- pages/routes visually checked
- whether light and dark mode were checked
- any intentionally local exception
