import type { WorkspaceWidgetDefinition } from '../../domain/workspaces/types'
import { WORKSPACE_WIDGET_REGISTRATIONS } from '../../domain/workspaces/registry'
import {
  BookingSnapshotWidget,
  FlywheelSummaryWidget,
  ForumNotificationsWidget,
  TeamActivityWidget,
  TeamDirectoryWidget,
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
import {
  AdminApprovalsWidget,
  AdminAssignWidget,
  AdminFlywheelWidget,
  AdminNotificationsWidget,
  AdminTeamWidget,
} from './adminHubWidgets'

const widgetComponents: Record<WorkspaceWidgetDefinition['id'], WorkspaceWidgetDefinition['component']> = {
  team_snapshot: TeamSnapshotWidget,
  today_calendar: TodayCalendarWidget,
  team_tasks: TeamTasksWidget,
  team_activity: TeamActivityWidget,
  team_directory: TeamDirectoryWidget,
  booking_snapshot: BookingSnapshotWidget,
  forum_notifications: ForumNotificationsWidget,
  flywheel_summary: FlywheelSummaryWidget,
  team_focus: TeamFocusWidget,
  approval_queue: ApprovalQueueWidget,
  admin_schedule: AdminScheduleWidget,
  admin_shortcuts: AdminShortcutsWidget,
  admin_assign: AdminAssignWidget,
  admin_notifications: AdminNotificationsWidget,
  admin_team: AdminTeamWidget,
  admin_flywheel: AdminFlywheelWidget,
  admin_approvals: AdminApprovalsWidget,
}

export const WORKSPACE_WIDGET_DEFINITIONS: WorkspaceWidgetDefinition[] =
  WORKSPACE_WIDGET_REGISTRATIONS.map((registration) => ({
    ...registration,
    component: widgetComponents[registration.id],
  }))
