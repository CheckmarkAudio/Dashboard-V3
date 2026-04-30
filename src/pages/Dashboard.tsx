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
 * PR #29 — back on `WorkspacePanel` with the 3-column equal-width
 * grid. Every widget occupies exactly one column cell (span: 1) so
 * drag-reorder is predictable: a widget always drops into a uniform
 * slot, columns never shift, and rearranging feels fluid.
 *
 * Widget heights flex to content via `auto-rows-min`. A taller
 * widget (My Tasks with 12 rows) doesn't force the Booking widget
 * to be equally tall.
 *
 * Expand-to-modal comes free through `DashboardWidgetFrame` — click
 * a widget title or the maximize icon to open it as a floating
 * detail modal (click backdrop / Esc to close).
 */
const MEMBER_SCOPE = 'member_overview' as const

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Workspace')
  const { profile, appRole } = useAuth()

  return (
    <div className="max-w-[1440px] mx-auto animate-fade-in space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
      />
      <MemberOverviewProvider>
        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope={MEMBER_SCOPE}
          definitions={MEMBER_WIDGET_DEFINITIONS}
          // PR #31 — controls bar hidden. Drag-reorder + expand-to-modal
          // still work via each widget's frame. All widgets stay visible
          // by default until we want a hide-surface again.
          controlsDescription=""
          showControls={false}
        />
      </MemberOverviewProvider>
    </div>
  )
}
