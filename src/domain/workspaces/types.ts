import type { ComponentType } from 'react'
import type { AppRole } from '../permissions'

export type WorkspaceScope = 'member_overview' | 'admin_overview'

export type WidgetSpan = 1 | 2 | 3

export type OverviewWidgetId =
  | 'team_snapshot'
  | 'today_calendar'
  | 'team_tasks'
  | 'flywheel_summary'

export interface OverviewWidgetDefinition {
  id: OverviewWidgetId
  title: string
  description: string
  defaultSpan: WidgetSpan
  allowedRoles: AppRole[]
  component: ComponentType
}

export interface WorkspaceWidgetState {
  id: OverviewWidgetId
  order: number
  visible: boolean
  span: WidgetSpan
}

export interface WorkspaceLayout {
  scope: WorkspaceScope
  version: number
  widgets: WorkspaceWidgetState[]
}
