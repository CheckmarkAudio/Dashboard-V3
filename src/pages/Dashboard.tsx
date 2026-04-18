import { LayoutDashboard } from 'lucide-react'
import { MemberOverviewProvider } from '../contexts/MemberOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { WORKSPACE_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { PageHeader } from '../components/ui'

/**
 * Member Overview — `/`
 *
 * Intentionally decoupled from role: this page ALWAYS renders the
 * `member_overview` scope, regardless of whether the viewer is a
 * member, admin, or owner. Admins who want the admin Hub have a
 * dedicated `/admin` route (see `src/pages/admin/Hub.tsx`). Keeping
 * the scope hardcoded here means the two pages can evolve
 * independently and will not overwrite each other when one is
 * redesigned.
 */
const MEMBER_SCOPE = 'member_overview' as const

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Audio')
  const { profile, appRole } = useAuth()
  const scopedDefinitions = WORKSPACE_WIDGET_DEFINITIONS.filter((widget) =>
    widget.scopes.includes(MEMBER_SCOPE),
  )

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
        subtitle="Your day at a glance: what needs attention, what is booked, and what still needs to be finished today."
      />
      <MemberOverviewProvider>
        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope={MEMBER_SCOPE}
          definitions={scopedDefinitions}
          controlsDescription="Reorder or hide widgets."
          // Big controls box removed per design direction. A tiny gear/menu
          // affordance for show/hide will land alongside drag-and-drop in a
          // follow-up. For now the layout is fixed.
          showControls={false}
        />
      </MemberOverviewProvider>
    </div>
  )
}
