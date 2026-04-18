import type { ComponentType } from 'react'
import type { AppRole } from '../permissions'

export type WorkspaceScope = 'member_overview' | 'admin_overview'

export type WidgetSpan = 1 | 2 | 3
export type WidgetRowSpan = 1 | 2 | 3

export type WorkspaceWidgetId =
  | 'team_snapshot'
  | 'today_calendar'
  | 'team_tasks'
  | 'team_activity'
  | 'team_directory'
  | 'booking_snapshot'
  | 'forum_notifications'
  | 'flywheel_summary'
  | 'team_focus'
  | 'approval_queue'
  | 'admin_schedule'
  | 'admin_shortcuts'
  | 'admin_assign'
  | 'admin_flywheel'
  | 'admin_notifications'
  | 'admin_team'
  | 'admin_approvals'

export interface WorkspaceWidgetRegistration {
  id: WorkspaceWidgetId
  title: string
  description: string
  defaultSpan: WidgetSpan
  // Optional default row span — widgets that want to be "tall rectangles"
  // on the Hub grid declare this; omit to fall back to a single row.
  defaultRowSpan?: WidgetRowSpan
  allowedRoles: AppRole[]
  scopes: WorkspaceScope[]
}

export interface WorkspaceWidgetDefinition extends WorkspaceWidgetRegistration {
  component: ComponentType
}

export interface WorkspaceWidgetState {
  id: WorkspaceWidgetId
  order: number
  visible: boolean
  span: WidgetSpan
  // Defaults to 1 when unspecified — preserves backwards compatibility
  // with saved layouts that predate row-span support.
  rowSpan?: WidgetRowSpan
}

export interface WorkspaceLayout {
  scope: WorkspaceScope
  version: number
  widgets: WorkspaceWidgetState[]
}
