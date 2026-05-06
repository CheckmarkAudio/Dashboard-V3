# UI Change Request Template

Use this when asking Claude to change visuals, layout, theme, borders, nesting, cards, widgets, typography, light mode, dark mode, icons, buttons, or spacing.

The goal is to keep Claude from blending separate requests together. Fill in only what matters for the task. Delete sections that do not apply.

## Copy/Paste Prompt

```text
UI change request for Dashboard-V3.

Before editing, read:
- docs/ui-standards.md
- docs/light-dark-theme-handoff.md
- docs/claude-web-dev-guardrails.md
- docs/CANONICAL-MOCKUPS.md
- .claude/skills/ui-consistency/SKILL.md

Task:
[Say exactly what visual change you want.]

Target route(s):
- [Example: /admin/templates]
- [Example: /daily]

Target component/surface:
- [Example: Template preview modal]
- [Example: My Tasks widget]
- [Example: Assign page right pane]

Mode priority:
- Primary mode: [light mode / dark mode / both]
- Preserve: [what should not visually change]

Reference:
- [Paste screenshot, mockup path, or exact words.]
- Current live anchors to compare against:
  - Booking page: /sessions, src/pages/Sessions.tsx, docs/pages/Booking Agent/booking-agent-v1.5.png
  - My Tasks widget: /daily + Overview, src/components/tasks/MyTasksCard.tsx, docs/pages/Tasks/tasks-v2.2.png
- If using the nested panel look: use a single bordered parent panel, an inset list panel, and needle-thin row dividers. Do not make cards inside cards.

Allowed scope:
- [Example: src/index.css tokens]
- [Example: shared widget/card classes]
- [Example: one named component]

Forbidden scope:
- Do not change Supabase/backend/schema/RPCs/data queries.
- Do not change page architecture or routing.
- Do not introduce passive subtext/descriptions.
- Do not hardcode one-off colors/radii/shadows in component files unless there is no shared pattern.
- Do not touch unrelated pages/files.

Implementation rules:
- Use shared tokens/classes first: bg-surface, bg-surface-alt, border-border, text-text, text-text-muted.
- If light mode needs more structure, update light-mode token values or shared classes first.
- Preserve dark mode unless a paired dark-token adjustment is required.
- Keep behavior unchanged.
- Keep accessibility: visible focus, readable contrast, semantic buttons/links.

Verification required before saying done:
- Run build/type check if runtime files changed.
- Run /visual-qa or manually follow .claude/commands/visual-qa.md.
- Compare against the Booking page and My Tasks widget anchors when the change touches panels, borders, rows, tasks, widgets, or light-mode structure.
- Check the whole page, not just the edited element.
- Check light mode and dark mode when theme tokens or shared visuals changed.
- Report files changed, routes checked, and any known residual risk.
```

## Short Version

Use this when the task is small:

```text
Read docs/ui-standards.md, docs/light-dark-theme-handoff.md, and .claude/skills/ui-consistency/SKILL.md before editing.

Make this specific UI change: [task].

Target route/component: [route/component].

Primary mode: [light/dark/both]. Preserve [what should not change].

Use shared tokens/classes first. Do not touch backend/data. Do not add passive subtext. Do not hardcode one-off colors/radii/shadows. Verify with .claude/commands/visual-qa.md before saying done.
```

## Request Checklist

Before sending Claude a UI request, confirm:

- The route is named.
- The visual target is named.
- Light/dark priority is stated.
- Reference screenshot/mockup is attached or path is listed.
- Backend/data is explicitly out of scope unless truly needed.
- The desired pattern is named in concrete visual language.
- The finish criteria are explicit.

## Useful Visual Language

Use these terms for the current Checkmark visual direction:

- Booking-page line structure
- My Tasks widget row rhythm
- nested inset list panel
- single bordered parent panel
- needle-thin row dividers
- title-first row
- no passive subtext
- soft icon tile
- subtle bevel
- token-backed surface
- light-mode structure pass
- preserve dark mode

Avoid vague requests like:

- "make it better"
- "make it clean"
- "make it pop"
- "fix the vibe"

Replace them with concrete requests:

- "increase light-mode row separation with token-backed hairline dividers"
- "use one inset list panel instead of separate cards"
- "make icon tiles solid and consistent with the shared icon tile pattern"
- "remove passive description text from the card surface"
