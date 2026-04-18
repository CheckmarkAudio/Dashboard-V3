import { useAuth } from '../../contexts/AuthContext'
import { AdminOverviewProvider } from '../../contexts/AdminOverviewContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { EmptyState, PageHeader } from '../../components/ui'
import WorkspacePanel from '../../components/dashboard/WorkspacePanel'
import { WORKSPACE_WIDGET_DEFINITIONS } from '../../components/dashboard/widgetRegistry'
import { UsersRound, Shield } from 'lucide-react'

/**
 * Admin Hub — the landing surface for owners/admins at /admin.
 *
 * Intentionally decoupled from the member Overview: this page ALWAYS
 * renders the `admin_overview` scope. That constant is hardcoded here
 * (not derived from role) so that Overview (`/`) and Hub (`/admin`)
 * can never silently share widgets because of a role-lookup change
 * elsewhere in the code. The two pages have completely separate
 * widget sets and evolve independently.
 *
 * Five widget snapshots arranged in a 3-col grid with mixed row spans:
 *
 *   Row 1: Assign (2×2) · Notifications (1×1)
 *   Row 2: Assign …     · Team          (1×1)
 *   Row 3: Flywheel(2×2)· Approvals     (1×2)
 *   Row 4: Flywheel …   · Approvals …
 *
 * Each widget fetches its own data; `AdminOverviewProvider` wraps the
 * tree so shared queries (team / approvals snapshot) hit one cache.
 * The underlying admin pages (`/admin/team`, `/admin/templates`,
 * `/admin/health`, etc.) still exist for deep work and are reachable
 * from each widget's footer link.
 */
const ADMIN_SCOPE = 'admin_overview' as const

export default function AdminHub() {
  useDocumentTitle('Team Hub - Checkmark Audio')
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

  const definitions = WORKSPACE_WIDGET_DEFINITIONS.filter((widget) =>
    widget.scopes.includes(ADMIN_SCOPE),
  )

  return (
    <AdminOverviewProvider>
      <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in">
        <PageHeader
          icon={UsersRound}
          title="Team Hub"
          subtitle="Assign work, clear approvals, and keep tabs on the studio at a glance."
        />

        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope={ADMIN_SCOPE}
          definitions={definitions}
          showControls={false}
          controlsDescription=""
        />
      </div>
    </AdminOverviewProvider>
  )
}
