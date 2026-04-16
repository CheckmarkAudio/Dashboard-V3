import { LayoutDashboard } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { WORKSPACE_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { getWorkspaceScopeForRole } from '../domain/workspaces/registry'
import { PageHeader } from '../components/ui'

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Audio')
  const { profile, appRole } = useAuth()
  const scope = getWorkspaceScopeForRole(appRole)
  const memberDefinitions = WORKSPACE_WIDGET_DEFINITIONS.filter((widget) => widget.scopes.includes(scope))

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
        subtitle="Your personalized studio workspace. Reorder panels now; richer widget controls come next."
      />
      <WorkspacePanel
        role={appRole}
        userId={profile?.id ?? 'guest'}
        scope={scope}
        definitions={memberDefinitions}
        controlsDescription="This is the start of the widget system. Widgets are now registered, persisted per user, and ready for deeper customization."
      />
    </div>
  )
}
