import { useState } from 'react'
import {
  CalendarDays,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MessageSquareText,
  Plus,
  Sparkles,
} from 'lucide-react'
import { MemberOverviewProvider, useMemberOverviewContext } from '../contexts/MemberOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { MEMBER_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { Button, PageHeader } from '../components/ui'
import MemberHighlights, { SocialStatsBar } from '../components/members/MemberHighlights'
import CreateBookingModal from '../components/CreateBookingModal'
import { AdminSectionNavItem, type AdminSection } from '../components/admin/AdminSectionNavItem'
import type { MemberWidgetId } from '../domain/workspaces/types'

const MEMBER_SCOPE = 'member_overview' as const
type OverviewPaneId = 'today' | 'my_tasks' | 'calendar' | 'messages'
type OverviewViewMode = 'main' | 'widgets'
type OverviewPane = AdminSection<OverviewPaneId>

const OVERVIEW_PANES: OverviewPane[] = [
  {
    key: 'today',
    title: 'Today',
    subtitle: 'Tasks, calendar, messages',
    icon: Sparkles,
  },
  {
    key: 'my_tasks',
    title: 'My Tasks',
    subtitle: 'Your personal queue',
    icon: ListChecks,
  },
  {
    key: 'calendar',
    title: 'Calendar',
    subtitle: 'Today in the studio',
    icon: CalendarDays,
  },
  {
    key: 'messages',
    title: 'Messages',
    subtitle: 'Unread team updates',
    icon: MessageSquareText,
  },
]

const DEFAULT_OVERVIEW_PANE = OVERVIEW_PANES[0]!

/**
 * BookButton — local CTA pill rendered to the right of the member
 * panel via MemberHighlights' `actions` slot. Same gold pill chrome
 * as the Sessions page Book a Session button so the action looks
 * consistent across surfaces. Refetches the member-overview context
 * on close so any newly-created booking lights up its widget.
 */
function BookButton() {
  const { refetch } = useMemberOverviewContext()
  const [showBooking, setShowBooking] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setShowBooking(true)}
        // 2026-05-06 — width fixed to 248px (= 4×w-14 bubbles + 3×gap-2)
        // so the CTA spans the exact same length as the SocialStatsBar
        // sitting beneath it. Sitewide treatment per user direction.
        className="inline-flex items-center justify-center gap-2 h-10 px-4 w-[248px] rounded-2xl bg-gold text-black text-[13px] font-extrabold tracking-tight ring-1 ring-gold-muted hover:bg-gold-muted hover:ring-gold-dim transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-ring"
      >
        <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
        Book a Session
      </button>
      {showBooking && (
        <CreateBookingModal
          onClose={() => {
            setShowBooking(false)
            void refetch()
          }}
        />
      )}
    </>
  )
}

function OverviewWidgetCard({
  id,
  className = '',
}: {
  id: MemberWidgetId
  className?: string
}) {
  const definition = MEMBER_WIDGET_DEFINITIONS.find((widget) => widget.id === id)
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

function renderOverviewPane(paneId: OverviewPaneId) {
  switch (paneId) {
    case 'my_tasks':
      return <OverviewWidgetCard id="team_tasks" className="min-h-[560px]" />
    case 'calendar':
      return <OverviewWidgetCard id="today_calendar" className="min-h-[620px]" />
    case 'messages':
      return <OverviewWidgetCard id="forum_notifications" className="min-h-[620px]" />
    case 'today':
    default:
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          <OverviewWidgetCard id="team_tasks" className="min-h-[420px]" />
          <OverviewWidgetCard id="today_calendar" className="min-h-[420px]" />
          <OverviewWidgetCard id="forum_notifications" className="min-h-[360px] xl:col-span-2" />
        </div>
      )
  }
}

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Workspace')
  const { profile, appRole } = useAuth()
  const [viewMode, setViewMode] = useState<OverviewViewMode>('main')
  const [activePaneId, setActivePaneId] = useState<OverviewPaneId>('today')
  const activePane = OVERVIEW_PANES.find((pane) => pane.key === activePaneId) ?? DEFAULT_OVERVIEW_PANE
  const ActiveIcon = activePane.icon
  const showingWidgetView = viewMode === 'widgets'

  return (
    <div className="max-w-[1440px] mx-auto animate-fade-in space-y-5">
      <MemberOverviewProvider>
        {/* Skin pass 2026-05-06 (rev2) — re-swapped per user direction:
            SocialStatsBar moves BACK UP to the PageHeader actions slot
            (top-right next to the title); Book a Session moves DOWN
            beside the member panel. Width parity is preserved — Book a
            Session is w-[248px] which matches the SocialStatsBar's
            cluster width exactly, so neither slot looks cramped. */}
        <PageHeader
          icon={LayoutDashboard}
          title="Overview"
          actions={
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
              <SocialStatsBar />
              <Button
                variant="secondary"
                onClick={() => setViewMode(showingWidgetView ? 'main' : 'widgets')}
                iconLeft={
                  showingWidgetView
                    ? <Sparkles size={16} aria-hidden="true" />
                    : <LayoutGrid size={16} aria-hidden="true" />
                }
              >
                {showingWidgetView ? 'Today View' : 'Widget View'}
              </Button>
            </div>
          }
        />
        <MemberHighlights actions={<BookButton />} />
        {showingWidgetView ? (
          <WorkspacePanel
            role={appRole}
            userId={profile?.id ?? 'guest'}
            scope={MEMBER_SCOPE}
            definitions={MEMBER_WIDGET_DEFINITIONS}
            controlsDescription=""
            showControls={false}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-stretch">
            <aside
              className="bg-gradient-to-b from-surface to-gold/5 rounded-xl border border-border p-2 space-y-1 h-full"
              aria-label="Overview sections"
            >
              <p className="px-3 pt-3 pb-2 text-label">Overview</p>
              {OVERVIEW_PANES.map((pane) => (
                <AdminSectionNavItem
                  key={pane.key}
                  section={pane}
                  active={activePane.key === pane.key}
                  onSelect={() => setActivePaneId(pane.key)}
                />
              ))}
            </aside>

            <section className="bg-gradient-to-br from-surface via-surface to-gold/5 rounded-xl border border-border lg:min-h-[620px] overflow-hidden">
              <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-border">
                <div className="min-w-0 flex items-center gap-3">
                  <span
                    className="shrink-0 w-9 h-9 rounded-lg bg-gold/10 ring-1 ring-gold/25 flex items-center justify-center text-gold"
                    aria-hidden="true"
                  >
                    <ActiveIcon size={16} strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-text truncate">{activePane.title}</h2>
                    <p className="text-[12px] text-text-muted truncate">{activePane.subtitle}</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold">
                  <Sparkles size={12} aria-hidden="true" />
                  Personal view
                </span>
              </header>

              <div className="p-3 sm:p-4 lg:min-h-[560px] lg:h-[calc(100vh-15rem)] lg:max-h-[900px] overflow-auto">
                {renderOverviewPane(activePane.key)}
              </div>
            </section>
          </div>
        )}
      </MemberOverviewProvider>
    </div>
  )
}
