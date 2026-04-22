import type { ComponentType } from 'react'
import type { AppRole } from '../permissions'

// ═════════════════════════════════════════════════════════════════════
// Member vs Admin widget separation — architectural lockdown.
//
// Every widget id lives in exactly ONE of two string-literal unions.
// A widget CANNOT appear on both member pages AND admin pages because:
//
//   1. `MemberWidgetId` and `AdminWidgetId` are disjoint string unions.
//   2. Registration arrays are typed to accept only their own union
//      (`MemberWidgetRegistration[]` / `AdminWidgetRegistration[]`),
//      so putting an admin id into MEMBER_WIDGET_REGISTRATIONS is a
//      compile error.
//   3. Component maps are keyed by the respective union via
//      `Record<MemberWidgetId, ...>` / `Record<AdminWidgetId, ...>`,
//      so wiring a widget component into the wrong map is a compile
//      error too.
//   4. Each page directly imports its own definitions array — it does
//      not filter a shared list by "scope," so there is no role lookup
//      or scope string that can point a page at the wrong widgets.
//
// PR #7 added MULTI-PAGE PLACEMENT *within* a side. A member widget
// can now render on both member pages (Overview + Tasks) via its
// `defaultPlacements` array. It still cannot cross into the admin
// side — `MemberScope` and `AdminScope` are disjoint and a member
// widget's `defaultPlacements` is typed to only accept `MemberScope`.
//
// The invariant: the admin surface never inherits a member widget's
// placement by accident, and vice versa.
// ═════════════════════════════════════════════════════════════════════

// Member-side pages. A member widget's placement must target one of these.
export type MemberScope = 'member_overview' | 'member_tasks'

// Admin-side pages. An admin widget's placement must target one of these.
export type AdminScope = 'admin_overview'

// Full union of every workspace scope. Used for localStorage key
// differentiation + the `WorkspacePanel` scope prop.
export type WorkspaceScope = MemberScope | AdminScope

export type WidgetSpan = 1 | 2 | 3
export type WidgetRowSpan = 1 | 2 | 3

// ── Widget visibility model (PR #7) ──────────────────────────────────
// Two orthogonal axes per widget:
//   - accessVisibility: WHO can see the widget at all
//   - dataScope:        WHAT data it loads (self, team, etc.)
// Both fields are METADATA today — they document intent and give future
// widget builders / code reviewers a consistent vocabulary. Actual
// admin/member filtering continues to happen via the disjoint
// MemberWidgetId / AdminWidgetId type system above.

export type AccessVisibility =
  | 'personal'     // only the signed-in user sees the widget in their workspace
  | 'shared'       // any authenticated member can see the widget
  | 'admin'        // only admins / owners
  | 'role_scoped'  // reserved for future role-specific gating; no runtime logic yet

export type DataScope =
  | 'self'         // current user's data only
  | 'team'         // whole team's data
  | 'target_user'  // a specified user's data (admin context)
  | 'global'       // shared / app-wide data

// Where a widget renders by default. A widget may list multiple placements
// within its side (e.g. on both member_overview and member_tasks).
export interface WidgetPlacement<Scope extends WorkspaceScope = WorkspaceScope> {
  scope: Scope
  span: WidgetSpan
  rowSpan?: WidgetRowSpan
}

// Widgets that appear ONLY on member pages. NEVER add an admin-specific
// widget here. If it says "admin" in the name or function, it belongs
// in AdminWidgetId.
export type MemberWidgetId =
  | 'team_tasks'
  | 'forum_notifications'
  | 'today_calendar'
  | 'booking_snapshot'
  // NOTE: `assigned_tasks` was retired in PR #11 — its content folded
  // into `team_tasks` (MyTasksCard). Keeping the id out of the union
  // so saved layouts referencing it get sanitized cleanly via the
  // layout-version bump (v10).
  // Member-side widget bank — registered but not on any page yet.
  | 'team_snapshot'
  | 'team_directory'
  | 'team_activity'
  | 'flywheel_summary'

// Widgets that appear ONLY on the admin Hub page ("/admin").
// Every id here MUST be admin-exclusive. Members should never see these.
export type AdminWidgetId =
  | 'admin_assign'
  | 'admin_notifications'
  | 'admin_team'
  | 'admin_flywheel'
  | 'admin_approvals'
  // PR #16 — approval queue for user-submitted task requests. Distinct
  // from `admin_approvals` (which handles task_edit_requests for daily
  // checklists).
  | 'admin_task_requests'
  // Admin-side widget bank — registered but not on the page yet.
  | 'team_focus'
  | 'approval_queue'
  | 'admin_schedule'
  | 'admin_shortcuts'

// Union of every widget id in the system.
export type WorkspaceWidgetId = MemberWidgetId | AdminWidgetId

// Base registration shape. The id and placement-scope parameters narrow
// in the specialized Member / Admin sub-types below.
export interface WorkspaceWidgetRegistration<
  Id extends WorkspaceWidgetId = WorkspaceWidgetId,
  Scope extends WorkspaceScope = WorkspaceScope,
> {
  id: Id
  title: string
  description: string
  defaultPlacements: WidgetPlacement<Scope>[]
  accessVisibility: AccessVisibility
  dataScope: DataScope
  allowedRoles: AppRole[]
}

// Member widget: id must be a MemberWidgetId AND placements must target
// member scopes only. TypeScript rejects any placement targeting admin.
export type MemberWidgetRegistration = WorkspaceWidgetRegistration<MemberWidgetId, MemberScope>

// Admin widget: id must be an AdminWidgetId AND placements must target
// admin scopes only.
export type AdminWidgetRegistration = WorkspaceWidgetRegistration<AdminWidgetId, AdminScope>

export interface WorkspaceWidgetDefinition<
  Id extends WorkspaceWidgetId = WorkspaceWidgetId,
  Scope extends WorkspaceScope = WorkspaceScope,
> extends WorkspaceWidgetRegistration<Id, Scope> {
  component: ComponentType
}

export interface WorkspaceWidgetState {
  id: WorkspaceWidgetId
  order: number
  visible: boolean
  span: WidgetSpan
  rowSpan?: WidgetRowSpan
}

export interface WorkspaceLayout {
  scope: WorkspaceScope
  version: number
  widgets: WorkspaceWidgetState[]
}
