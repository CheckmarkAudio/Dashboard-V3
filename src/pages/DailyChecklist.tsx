import { ListChecks } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { MemberOverviewProvider } from '../contexts/MemberOverviewContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { TASKS_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { PageHeader } from '../components/ui'

/**
 * Tasks page — `/daily`
 *
 * As of PR #7 this page is a widget grid, not a hand-composed 3-card
 * layout. The previous mock `TeamTasksCard` and `StudioTasksCard` are
 * retired here — neither was DB-backed. They'll return as real widgets
 * when their data-layer work is done.
 *
 * Current widgets on this page (via `defaultPlacements: 'member_tasks'`
 * in registry.ts):
 *   - team_tasks      → `MyTasksCard` (shared with Overview via MyTasksContext)
 *   - assigned_tasks  → `AssignedTasksWidget` (admin-assigned tasks)
 *
 * Same admin/member invariant as the Overview page: TypeScript rejects
 * any admin widget from ever landing here via the disjoint
 * MemberWidgetId / AdminWidgetId unions.
 *
 * Why the file is still named `DailyChecklist.tsx`: the route at
 * `/daily` imports this file; renaming is a cosmetic follow-up.
 */
const TASKS_SCOPE = 'member_tasks' as const

export default function DailyChecklist() {
  useDocumentTitle('Tasks - Checkmark Workspace')
  const { profile, appRole } = useAuth()

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <PageHeader
        icon={ListChecks}
        title="Tasks"
        subtitle="Your work for today — personal checklist and anything admin has assigned to you directly."
      />
      {/* MemberOverviewProvider wraps so `team_tasks` → MyTasksCard gets
          the same snapshot-preloaded state as the Overview page. */}
      <MemberOverviewProvider>
        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope={TASKS_SCOPE}
          definitions={TASKS_WIDGET_DEFINITIONS}
          controlsDescription="Reorder or hide widgets on this page."
          showControls={false}
        />
      </MemberOverviewProvider>
    </div>
  )
}
