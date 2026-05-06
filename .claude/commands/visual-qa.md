---
description: Verify Dashboard-V3 UI changes across theme, layout, accessibility, consistency, and scope before calling a visual task done
allowed-tools: Bash, Read, Grep, Glob
---

Run this before saying a UI/layout/theme/polish task is done.

Do not treat this as optional when the change touches:

- theme tokens
- light mode or dark mode
- widgets/cards
- borders/dividers/nesting
- typography
- buttons/controls
- icons
- modals
- page layout
- task/template rows

## 1. Re-read The Visual Rules

Read:

1. `docs/ui-standards.md`
2. `docs/light-dark-theme-handoff.md`
3. `.claude/skills/ui-consistency/SKILL.md`
4. `docs/CANONICAL-MOCKUPS.md` if the touched surface has or resembles a canonical mockup

If the change touches Assign, Tasks, templates, requests, approvals, or task RPCs, also read:

5. `docs/assign-engine-spec-2026-05-03.md`

For current UI skin work, explicitly compare against these live anchors:

- Booking page: `/sessions`, `src/pages/Sessions.tsx`, `docs/pages/Booking Agent/booking-agent-v1.5.png`
- My Tasks widget: `/daily` and Overview, `src/components/tasks/MyTasksCard.tsx`, `docs/pages/Tasks/tasks-v2.2.png`

## 2. Confirm Scope Did Not Drift

Run:

```bash
git diff --stat
git diff --name-only
```

Report:

- files changed
- whether the changed files match the requested scope
- whether backend/data files changed
- whether docs were updated if behavior/workflow changed

Stop and ask before continuing if a visual-only task changed:

- Supabase migrations
- RLS/auth/security code
- RPC/data query behavior
- routing architecture
- unrelated pages/components

## 3. Token And Pattern Check

Search the diff for one-off styling drift:

```bash
git diff -- '*.tsx' '*.ts' '*.css' | rg "border-gray|bg-white|text-gray|dark:|rounded-\\[|shadow-\\[|#[0-9A-Fa-f]{3,6}|rgba\\("
```

This search can have legitimate hits. For each hit, explain whether it is:

- existing code unchanged
- a necessary local exception
- something that should be moved into `src/index.css` tokens/shared classes

Expected default:

- use `bg-surface`
- use `bg-surface-alt`
- use `border-border`
- use `text-text`
- use `text-text-muted`
- use shared classes like `.widget-card` and `.focus-ring`

## 4. Passive Subtext Check

Make sure the diff did not add visible passive descriptions/subtext by default.

Search:

```bash
git diff -- '*.tsx' | rg "description|subtitle|text-text-muted|text-text-light"
```

Descriptions are acceptable for:

- forms/edit fields
- detail modals
- error recovery
- destructive-action safety
- accessibility labels

Descriptions are not a default visual pattern for:

- task rows
- template cover cards
- widget headings
- page headers
- compact list rows

## 5. Layout Consistency Check

Inspect the changed UI and answer:

- Does this still feel related to the Booking page and My Tasks widget anchors?
- Does the full page still align with sibling panels/widgets?
- Are widget widths/heights driven by `WorkspacePanel` or shared layout rules?
- Are there any cards inside cards?
- Are row dividers thin and consistent?
- Are icon tiles consistent in size, fill, and visual weight?
- Does text fit without overlap or clipping?
- Are controls in predictable places?

If the target is the nested-panel look, confirm:

- one bordered parent surface
- one inset list panel when needed
- rows divided by hairline borders
- no stack of separate mini-cards
- Booking-page line structure and My Tasks row rhythm are preserved or intentionally extended

## 6. Light/Dark Mode Check

If the change touches colors, borders, shadows, surfaces, or theme tokens:

- Check light mode.
- Check dark mode.
- Confirm light mode has enough structure.
- Confirm dark mode did not become over-bordered or mismatched.
- Confirm the implementation is token-first, not two separate component structures.

State clearly which mode was the primary target.

## 7. Accessibility Check

Verify:

- icon-only buttons have accessible labels
- focus states are visible
- text contrast is readable
- buttons/links use semantic elements
- status is not communicated by color only
- important text is not clipped or hidden
- hover-only actions are still discoverable enough for the surface

## 8. Build And Runtime Check

If runtime files changed, run:

```bash
npm run build
```

If only docs/mockups changed, explain why build was skipped.

For meaningful UI work, use a local or Vercel preview and inspect the target route. If preview is not available, say so.

Report:

- command run
- result
- any warnings
- routes/pages checked

## 9. Final Done Report

Before final response, summarize:

- what changed
- files changed
- routes checked
- light/dark status
- build status
- whether backend/data was untouched
- any known follow-up

Do not say "done" without this summary for UI work.
