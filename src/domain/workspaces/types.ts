import type { ComponentType } from 'react'
import type { AppRole } from '../permissions'

// ═════════════════════════════════════════════════════════════════════
// Member vs Admin widget separation — architectural lockdown.
//
// Every widget id lives in exactly ONE of two string-literal unions.
// A widget CANNOT appear in both the member Overview (`/`) and the
// admin Hub (`/admin`) because:
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
// If you want a widget to appear on both pages, you build it TWICE as
// two distinct widgets with different ids (a member version and an
// admin version). That is intentional — the admin surface should not
// inherit member layouts by accident.
// ═════════════════════════════════════════════════════════════════════

export type WorkspaceScope = 'member_overview' | 'admin_overview'

export type WidgetSpan = 1 | 2 | 3
export type WidgetRowSpan = 1 | 2 | 3

// Widgets that appear ONLY on the member Overview page ("/").
// NEVER add an admin-specific widget here. If it says "admin" in the
// name or function, it belongs in AdminWidgetId.
export type MemberWidgetId =
  | 'team_tasks'
  | 'forum_notifications'
  | 'today_calendar'
  | 'booking_snapshot'
  // Member-side widget bank — registered but not on the page yet.
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
  // Admin-side widget bank — registered but not on the page yet.
  | 'team_focus'
  | 'approval_queue'
  | 'admin_schedule'
  | 'admin_shortcuts'

// Union of every widget id in the system. The TypeScript compiler
// treats this as `MemberWidgetId | AdminWidgetId`, so each id has a
// deterministic "side" and no id can straddle the two.
export type WorkspaceWidgetId = MemberWidgetId | AdminWidgetId

// Base registration shape — unchanged across the split. The id is
// generic here; the specialized `MemberWidgetRegistration` /
// `AdminWidgetRegistration` types below narrow it.
export interface WorkspaceWidgetRegistration<Id extends WorkspaceWidgetId = WorkspaceWidgetId> {
  id: Id
  title: string
  description: string
  defaultSpan: WidgetSpan
  defaultRowSpan?: WidgetRowSpan
  allowedRoles: AppRole[]
}

export type MemberWidgetRegistration = WorkspaceWidgetRegistration<MemberWidgetId>
export type AdminWidgetRegistration = WorkspaceWidgetRegistration<AdminWidgetId>

export interface WorkspaceWidgetDefinition<Id extends WorkspaceWidgetId = WorkspaceWidgetId>
  extends WorkspaceWidgetRegistration<Id> {
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
