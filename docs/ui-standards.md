# UI Standards

Date: 2026-05-05

This is the canonical styling standard for Checkmark Audio Dashboard. Use it before changing layout, cards, widgets, typography, colors, borders, spacing, or reusable UI patterns.

The purpose is consistency: when a visual choice changes, it should update site-wide through shared tokens, shared CSS classes, or shared components instead of one-off page edits.

For light/dark mode boundaries and theme-specific implementation rules, also read `docs/light-dark-theme-handoff.md`.

For the current visual skin, use the Booking page (`/sessions`, `src/pages/Sessions.tsx`) and My Tasks widget (`src/components/tasks/MyTasksCard.tsx`) as live anchors alongside `docs/CANONICAL-MOCKUPS.md`.

## Source Of Truth

Use these in order:

1. `src/index.css`
   - `@theme` color tokens
   - light/dark theme overrides
   - `.dashboard-shell`
   - `.widget-card`
   - `.focus-ring`
   - semantic typography classes
2. Shared components
   - `src/components/dashboard/DashboardWidgetFrame.tsx`
   - `src/components/dashboard/WorkspacePanel.tsx`
   - `src/components/tasks/shared.tsx`
   - shared admin/navigation/form components when available
3. Page/component-local classes only when the need is truly local.

If more than one page needs the same visual decision, it should not live as duplicated local Tailwind strings.

## Design Tokens

Use token-backed utilities:

- `bg-bg`
- `bg-surface`
- `bg-surface-alt`
- `bg-surface-hover`
- `border-border`
- `border-border-light`
- `text-text`
- `text-text-muted`
- `text-text-light`
- `bg-gold`
- `text-gold`
- `border-gold`

Avoid hard-coded hex values in components. If the color is meant to become part of the system, add or update a token in `src/index.css`.

Exception: highly specific third-party brand assets may use brand-specific colors when the asset itself requires it.

## Typography

Prefer semantic typography classes from `src/index.css`:

- `.text-display` for large page-level display text
- `.text-title` for page titles
- `.text-subtitle` for major card or panel titles
- `.text-section` for section headers
- `.text-body` for normal body copy
- `.text-caption` for secondary details
- `.text-label` for uppercase micro-labels

Avoid scattering arbitrary text sizes such as `text-[13px]`, `text-[17px]`, or `text-[28px]` unless matching an existing local pattern that should not be generalized yet.

Important text should stay readable. Do not solve layout pressure by shrinking important labels until they become hard to read.

## Subtext And Descriptions

Default website presentation should be title-first and compact. Do not add visible description/subtext under cards, task rows, template tiles, page headers, or widget headings unless the user explicitly asks for it or the text is required for accessibility, error recovery, or destructive-action safety.

Descriptions can still exist as editable data when useful for notes, admin cleanup, modals, or backend records. They should not automatically render as passive subtext in list rows or cover tiles. If a description is necessary, prefer showing it in an expanded detail/edit view rather than on the main surface.

## Widget Chrome

The standard widget surface is `.widget-card`, usually provided by `DashboardWidgetFrame`.

Rules:

- Do not put a second `.widget-card` inside a `DashboardWidgetFrame`.
- Widget body components should usually render body-only when embedded in a frame.
- If a page is a widget-grid surface, use `WorkspacePanel` and widget registrations instead of building a separate one-off grid.
- Widget widths/heights should come from `WorkspacePanel` definitions, not page-local magic numbers.
- Repeated widgets should share the same header/body rhythm.

When changing widget card border, radius, shadow, or background, update `.widget-card` in `src/index.css` so every widget moves together.

## Radius, Border, And Shadow

Use existing system classes before inventing new values:

- App shell: `.dashboard-shell`
- Widgets/cards: `.widget-card`
- Standard controls: existing button/input/select patterns
- Focus: `.focus-ring`

Avoid arbitrary one-off visual values:

- `rounded-[17px]`
- `border-[#...]`
- `shadow-[...]`
- page-local hard-coded container widths

If the whole site needs softer borders, darker borders, larger radius, or different shadows, update the shared class/token instead of patching individual pages.

## Buttons And Controls

Controls should feel like one product.

Use these patterns:

- primary action: filled `bg-gold` with readable text
- secondary action: border + `bg-surface` or `bg-surface-alt`
- destructive action: danger color plus explicit destructive copy
- icon-only button: real `<button>` with accessible label and hover/focus state
- segmented controls: consistent pill or tab pattern with `aria-pressed`/`aria-selected`

Do not create a new button style unless the existing hierarchy cannot express the action.

## Forms

Forms should use the base input/select/textarea styling from `src/index.css`.

Rules:

- Use labels, not placeholder-only fields.
- Keep input padding/radius consistent with nearby forms.
- Use `focus-ring` or the base focus behavior.
- Error text should be visible text, not only red border.
- Required fields need visible indication.

## Layout

Before changing page layout:

- Identify whether the page already has a canonical pattern.
- Reuse the closest existing layout pattern.
- Check the full viewport, not only the edited widget.
- Confirm the change does not create nested cards.
- Confirm the change does not create mismatched widths, borders, or typography between sibling panels.

Canonical patterns:

- Dashboard/Overview/Hub/Tasks widget surfaces: `WorkspacePanel`
- Admin settings-style pages: left rail + right content pane
- Assign engine behavior: `docs/assign-engine-spec-2026-05-03.md`
- Visual mockup reference: `docs/CANONICAL-MOCKUPS.md`

## Theme Changes

Theme changes are site-wide by default.

If changing color, border, shadow, text contrast, or background wash:

1. Change `src/index.css` tokens/classes first.
2. Check light mode and dark mode.
3. Scan for local overrides that now fight the token.
4. Verify at least one page with widgets and one admin/detail surface.

Do not update one page to a new theme while leaving sibling pages on the old theme unless the user explicitly asked for a one-page experiment.

## Accessibility Baseline

Every UI change should preserve:

- keyboard access
- visible focus
- readable contrast
- semantic buttons/links
- labels for icon-only actions
- non-color-only status signals
- no text overlap or clipping

If a visual idea makes accessibility worse, stop and propose an alternative.

## Visual QA Checklist

Before saying a UI change is done:

- Compare against `docs/CANONICAL-MOCKUPS.md` when relevant.
- Check the whole page at desktop width.
- Check a narrower width if layout can wrap.
- Check light and dark mode if colors changed.
- Check hover/focus states for new controls.
- Check that sibling widgets/panels have matching border, radius, shadow, title size, and spacing.
- Check that important text stays readable and does not overlap.
- Check Vercel preview for visual work before merge.

## Change Strategy

When a visual mismatch appears in multiple places:

1. Find the shared source: token, utility class, shared component, or widget frame.
2. Patch the shared source.
3. Remove local overrides that duplicate the old look.
4. Verify representative pages.
5. Document the new standard if it changes product-wide behavior.

This is how we avoid format drift.
