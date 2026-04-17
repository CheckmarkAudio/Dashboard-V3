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
 * Picks the right data provider for the Overview scope. Member widgets
 * consume `MemberOverviewContext`; admin widgets consume
 * `AdminOverviewContext`. Wrapping unconditionally in both would cause
 * duplicate fetches for admins, so we switch on scope at the provider
 * boundary instead.
 */
function ScopedOverviewProvider({ scope, children }: { scope: WorkspaceScope; children: ReactNode }) {
  if (scope === 'admin_overview') {
    return <AdminOverviewProvider>{children}</AdminOverviewProvider>
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
          controlsDescription="Reorder or hide widgets — personalized layouts are an admin-only affordance. Member overview stays fixed to keep daily focus."
          // Per product direction: members get a focused, non-modular
          // daily Overview (ADHD-friendly, one-view-fits-all). Admins
          // keep the modular widget customization affordance since
          // "modular = admin" per the rebuild vision.
          showControls={scope === 'admin_overview'}
        />
      </ScopedOverviewProvider>
    </div>
  )
}
