import type { ReactNode } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { MemberOverviewProvider } from '../contexts/MemberOverviewContext'
import { AdminOverviewProvider } from '../contexts/AdminOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { WORKSPACE_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { getWorkspaceScopeForRole } from '../domain/workspaces/registry'
import type { WorkspaceScope } from '../domain/workspaces/types'
import { PageHeader } from '../components/ui'

/**
 * Picks the data providers for the Overview scope.
 *
 * Member scope: only MemberOverviewProvider (lighter — just member's own data).
 * Admin scope: BOTH providers nested. The admin Overview now renders both
 * admin-specific widgets (TeamFocus, ApprovalQueue, AdminShortcuts) AND
 * the cross-scoped design-system widgets (MyTasks, TodayCalendar, TeamActivity)
 * that read from MemberOverviewContext for the admin's own daily data.
 *
 * Trade-off: admins pay for one extra provider's queries. Acceptable until
 * the admin Overview gets its own admin-versions of the new widgets.
 */
function ScopedOverviewProvider({ scope, children }: { scope: WorkspaceScope; children: ReactNode }) {
  if (scope === 'admin_overview') {
    return (
      <AdminOverviewProvider>
        <MemberOverviewProvider>{children}</MemberOverviewProvider>
      </AdminOverviewProvider>
    )
  }
  return <MemberOverviewProvider>{children}</MemberOverviewProvider>
}

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Audio')
  const { profile, appRole } = useAuth()
  const scope = getWorkspaceScopeForRole(appRole)
  const scopedDefinitions = WORKSPACE_WIDGET_DEFINITIONS.filter((widget) => widget.scopes.includes(scope))

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
        subtitle="Your day at a glance: what needs attention, what is booked, and what still needs to be finished today."
      />
      <ScopedOverviewProvider scope={scope}>
        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope={scope}
          definitions={scopedDefinitions}
          controlsDescription="Reorder or hide widgets."
          // Big controls box removed per design direction. A tiny gear/menu
          // affordance for show/hide will land alongside drag-and-drop in a
          // follow-up. For now the layout is fixed for both scopes.
          showControls={false}
        />
      </ScopedOverviewProvider>
    </div>
  )
}
