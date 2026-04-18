import { LayoutDashboard } from 'lucide-react'
import { MemberOverviewProvider } from '../contexts/MemberOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { MEMBER_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { PageHeader } from '../components/ui'

/**
 * Member Overview — `/`
 *
 * ALWAYS renders the member widget set. It imports
 * MEMBER_WIDGET_DEFINITIONS directly from widgetRegistry — there is
 * no role lookup, no scope filter, no way for admin widgets to sneak
 * in. The types of MEMBER_WIDGET_DEFINITIONS reject any id that is
 * not a MemberWidgetId at compile time.
 *
 * If you want to add a widget here, add it to
 * `MEMBER_WIDGET_REGISTRATIONS` in domain/workspaces/registry.ts with
 * a MemberWidgetId. Anything admin-shaped lands in Hub.tsx, never
 * here.
 */
const MEMBER_SCOPE = 'member_overview' as const

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Audio')
  const { profile, appRole } = useAuth()

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
          definitions={MEMBER_WIDGET_DEFINITIONS}
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
