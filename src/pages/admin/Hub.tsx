import { useAuth } from '../../contexts/AuthContext'
import { AdminOverviewProvider } from '../../contexts/AdminOverviewContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { EmptyState, PageHeader } from '../../components/ui'
import WorkspacePanel from '../../components/dashboard/WorkspacePanel'
import { WORKSPACE_WIDGET_DEFINITIONS } from '../../components/dashboard/widgetRegistry'
import { getWorkspaceScopeForRole } from '../../domain/workspaces/registry'
import { UsersRound, Shield } from 'lucide-react'

/**
 * Admin Hub — the landing surface for owners/admins at /admin.
 *
 * Five widget snapshots arranged in a 3-col grid with mixed row spans:
 *
 *   Row 1: Assign (2×2) · Notifications (1×1)
 *   Row 2: Assign …     · Team          (1×1)
 *   Row 3: Flywheel(2×2)· Approvals     (1×2)
 *   Row 4: Flywheel …   · Approvals …
 *
 * The widget definitions live in `domain/workspaces/registry.ts` with
 * `admin_overview` scope. Each widget fetches its own data; the
 * `AdminOverviewProvider` wraps the tree so widgets that need the
 * shared team / approvals snapshot (e.g. AdminApprovalsWidget) share
 * the same cache entry instead of each re-fetching independently.
 *
 * The old tabbed Hub (member-rail / Tasks / Approvals / Calendar tabs)
 * was replaced here when the Overview refresh landed in April 2026 —
 * the widgets cover the same surfaces with a cleaner, at-a-glance
 * layout. The underlying admin pages (`/admin/team`, `/admin/templates`,
 * `/admin/health`, etc.) still exist for deep work and are reachable
 * from each widget's footer link.
 */
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

  const scope = getWorkspaceScopeForRole(appRole)
  const definitions = WORKSPACE_WIDGET_DEFINITIONS.filter((widget) => widget.scopes.includes(scope))

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
          scope={scope}
          definitions={definitions}
          showControls={false}
          controlsDescription=""
        />
      </div>
    </AdminOverviewProvider>
  )
}
