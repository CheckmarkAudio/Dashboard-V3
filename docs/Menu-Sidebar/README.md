# Menu-Sidebar (frozen design handoff)

This folder holds the **approved visual specification** for the **global chrome**: top header and left navigation. Internally we refer to this scope as **Menu-Sidebar**.

## Freeze rule

**Do not change Menu-Sidebar** in code or in new visual drafts **unless the product owner explicitly asks** to change this scope. Upcoming work will target **individual menu pages** (content inside the main area). That work must **not** alter header layout, sidebar structure, labels, or iconography described here unless requested.

## Source of truth (visual)

| Asset | Purpose |
| --- | --- |
| `menu-sidebar-v5.2-reference.png` | **Authoritative mockup (v5.2).** Implement header + sidebar to match this. |
| `checkmark-audio-logo.png` | Company mark for the header (filled white treatment on dark header per v5.1/v5.2). |
| `team-hub-icon-reference.png` | **Team Hub** nav icon: hub / network (center node, spokes, outer nodes)—not a generic “people” icon. |

If implementation ever disagrees with the PNG, **the PNG wins** unless the owner approves a written change in this document.

## Header (floating / sticky, flat)

- **Layout:** Full-width bar, **flat** (no bevels, no heavy “floating card” shadow). Bottom edge may use a single subtle border consistent with the rest of the app. Width aligns with the page—**same span as the rest of the site**, not inset.
- **Left:** Logo (`checkmark-audio-logo.png`) → title **Checkmark Audio** → subtext **dashboard** (lowercase per draft).
- **Right (right-aligned):** Logged-in **profile** (avatar, name, email as today) with subtext **Profile** (capital **P** per v4). Sign-out affordance stays accessible (per mockup / existing UX).
- **Removed from sidebar:** The old sidebar-top block (e.g. “CA” tile + company name + profile subtext) moves **into this header**; the sidebar is **navigation only** below the header.

## Main menu (labels and order)

Exact order, **v5.2 icons** (Lucide-aligned names for implementers):

1. **Overview** — `LayoutDashboard` (2×2 grid), active state with gold left rail per existing nav pattern.
2. **Tasks** — `CheckSquare` (square + check).
3. **Calendar** — `Calendar`.
4. **Booking Agent** — `Briefcase`.
5. **Idea Board** — `Lightbulb`.

## Admin section (labels and order)

Under an **Admin** disclosure (chevron), same row styling as main nav:

1. **Team Hub** — custom hub icon per `team-hub-icon-reference.png` (implement as SVG or asset; match metaphor).
2. **Assign Tasks** — `ClipboardList`.
3. **Members** — `Users` (two people).
4. **Metrics** — `BarChart3`.
5. **Settings** — `Settings`.

## Routing note (for Claude Code / implementers)

Labels above are **UX targets**. Map each row to existing routes/pages or new shells **in a separate pass**; this document does not redefine product routes. Preserve **admin-only** visibility for the Admin block where it exists today.

## For Claude Code

**Human-written requests:** If the owner uses plain-language + image paths only, follow **`docs/How-to-hand-off-visuals-to-Claude.md`** and keep this Menu-Sidebar folder as the frozen shell.

When implementing Menu-Sidebar:

1. Read this `README.md`.
2. Open `menu-sidebar-v5.2-reference.png` side-by-side with `src/components/Layout.tsx` (and any global layout / CSS).
3. Match **header**, **sidebar labels**, **order**, **icon set**, and **flat full-width header** behavior to the PNG and the tables above.
4. Do **not** restyle Menu-Sidebar while working on individual page content unless the owner explicitly requests Menu-Sidebar changes.

---

**Design iteration label:** Menu-Sidebar **v5.2** (visual draft). **Named scope:** Menu-Sidebar.
