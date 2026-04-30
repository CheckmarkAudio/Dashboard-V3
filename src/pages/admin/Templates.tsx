import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { AdminOverviewProvider } from '../../contexts/AdminOverviewContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { EmptyState, PageHeader } from '../../components/ui'
import WorkspacePanel from '../../components/dashboard/WorkspacePanel'
import { ASSIGN_WIDGET_DEFINITIONS } from '../../components/dashboard/widgetRegistry'
import { APP_ROUTES } from '../../app/routes'
import { ArrowLeft, Archive, FolderKanban, Shield } from 'lucide-react'

/**
 * Assign page — `/admin/templates`
 *
 * PR #29 — runs on `WorkspacePanel` (same grammar as Overview, Hub,
 * Tasks). Default widgets:
 *   - Assign (3-tile Session / Task / Task Group)
 *   - Task Requests (member-submitted approval queue)
 *   - Templates (library + filters + search + New button)
 *
 * All widgets are span: 1 — equal-width columns. Drag to reorder,
 * click title to expand, show/hide via the controls.
 *
 * The admin gate is hardcoded the same way Hub's is — member widgets
 * cannot appear here via a registry mistake.
 */
const ASSIGN_SCOPE = 'admin_assign' as const

export default function Templates() {
  // PR #54 — page title explicitly says "Legacy" so the browser tab
  // is unambiguous when the user has both the new + legacy Assign
  // pages open at once.
  useDocumentTitle('Assign (Legacy widgets) - Checkmark Workspace')
  const { isAdmin, appRole, profile } = useAuth()

  if (!isAdmin) {
    return (
      <EmptyState
        icon={Shield}
        title="Admins only"
        description="The Assign workspace is reserved for team admins and owners."
      />
    )
  }

  return (
    <AdminOverviewProvider>
      <div className="max-w-[1440px] mx-auto space-y-6 animate-fade-in">
        {/* PR #54 — high-visibility "LEGACY" banner so the user can
            confirm at a glance which page they've landed on. The new
            member-centric Assign page lives at /admin/templates; this
            page is the preserved widget-grid layout for reference
            during the planned tabs integration. */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-500/12 ring-1 ring-amber-500/30 text-amber-200">
          <div className="flex items-center gap-2.5">
            <Archive size={16} aria-hidden="true" />
            <div>
              <p className="text-[13px] font-bold tracking-tight">Legacy widget-based Assign</p>
              <p className="text-[11px] text-amber-200/80">
                Preserved view at <code className="px-1 py-0.5 rounded bg-black/20 text-[10px]">/admin/assign-classic</code>.
                The current Assign page lives at <code className="px-1 py-0.5 rounded bg-black/20 text-[10px]">/admin/templates</code>.
              </p>
            </div>
          </div>
          <Link
            to={APP_ROUTES.admin.templates}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 ring-1 ring-amber-500/40 text-amber-100 text-[12px] font-semibold hover:bg-amber-500/30 transition-colors"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            Back to Assign
          </Link>
        </div>

        <PageHeader
          icon={FolderKanban}
          title="Assign — Legacy view"
        />
        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope={ASSIGN_SCOPE}
          definitions={ASSIGN_WIDGET_DEFINITIONS}
          // PR #31 — controls bar hidden; drag-reorder + expand-to-modal
          // still work via each widget's frame.
          controlsDescription=""
          showControls={false}
        />
      </div>
    </AdminOverviewProvider>
  )
}
