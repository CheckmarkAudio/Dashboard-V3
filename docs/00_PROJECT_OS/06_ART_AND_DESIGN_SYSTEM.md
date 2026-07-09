# Art And Design System

Purpose: preserve the visual soul of Checkmark while keeping UI execution consistent, usable, and source-of-truth driven.

Design here means more than decoration. It includes brand, polish, clarity, usability, rhythm, hierarchy, and the feeling of trust.

## Design North Star

Checkmark should feel:

- crafted
- calm
- clickable
- confident
- studio-native
- refined without becoming sterile
- visually consistent without feeling generic

The Checkmark logo is the central brand mark. The app should stand by the brand, not drift into unrelated themes whenever a new page is touched.

## Permanent Visual Commitments

These stay consistent unless the user explicitly updates the standard:

- Checkmark identity stays visible and respected
- black, white, checkmark gold, and purple remain core brand colors
- support colors are purposeful, not decorative noise
- button hierarchy stays consistent
- typography is readable before it is compact
- borders and radii should feel like one family
- widget chrome should stay uniform
- daily workflow pages should feel clear, not crowded

Use `docs/ui-standards.md` before changing layout, cards, widgets, typography, colors, borders, spacing, or reusable UI patterns.

## Existing Design Homes

Use the current folders before creating new ones:

| Home | Use |
|---|---|
| `docs/ui-standards.md` | Canonical styling standard. |
| `docs/CANONICAL-MOCKUPS.md` | Current canonical mockup references. |
| `docs/Menu-Sidebar/` | Frozen global chrome visual source. |
| `docs/pages/` | Per-page screenshot history and visual drafts. |
| `docs/mockups/` | HTML mockups and design review previews. |
| `docs/visual-refs/` | Aesthetic references, screenshots, and implementation visual context. |
| `docs/font-drafts/` | Typography and font experiments. |
| `docs/Marketing/` | Marketing templates, ads, social, email, and outward-facing standards. |

## Asset Filing Rules

Photos and aesthetic references:

- use `docs/visual-refs/`
- add a short note explaining why the reference matters
- do not treat a reference image as approved implementation unless the user says so

Page-specific drafts:

- use `docs/pages/[Page Name]/`
- name versions clearly, for example `tasks-v2.3.png`

Interactive or HTML mockups:

- use `docs/mockups/`
- add the mockup to `docs/mockups/README.md` when it becomes useful for review

Global chrome:

- use `docs/Menu-Sidebar/`
- do not change global header/sidebar without explicit user direction

Marketing and outward-facing assets:

- use `docs/Marketing/`
- follow `docs/Marketing/STANDARDS.md`

## UI Execution Rules

Before implementing visual changes:

1. identify whether the change is system-wide or local
2. reuse shared tokens/classes/components where possible
3. inspect the full page, not just the edited component
4. verify light and dark mode when colors change
5. verify desktop and mobile behavior when layout changes
6. update docs if a new visual standard is established

Do not create new one-off button, card, radius, shadow, or color systems when the existing system can express the change.

## Worker-Obvious Design Rule

The best design is not only pretty. It should make the next click feel obvious.

For daily worker pages:

- My work comes first
- secondary contexts live behind panes, tabs, or clear navigation
- the default view should not be a three-column wall
- labels should be human and direct
- important actions should not be icon-only mysteries

## Draft Versus Standard

Use this distinction:

- `draft`: exploratory, not canonical yet
- `reference`: useful inspiration, not binding unless stated
- `standard`: binding until changed
- `frozen`: do not change without explicit approval

When unsure, mark the status in the file or checkpoint entry.
