import type { ComponentType } from 'react'
import type { AppRole } from '../permissions'

export type WorkspaceScope = 'member_overview' | 'admin_overview'

export type WidgetSpan = 1 | 2 | 3

export type WorkspaceWidgetId =
  | 'team_snapshot'
  | 'today_calendar'
  | 'team_tasks'
  | 'flywheel_summary'
  | 'team_focus'
  | 'approval_queue'
  | 'admin_schedule'
  | 'admin_shortcuts'

export interface WorkspaceWidgetRegistration {
  id: WorkspaceWidgetId
  title: string
  description: string
  defaultSpan: WidgetSpan
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
}

export interface WorkspaceLayout {
  scope: WorkspaceScope
  version: number
  widgets: WorkspaceWidgetState[]
}
