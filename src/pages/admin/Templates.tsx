import { useAuth } from '../../contexts/AuthContext'
import { AdminOverviewProvider } from '../../contexts/AdminOverviewContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { EmptyState, PageHeader } from '../../components/ui'
import WorkspacePanel from '../../components/dashboard/WorkspacePanel'
import { ASSIGN_WIDGET_DEFINITIONS } from '../../components/dashboard/widgetRegistry'
import { FolderKanban, Shield } from 'lucide-react'

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
  useDocumentTitle('Assign - Checkmark Workspace')
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
        <PageHeader
          icon={FolderKanban}
          title="Assign"
          subtitle="Send out sessions, tasks, or task groups · approve member requests · manage the template library."
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
