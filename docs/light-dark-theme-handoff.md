# Light/Dark Theme Handoff For Claude

Use this before changing theme, borders, nesting, surfaces, shadows, gradients, light mode, dark mode, or visual structure in Dashboard-V3.

## Core Rule

Light mode and dark mode are two visual outputs from the same frontend component structure.

The backend does not know or care which theme is active. Supabase should not be changed for theme work.

Do not change schema, RPCs, data queries, RLS, migrations, or seed data for light/dark mode styling.

## How Theme Works

The app renders the same React components in both modes. CSS tokens decide how those components look.

Preferred pattern:

```tsx
className="bg-surface-alt border border-border text-text"
```

Then `src/index.css` defines what `surface-alt`, `border`, and `text` mean in light mode and dark mode.

Do not treat dark mode as the source of truth when the request is about light-mode structure. Preserve dark mode unless a shared token change requires a paired dark-mode value.

## Correct Implementation Order

Use this order:

1. `src/index.css` tokens and shared classes first.
2. Shared component classes second.
3. Component-local Tailwind only if the need is truly local.

Primary files to check:

- `src/index.css`
- `src/components/dashboard/DashboardWidgetFrame.tsx`
- `src/components/dashboard/WorkspacePanel.tsx`
- `src/components/tasks/shared.tsx`
- `docs/ui-standards.md`
- `docs/CANONICAL-MOCKUPS.md`
- `docs/claude-web-dev-guardrails.md`

If more than one page needs the same visual idea, do not duplicate local Tailwind strings. Make a shared token/class/component carry it.

## Light Mode Structure

When the user asks for more structure in light mode, that usually means:

- slightly stronger light-mode borders
- clearer hairline row dividers
- inset list panels
- better surface contrast between shell, card, panel, and row
- subtle shadows or bevels
- cleaner nested-box hierarchy

This should usually be done through token-backed classes:

```tsx
className="rounded-xl border border-border bg-surface-alt shadow-sm"
```

And token values in `src/index.css`, not hard-coded component colors.

## Current Visual Anchors

The current live anchors for theme and structure are:

1. Booking page
   - Route: `/sessions`
   - Source: `src/pages/Sessions.tsx`
   - Canonical mockup: `docs/pages/Booking Agent/booking-agent-v1.5.png`
   - Preserve: clean light-mode line work, calm page/table structure, readable gold CTA, token-backed borders, and restrained chrome.
2. My Tasks widget
   - Routes: `/daily` and Overview widget grid
   - Source: `src/components/tasks/MyTasksCard.tsx`, embedded through `src/components/dashboard/memberOverviewWidgets.tsx`
   - Canonical mockup family: `docs/pages/Tasks/tasks-v2.2.png`
   - Preserve: compact title-first rows, widget rhythm, pending divider treatment, row metadata discipline, and body-only embedding inside `DashboardWidgetFrame`.

When implementing a light-mode structure pass, compare the changed surface against both anchors:

- Booking page for page-level panels, tables, border strength, and row dividers.
- My Tasks widget for compact task-row rhythm, widget spacing, and title-first hierarchy.

Do not invent a third visual language if the desired result can be expressed by extending these anchors.

## Dark Mode Preservation

When adding light-mode structure, check dark mode separately.

Avoid accidentally making dark mode:

- over-bordered
- too flat
- too bright
- full of mismatched gray surfaces
- visually heavier than before

If a token changes for light mode, define or verify the dark-mode counterpart.

## What Not To Do

Do not scatter one-off classes like:

```tsx
border-gray-200 bg-white text-gray-900
dark:border-gray-700 dark:bg-gray-900
```

Do not patch individual pages into different visual systems.

Do not add nested cards inside cards. Use one parent surface, then an inset panel or rows with needle-thin dividers.

Do not add passive descriptions/subtext by default. The site should be title-first unless text is required for accessibility, error recovery, or destructive-action safety.

## Visual Vocabulary

For the desired Checkmark light-mode structure, use these terms:

- nested inset list panel
- single bordered panel
- needle-thin row dividers
- title-first rows
- soft icon tile
- token-backed surfaces
- subtle bevel
- light-mode structure pass
- no passive subtext

Avoid "cards inside cards." The target is closer to "a bordered inner panel containing rows" than "a stack of separate cards."

## Backend Boundary

Theme work is frontend-only.

Backend is for:

- tasks
- templates
- users
- bookings
- requests
- permissions
- persistence

Frontend theme is for:

- colors
- borders
- shadows
- radius
- spacing
- typography
- row dividers
- light/dark contrast

If a visual issue seems to require SQL, stop and explain why before changing backend code.

## Prompt To Paste To Claude

```text
Before touching UI/theme, read:

- docs/light-dark-theme-handoff.md
- docs/ui-standards.md
- docs/claude-web-dev-guardrails.md
- docs/CANONICAL-MOCKUPS.md

For this pass, treat light mode and dark mode as separate visual outputs from shared frontend tokens, not separate component structures.

If I ask for more visual structure in light mode, do it through src/index.css tokens/shared classes first: borders, dividers, inset panels, surface contrast, subtle shadows, and bevels. Keep React structure and behavior unchanged unless the component truly needs a reusable shared pattern.

Do not make dark mode the design source of truth for this pass. Preserve dark mode unless a shared token change requires a paired dark-mode value. Verify dark mode still looks intentional and not over-bordered.

Do not hardcode one-off Tailwind colors like border-gray-200, bg-white, dark:bg-gray-900, or page-local border/shadow systems. Components should keep using token classes like bg-surface, bg-surface-alt, border-border, text-text, and text-text-muted.

Backend/data is unrelated to light/dark mode. Do not change Supabase, schema, RPCs, migrations, seed data, or data queries for theme work.

No passive subtext/descriptions by default. Keep rows/cards title-first unless description text is required for accessibility, error recovery, or destructive-action safety.

Target visual vocabulary: nested inset list panel, single bordered panel, needle-thin row dividers, soft icon tiles, subtle bevel, token-backed surfaces.
```

## Done Criteria

Before calling a theme/UI change done:

- Light mode checked.
- Dark mode checked.
- At least one widget page checked.
- At least one admin/detail surface checked.
- No unrelated backend/data changes.
- No scattered one-off color/border/radius system.
- No passive subtext introduced.
