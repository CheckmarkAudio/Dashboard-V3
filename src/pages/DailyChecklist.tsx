import { ListChecks } from 'lucide-react'
import { MemberOverviewProvider } from '../contexts/MemberOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { MEMBER_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { PageHeader } from '../components/ui'

/**
 * Tasks page — `/daily`
 *
 * PR #29 — runs on `WorkspacePanel` (same grammar as Overview / Hub /
 * Assign). Default widgets: My Tasks · Studio Tasks · Team Tasks —
 * all equal-width, all draggable.
 *
 * File name stays `DailyChecklist` for backward compat with route
 * mapping; the page title + scope are 'Tasks' / 'member_tasks'.
 */
const TASKS_SCOPE = 'member_tasks' as const

export default function DailyChecklist() {
  useDocumentTitle('Tasks - Checkmark Workspace')
  const { profile, appRole } = useAuth()

  return (
    <div className="max-w-[1440px] mx-auto animate-fade-in space-y-6">
      <PageHeader
        icon={ListChecks}
        title="Tasks"
        subtitle="My Tasks · Studio · Team — drag to rearrange, click a title to expand."
      />
      <MemberOverviewProvider>
        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope={TASKS_SCOPE}
          definitions={MEMBER_WIDGET_DEFINITIONS}
          controlsTitle="Arrange your Tasks view"
          controlsDescription="Drag a widget's grip to reorder · click title to expand · hide widgets you don't need."
          showControls
        />
      </MemberOverviewProvider>
    </div>
  )
}
