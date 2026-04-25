import type {
  AdminWidgetRegistration,
  MemberScope,
  MemberWidgetRegistration,
  WidgetPlacement,
  WorkspaceLayout,
  WorkspaceScope,
  WorkspaceWidgetRegistration,
  WorkspaceWidgetState,
} from './types'

// ═════════════════════════════════════════════════════════════════════
// MEMBER — widgets available to members.
//
// A member widget can appear on one or more MEMBER pages via its
// `defaultPlacements` array. Each placement specifies which page and
// how big (span × rowSpan). Crossing into an admin scope is a compile
// error — `MemberWidgetRegistration` narrows the placement Scope to
// `MemberScope` only.
// ═════════════════════════════════════════════════════════════════════
// PR #32 — column-snap model. Each placement declares a column
// (`col`); the grid renders 3 independent vertical stacks. Widgets
// auto-arrange inside their column, but dropping a widget into col 3
// keeps it in col 3 even if col 1 is empty. `rowSpan` governs widget
// HEIGHT within its column (rs=2 renders 2× tall). Within-column order
// falls out of registration order here; users reorder via drag.
//
// Overview stacks (PR #47-rev3 layout, rev4 sized col 3 to flush):
//   col 1: team_tasks (rs2)
//   col 2: today_calendar (rs2)
//   col 3: booking_snapshot (rs0.5 — compact Book-a-Session button) · forum_notifications (rs1.5)
//
// Tasks stacks (all rs2 so each column shows a long queue at a glance):
//   col 1: team_tasks   |   col 2: studio_tasks   |   col 3: team_board
export const MEMBER_WIDGET_REGISTRATIONS: MemberWidgetRegistration[] = [
  {
    id: 'team_tasks',
    title: 'My Tasks',
    // PR #37 — description intentionally blank; the title alone is
    // self-explanatory and the subtitle strip cluttered the widget.
    // PR #47-rev3: Overview rowSpan 1 → 2 so My Tasks matches the
    // Calendar widget height, giving col 1 the same vertical weight
    // as col 2 on the Overview grid.
    description: '',
    defaultPlacements: [
      { scope: 'member_overview', span: 1, rowSpan: 2, col: 1 },
      { scope: 'member_tasks', span: 1, rowSpan: 2, col: 1 },
    ],
    accessVisibility: 'personal',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    // Compact Book-a-Session action. rowSpan 0.5 ≈ 170px.
    // PR #47-rev3: moved col 2 → col 3 (top) per user drag layout.
    // Calendar (rs2) now fills col 2 alone; Booking sits on top of
    // Notifications in col 3. Still registered BEFORE
    // forum_notifications so col 3 resolves Booking → Notifications.
    id: 'booking_snapshot',
    title: 'Booking',
    description: 'Quick-book a studio session.',
    defaultPlacements: [{ scope: 'member_overview', span: 1, rowSpan: 0.5, col: 3 }],
    accessVisibility: 'personal',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'today_calendar',
    title: 'Calendar',
    description: "Today's schedule — toggle days with the arrows.",
    defaultPlacements: [{ scope: 'member_overview', span: 1, rowSpan: 2, col: 2 }],
    accessVisibility: 'personal',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    // PR #47-rev3: rowSpan 2 → 1 so col 3 reads as a balanced stack.
    // PR #47-rev4: rowSpan 1 → 1.5 to fill the remaining vertical
    // space — Booking rs0.5 (170px) + gap (16) + Notifications rs1.5
    // (518px) = 704px, near-flush with cols 1-2 at rs2 (696px).
    // Within-column order: registered AFTER booking_snapshot so col 3
    // resolves Booking on top.
    id: 'forum_notifications',
    title: 'Notifications',
    description: 'Unread messages across channels and new assignments.',
    defaultPlacements: [{ scope: 'member_overview', span: 1, rowSpan: 1.5, col: 3 }],
    accessVisibility: 'shared',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  // ─── Tasks page (`/daily`) widgets ──────────────────────────────
  {
    id: 'studio_tasks',
    title: 'Studio Tasks',
    description: '',
    defaultPlacements: [{ scope: 'member_tasks', span: 1, rowSpan: 2, col: 2 }],
    accessVisibility: 'shared',
    dataScope: 'team',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'team_board',
    title: 'Team Tasks',
    description: '',
    defaultPlacements: [{ scope: 'member_tasks', span: 1, rowSpan: 2, col: 3 }],
    accessVisibility: 'shared',
    dataScope: 'team',
    allowedRoles: ['member', 'admin', 'owner'],
  },
]

// Member-side widget bank — registered but NOT on any member page today.
export const MEMBER_BANK_REGISTRATIONS: MemberWidgetRegistration[] = [
  {
    id: 'team_snapshot',
    title: 'Daily Snapshot',
    description: 'Progress, streak, and must-do.',
    defaultPlacements: [],
    accessVisibility: 'personal',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'team_directory',
    title: 'Team',
    description: 'Quick-reference row of teammates.',
    defaultPlacements: [],
    accessVisibility: 'shared',
    dataScope: 'team',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'team_activity',
    title: 'Team activity',
    description: 'Recent team actions tagged by flywheel stage.',
    defaultPlacements: [],
    accessVisibility: 'shared',
    dataScope: 'team',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'flywheel_summary',
    title: 'Flywheel Summary',
    description: 'Five-stage snapshot on the member surface.',
    defaultPlacements: [],
    accessVisibility: 'shared',
    dataScope: 'team',
    allowedRoles: ['member', 'admin', 'owner'],
  },
]

// ═════════════════════════════════════════════════════════════════════
// ADMIN — widgets on the admin Hub page ("/admin").
// Admin widgets' placements must target `admin_overview` only — the
// type system enforces it via `AdminWidgetRegistration`.
// ═════════════════════════════════════════════════════════════════════
// PR #32 — column-snap model (see MEMBER comment block for the full
// grammar).
//
// Hub stacks:
//   col 1: admin_quick_assign · admin_task_requests
//   col 2: admin_flywheel (rs2)
//   col 3: admin_notifications · admin_team
//
// Assign stacks (PR #41 reorg per sketch, logs in PRs #44 + #45,
// Templates thumbnails + arrange-by in PR #46, Assign compacted to
// match Edit + reorder per user drag layout in PR #47):
//   col 1: admin_assign_log · admin_approval_log
//   col 2: admin_assign (rs0.5) · admin_edit_tasks (rs0.5) · admin_task_requests
//   col 3: admin_templates (rs2 — friendly thumbnails with per-role icons)
export const ADMIN_WIDGET_REGISTRATIONS: AdminWidgetRegistration[] = [
  {
    id: 'admin_quick_assign',
    title: 'Quick Assign',
    description: 'Fire off a one-off task without leaving the Hub.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 1, col: 1 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_flywheel',
    title: 'Flywheel',
    description: 'KPIs across the five flywheel stages.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 2, col: 2 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_notifications',
    title: 'Notifications',
    description: 'Unread channels, new assignments, and quick post as admin.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 1, col: 3 }],
    accessVisibility: 'admin',
    dataScope: 'self',
    allowedRoles: ['admin', 'owner'],
  },
  {
    // PR #41 reorg — moved to col 2 (middle) per the sketch. Tiles
    // shrunk from 4 to 2 (Task + Session). Studio Task is reachable
    // via the Task modal's scope toggle; Task Group is folded into
    // PR #42's Add-from-template flow.
    // PR #47: rowSpan 1 → 0.5 so Assign matches Edit (col 1 rs 0.5)
    // — the two read as a visually consistent twin-button pair, and
    // Task Requests / Approval Log can slide up tighter in col 1.
    // Tile body compacted to a twin-button row (icon + label, no
    // hint text) so it fits the smaller height.
    id: 'admin_assign',
    title: 'Assign',
    description: 'Send out sessions, tasks, or task groups.',
    defaultPlacements: [{ scope: 'admin_assign', span: 1, rowSpan: 0.5, col: 2 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    // PR #44 — Assign Log. PR #47-rev2: moved from col 2 → col 1
    // (top) per the user's drag layout — col 1 reads Assign Log on
    // top of Approval Log; col 2 leads with the action widgets
    // (Assign / Edit / Task Requests). Registered AHEAD of
    // admin_approval_log so col 1 resolves Assign Log first.
    id: 'admin_assign_log',
    title: 'Assign Log',
    description: '',
    defaultPlacements: [{ scope: 'admin_assign', span: 1, rowSpan: 1, col: 1 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    // PR #45 — Approval Log. PR #47-rev2: now sits at the BOTTOM of
    // col 1 under Assign Log (per user drag layout). Registered
    // AFTER admin_assign_log so col 1 resolves Assign Log → Approval
    // Log.
    id: 'admin_approval_log',
    title: 'Approval Log',
    description: '',
    defaultPlacements: [{ scope: 'admin_assign', span: 1, rowSpan: 1, col: 1 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    // PR #40: single-button Edit Tasks widget.
    // PR #43: twin-button Edit widget (Edit Task + Edit Booking).
    // Widget id kept stable so saved layouts keep resolving even
    // though the display title is now just "Edit".
    // PR #47-rev2: moved from col 1 → col 2 (middle). Per user drag
    // layout col 2 stacks Assign (rs0.5) → Edit (rs0.5) → Task
    // Requests (rs1). Registered AFTER admin_assign and BEFORE
    // admin_task_requests so col 2 resolves Assign → Edit → Task
    // Requests.
    id: 'admin_edit_tasks',
    title: 'Edit',
    description: '',
    defaultPlacements: [{ scope: 'admin_assign', span: 1, rowSpan: 0.5, col: 2 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_task_requests',
    title: 'Task Requests',
    description: 'Members asking for tasks to be added to their queue.',
    // Hub overview col 1 (stacks under Quick Assign — unchanged).
    // PR #47-rev2: Assign-page placement moves col 1 → col 2 per
    // user drag layout. Registered AFTER admin_edit_tasks so col 2
    // of admin_assign resolves Assign → Edit → Task Requests.
    defaultPlacements: [
      { scope: 'admin_overview', span: 1, rowSpan: 1, col: 1 },
      { scope: 'admin_assign', span: 1, rowSpan: 1, col: 2 },
    ],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_team',
    title: 'Team',
    description: 'Your crew at a glance.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 1, col: 3 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    // PR #46: thumbnail grid replaces big-card preview; search /
    // filters / Arrange-by row stays pinned at top while the grid
    // scrolls. Standalone admin_template_preview widget folded into
    // this one. PR #46-rev2: rowSpan returned to 2 so col 3 isn't
    // disproportionately tall vs cols 1-2; thumbnails sized up so
    // each tile reads as friendly content, not a tiny file icon.
    id: 'admin_templates',
    title: 'Templates',
    description: 'Reusable blueprints for onboarding + repeat work.',
    defaultPlacements: [{ scope: 'admin_assign', span: 1, rowSpan: 2, col: 3 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    // Legacy task_edit_requests approvals (daily-checklist edits).
    // De-placed — admins can surface via controls.
    id: 'admin_approvals',
    title: 'Checklist Approvals',
    description: 'Pending daily-checklist edit requests.',
    defaultPlacements: [],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
]

// Admin-side widget bank — registered but NOT on the Hub grid today.
export const ADMIN_BANK_REGISTRATIONS: AdminWidgetRegistration[] = [
  {
    id: 'team_focus',
    title: 'Team Focus',
    description: 'Live team completion, submissions, and member momentum.',
    defaultPlacements: [],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'approval_queue',
    title: 'Approval Queue',
    description: 'Pending edits and submissions that need admin attention.',
    defaultPlacements: [],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_schedule',
    title: 'Today Schedule',
    description: 'The studio schedule for today across the team.',
    defaultPlacements: [],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_shortcuts',
    title: 'Admin Shortcuts',
    description: 'Jump directly into the key admin workspaces.',
    defaultPlacements: [],
    accessVisibility: 'admin',
    dataScope: 'global',
    allowedRoles: ['admin', 'owner'],
  },
]

// Convenience aggregation — every registered widget on either side.
// Used for layout sanitization ("is this id still valid?") and for
// component-map lookups. Do NOT iterate this for rendering — iterate
// the page-specific scoped helper below instead.
export const WORKSPACE_WIDGET_REGISTRATIONS: WorkspaceWidgetRegistration[] = [
  ...MEMBER_WIDGET_REGISTRATIONS,
  ...MEMBER_BANK_REGISTRATIONS,
  ...ADMIN_WIDGET_REGISTRATIONS,
  ...ADMIN_BANK_REGISTRATIONS,
]

// Build default widget state for a given scope by filtering registrations
// whose `defaultPlacements` include that scope, then projecting each
// placement into widget state. Scope-matched placements decide span +
// rowSpan so a widget can be 2×2 on Overview and 1×1 on Tasks if needed.
function buildDefaultWidgetStateForScope(
  registrations: WorkspaceWidgetRegistration[],
  scope: WorkspaceScope,
): WorkspaceWidgetState[] {
  const perColumnOrder: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  const result: WorkspaceWidgetState[] = []
  for (const widget of registrations) {
    const placement = widget.defaultPlacements.find(p => p.scope === scope)
    if (!placement) continue
    const col = placement.col
    const order = perColumnOrder[col] ?? 0
    perColumnOrder[col] = order + 1
    result.push({
      id: widget.id,
      order,
      visible: true,
      span: placement.span,
      rowSpan: placement.rowSpan ?? 1,
      col,
    })
  }
  return result
}

// Bump whenever the default widget order / span / scope assignment
// changes. Saved layouts whose `version` does not match are discarded
// in storage.ts so the new default ordering takes effect for everyone.
//
// v8 (2026-04-20): rebalance Overview grid so both columns terminate at
// the same row — team_tasks 3→2, forum_notifications 1→2.
// v9 (2026-04-22, PR #7): widget visibility model formalized; multi-page
// placement introduced; new `assigned_tasks` widget defaults onto
// Overview + Tasks; Tasks page becomes a widget grid scope.
// v10 (2026-04-22, PR #11): `assigned_tasks` widget retired — its
// content folded into `team_tasks` (MyTasksCard reads assigned_tasks
// directly). Saved v9 layouts that referenced `assigned_tasks` get
// sanitized away; the rebuilt default keeps `team_tasks` on both
// Overview and Tasks pages, giving users one unified "My Tasks" view.
// v11 (2026-04-22, PR #16): new `admin_task_requests` widget joins
// the admin Hub overview so admins see the user-submitted approval
// queue inline alongside existing approvals.
// v12 (2026-04-23, PR #19): Hub swaps the full `admin_assign` widget
// for the lightweight `admin_quick_assign`. The full surface now
// lives on the Assign page. Saved v11 layouts referencing
// `admin_assign` on `admin_overview` get sanitized away.
// v13 (2026-04-24, PR #29): all widgets settle at span: 1 so the
// grid is 3 equal-width columns across every page. New Tasks-page
// widgets (studio_tasks, team_board) registered. New Assign-page
// scope + widgets (admin_templates plus dual placement for
// admin_assign + admin_task_requests). Legacy `admin_approvals`
// (daily-checklist edits) de-placed. Existing v12 layouts reset.
// v14 (2026-04-24, PR #30): rowSpans restored so per-page positioning
// matches the pre-refactor layouts — Overview stacks Tasks+Booking
// in col 1 with Calendar/Notifications spanning both rows; Hub stacks
// Quick Assign+Task Requests in col 1 with Flywheel spanning col 2
// and Notifications+Team in col 3; Assign places Assign·TaskRequests
// in row 1 with Templates spanning col 3. Tasks + Assign page
// definitions wired through their own scope filters.
// v15 (2026-04-24, PR #32): column-snap manual placement. Each
// widget has a `col` in [1..3]; the grid renders 3 independent
// vertical stacks (no row-major flow across columns). Within a
// column, widgets auto-stack by `order` and dragging reorders with
// standard sortable shift semantics. Dragging to a different column
// snaps to that column. `rowSpan` still controls widget height inside
// its column. `WorkspaceWidgetState` gains `col`; saved v14 layouts
// reset to the new defaults.
// v16 (2026-04-24, PR #33): Tasks page widgets bumped to rowSpan=2
// (~696px each) so long queues are visible at a glance. Overview
// Booking widget compacted to rowSpan=0.5 (~170px) and moved to col 2
// above Calendar — reflects the "just the Book a Session button"
// redesign. New fractional `0.5` rowSpan supported by `widgetHeight()`.
// v17 (2026-04-25, PR #40): new `admin_edit_tasks` widget placed on
// the Assign page, col 1 below admin_assign.
// v18 (2026-04-25, PR #41): Assign-page reorg per user sketch.
// Col 1: Task Requests + Edit Tasks. Col 2: Assign. Col 3:
// Templates. Assign widget itself shrinks from 4 tiles to 2.
// v19 (2026-04-25, PR #43): Edit widget becomes twin-button (Edit
// Task + Edit Booking) and shrinks to rowSpan 0.5 (~170px). Widget
// id unchanged; display title renamed to "Edit".
// v20 (2026-04-25, PR #43-fix): swap registration order so col 1
// of the Assign page resolves Task Requests on top, Edit beneath
// (matches the user sketch). Saved v19 layouts had the widgets
// inverted; the bump forces a fresh default.
// v21 (2026-04-25, PR #44): new `admin_assign_log` widget on the
// Assign page col 2 under admin_assign.
// v22 (2026-04-25, PR #45): new `admin_approval_log` widget on the
// Assign page col 1, between Task Requests (top) and Edit (bottom).
// v23 (2026-04-25, PR #46-rev1): file-system-style thumbnail grid
// folded into `admin_templates`; standalone `admin_template_preview`
// widget removed; Templates rowSpan 2 → 3 so it fills col 3. Saved
// v22 layouts that referenced `admin_template_preview` get sanitized
// away by the version bump.
// v24 (2026-04-25, PR #46-rev2): Templates rowSpan 3 → 2 so col 3
// isn't disproportionately taller than cols 1-2; thumbnails sized up
// (2-per-row grid, larger icon bubble, per-role icon) so tiles read
// as friendly content tiles instead of tiny file icons.
// v25 (2026-04-25, PR #47): Assign rowSpan 1 → 0.5 so it matches
// the Edit widget's compact height — the two read as a visually
// consistent twin-button pair.
// v26 (2026-04-25, PR #47-rev2): default Assign-page widget order
// updated to match the user's drag layout. Col 1 stacks Assign Log
// → Approval Log; col 2 stacks Assign → Edit → Task Requests; col 3
// keeps Templates. Saved v25 layouts get reset so the new defaults
// apply on next load.
// v27 (2026-04-25, PR #47-rev3): default Overview-page widget order
// updated to match the user's drag layout. Col 1 = team_tasks (rs2);
// col 2 = today_calendar (rs2 — alone now); col 3 = booking_snapshot
// (rs0.5) on top of forum_notifications (rs1). Notifications shrunk
// from rs2 → rs1 so col 3 reads as a balanced stack alongside the
// rs2 widgets in cols 1-2.
// v28 (2026-04-25, PR #47-rev4): added rs1.5 to WidgetRowSpan and
// bumped forum_notifications rs1 → rs1.5 so col 3 (Booking 170 +
// gap 16 + Notifications 518 = 704px) sits near-flush with cols
// 1-2 at rs2 (696px), filling the previously-empty space below
// Notifications.
export const WORKSPACE_LAYOUT_VERSION = 28

// Default layouts per scope. Each scope picks its widgets from the
// relevant side's registrations (all + bank) and uses only those whose
// `defaultPlacements` target that scope.
export function getDefaultWorkspaceLayout(scope: WorkspaceScope): WorkspaceLayout {
  const memberScopes: MemberScope[] = ['member_overview', 'member_tasks']
  const isMemberScope = (memberScopes as WorkspaceScope[]).includes(scope)
  const pool = isMemberScope
    ? [...MEMBER_WIDGET_REGISTRATIONS, ...MEMBER_BANK_REGISTRATIONS]
    : [...ADMIN_WIDGET_REGISTRATIONS, ...ADMIN_BANK_REGISTRATIONS]
  return {
    scope,
    version: WORKSPACE_LAYOUT_VERSION,
    widgets: buildDefaultWidgetStateForScope(pool, scope),
  }
}

// Re-export WidgetPlacement for consumers that want to type placements
// inline without reaching into the types module.
export type { WidgetPlacement }
