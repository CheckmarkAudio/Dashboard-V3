import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { AdminOverviewProvider } from '../../contexts/AdminOverviewContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { Button, EmptyState, PageHeader } from '../../components/ui'
import WorkspacePanel from '../../components/dashboard/WorkspacePanel'
import { ADMIN_WIDGET_DEFINITIONS } from '../../components/dashboard/widgetRegistry'
import MemberHighlights, { SocialStatsBar } from '../../components/members/MemberHighlights'
import QuickAssignModal from '../../components/admin/QuickAssignModal'
import { AdminSectionNavItem, type AdminSection } from '../../components/admin/AdminSectionNavItem'
import type { AdminWidgetId } from '../../domain/workspaces/types'
import {
  Bell,
  CalendarRange,
  ClipboardList,
  LayoutGrid,
  Shield,
  UsersRound,
  Zap,
} from 'lucide-react'

type DashboardPaneId = 'command' | 'requests' | 'schedule' | 'alerts'
type DashboardViewMode = 'command' | 'widgets'
type DashboardPane = AdminSection<DashboardPaneId>

const DASHBOARD_PANES: DashboardPane[] = [
  {
    key: 'command',
    title: 'Command',
    subtitle: 'Requests, schedule, alerts',
    icon: Zap,
  },
  {
    key: 'requests',
    title: 'Requests',
    subtitle: 'Task changes to review',
    icon: ClipboardList,
  },
  {
    key: 'schedule',
    title: 'Schedule',
    subtitle: 'Who is working this week',
    icon: CalendarRange,
  },
  {
    key: 'alerts',
    title: 'Alerts',
    subtitle: 'Unread channels and updates',
    icon: Bell,
  },
]

const DEFAULT_DASHBOARD_PANE = DASHBOARD_PANES[0]!

/**
 * QuickAssignButton — gold pill bubble in the Dashboard's PageHeader
 * actions slot. Mirrors the BookButton pattern on the Overview page
 * (same chrome, same spot) so the two surfaces feel like siblings.
 *
 * Hover/focus shakes the lightning bolt (`.icon-shake-on-hover` →
 * `.icon-shake-target` keyframe in index.css) — the only ornamental
 * detail; the rest of the bubble matches Book a Session exactly.
 */
function QuickAssignButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // 2026-05-06 — width matched to BookButton (248px = 4×w-14
        // social bubbles + 3×gap-2) so the two CTAs read as siblings
        // across Overview + Hub.
        className="icon-shake-on-hover inline-flex items-center justify-center gap-2 h-10 px-4 w-[248px] rounded-2xl bg-gold text-black text-[13px] font-extrabold tracking-tight ring-1 ring-gold-muted hover:bg-gold-muted hover:ring-gold-dim transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-ring"
      >
        <Zap
          size={14}
          strokeWidth={2.4}
          className="icon-shake-target fill-black"
          aria-hidden="true"
        />
        Quick Assign
      </button>
      {open && <QuickAssignModal onClose={() => setOpen(false)} />}
    </>
  )
}

function AdminHubWidgetCard({
  id,
  className = '',
}: {
  id: AdminWidgetId
  className?: string
}) {
  const definition = ADMIN_WIDGET_DEFINITIONS.find((widget) => widget.id === id)
  if (!definition) return null
  const Widget = definition.component
  return (
    <div className={['widget-card flex flex-col overflow-hidden', className].filter(Boolean).join(' ')}>
      {!definition.hideTitle && (
        <div className="px-4 py-3 widget-frame-head">
          <h3 className="text-[15px] font-bold tracking-tight text-text leading-tight">
            {definition.title}
          </h3>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <Widget />
      </div>
    </div>
  )
}

function renderDashboardPane(paneId: DashboardPaneId) {
  switch (paneId) {
    case 'requests':
      return <AdminHubWidgetCard id="admin_task_requests" className="min-h-[620px]" />
    case 'schedule':
      return <AdminHubWidgetCard id="admin_employee_schedule" className="min-h-[620px]" />
    case 'alerts':
      return <AdminHubWidgetCard id="admin_notifications" className="min-h-[620px]" />
    case 'command':
    default:
      return (
        <div className="grid gap-4 xl:grid-cols-3">
          <AdminHubWidgetCard id="admin_task_requests" className="min-h-[520px]" />
          <AdminHubWidgetCard id="admin_employee_schedule" className="min-h-[520px]" />
          <AdminHubWidgetCard id="admin_notifications" className="min-h-[520px]" />
        </div>
      )
  }
}

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
  const [viewMode, setViewMode] = useState<DashboardViewMode>('command')
  const [activePaneId, setActivePaneId] = useState<DashboardPaneId>('command')
  const activePane =
    DASHBOARD_PANES.find((pane) => pane.key === activePaneId) ?? DEFAULT_DASHBOARD_PANE
  const ActiveIcon = activePane.icon
  const showingWidgetView = viewMode === 'widgets'

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
      <div className="max-w-[1440px] mx-auto space-y-3 animate-fade-in">
        {/* Skin pass 2026-05-06 (rev2) — re-swapped per user direction:
            SocialStatsBar moves BACK UP to the PageHeader actions slot;
            Quick Assign moves DOWN beside the member panel. Quick Assign
            is now w-[248px] (matched to BookButton + the social bubble
            cluster) so the swap doesn't shrink the affordance. */}
        <PageHeader
          icon={UsersRound}
          title="Dashboard"
          actions={
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
              <SocialStatsBar />
              <Button
                variant="secondary"
                onClick={() => setViewMode(showingWidgetView ? 'command' : 'widgets')}
                iconLeft={
                  showingWidgetView
                    ? <Zap size={16} aria-hidden="true" />
                    : <LayoutGrid size={16} aria-hidden="true" />
                }
              >
                {showingWidgetView ? 'Command View' : 'Widget View'}
              </Button>
            </div>
          }
        />
        {/* Lean 7 (PR #78) — instagram-story-style member bubbles
            above the widget grid, mirroring the member Overview
            pattern from PR #61. Same component, same query cache. */}
        <MemberHighlights actions={<QuickAssignButton />} />
        {showingWidgetView ? (
          <WorkspacePanel
            role={appRole}
            userId={profile?.id ?? 'guest'}
            scope={ADMIN_SCOPE}
            definitions={ADMIN_WIDGET_DEFINITIONS}
            // PR #31 — controls bar hidden; drag-reorder + expand-to-modal
            // still work via each widget's frame.
            controlsDescription=""
            showControls={false}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-stretch">
            <aside
              className="bg-surface rounded-xl border border-border p-2 space-y-1 h-full"
              aria-label="Dashboard sections"
            >
              <p className="px-3 pt-3 pb-2 text-label">Dashboard</p>
              {DASHBOARD_PANES.map((pane) => (
                <AdminSectionNavItem
                  key={pane.key}
                  section={pane}
                  active={activePane.key === pane.key}
                  onSelect={() => setActivePaneId(pane.key)}
                />
              ))}
            </aside>

            <section className="bg-surface rounded-xl border border-border lg:min-h-[620px] overflow-hidden">
              <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-border">
                <div className="min-w-0 flex items-center gap-3">
                  <span
                    className="shrink-0 w-9 h-9 rounded-lg bg-surface-alt ring-1 ring-border flex items-center justify-center text-gold"
                    aria-hidden="true"
                  >
                    <ActiveIcon size={16} strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-text truncate">{activePane.title}</h2>
                    <p className="text-[12px] text-text-muted truncate">{activePane.subtitle}</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold text-text-muted ring-1 ring-border">
                  <Shield size={12} aria-hidden="true" />
                  Command view
                </span>
              </header>

              <div className="p-3 sm:p-4 lg:min-h-[560px] lg:h-[calc(100vh-15rem)] lg:max-h-[900px] overflow-auto">
                {renderDashboardPane(activePane.key)}
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminOverviewProvider>
  )
}
