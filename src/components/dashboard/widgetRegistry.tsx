import type { WorkspaceWidgetDefinition } from '../../domain/workspaces/types'
import { WORKSPACE_WIDGET_REGISTRATIONS } from '../../domain/workspaces/registry'
import {
  FlywheelSummaryWidget,
  TeamSnapshotWidget,
  TeamTasksWidget,
  TodayCalendarWidget,
} from './memberOverviewWidgets'
import {
  AdminScheduleWidget,
  AdminShortcutsWidget,
  ApprovalQueueWidget,
  TeamFocusWidget,
} from './adminOverviewWidgets'

const widgetComponents: Record<WorkspaceWidgetDefinition['id'], WorkspaceWidgetDefinition['component']> = {
  team_snapshot: TeamSnapshotWidget,
  today_calendar: TodayCalendarWidget,
  team_tasks: TeamTasksWidget,
  flywheel_summary: FlywheelSummaryWidget,
  team_focus: TeamFocusWidget,
  approval_queue: ApprovalQueueWidget,
  admin_schedule: AdminScheduleWidget,
  admin_shortcuts: AdminShortcutsWidget,
}

export const WORKSPACE_WIDGET_DEFINITIONS: WorkspaceWidgetDefinition[] =
  WORKSPACE_WIDGET_REGISTRATIONS.map((registration) => ({
    ...registration,
    component: widgetComponents[registration.id],
  }))
