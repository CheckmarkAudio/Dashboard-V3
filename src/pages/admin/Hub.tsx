import { useAuth } from '../../contexts/AuthContext'
import { AdminOverviewProvider } from '../../contexts/AdminOverviewContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { EmptyState, PageHeader } from '../../components/ui'
import WorkspacePanel from '../../components/dashboard/WorkspacePanel'
import { ADMIN_WIDGET_DEFINITIONS } from '../../components/dashboard/widgetRegistry'
import { UsersRound, Shield } from 'lucide-react'

/**
 * Admin Hub — `/admin`
 *
 * PR #29 — back on `WorkspacePanel` with the 3-column equal-width
 * grid. Every admin widget is span: 1 so drag-reorder keeps columns
 * uniform. Default widgets: Quick Assign · Notifications · Flywheel ·
 * Team · Task Requests (all draggable, all expandable).
 *
 * `isAdmin` gate still hardcoded here — member widgets cannot leak
 * onto this page via a registry mistake.
 */
const ADMIN_SCOPE = 'admin_overview' as const

export default function AdminHub() {
  useDocumentTitle('Dashboard - Checkmark Workspace')
  const { isAdmin, appRole, profile } = useAuth()

  if (!isAdmin) {
    return (
      <EmptyState
        icon={Shield}
        title="Admins only"
        description="This workspace is reserved for team admins and owners."
      />
    )
  }

  return (
    <AdminOverviewProvider>
      <div className="max-w-[1440px] mx-auto space-y-6 animate-fade-in">
        <PageHeader
          icon={UsersRound}
          title="Dashboard"
          subtitle="Assign work, clear approvals, and keep tabs on the studio at a glance."
        />
        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope={ADMIN_SCOPE}
          definitions={ADMIN_WIDGET_DEFINITIONS}
          controlsTitle="Arrange the Hub"
          controlsDescription="Drag a widget's grip to reorder · click title to expand · hide widgets you don't need."
          showControls
        />
      </div>
    </AdminOverviewProvider>
  )
}
