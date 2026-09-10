import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Plus, Sparkles } from 'lucide-react'
import { APP_ROUTES } from '../app/routes'
import { MemberOverviewProvider, useMemberOverviewContext } from '../contexts/MemberOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import OverviewScorePreview from '../components/dashboard/OverviewScorePreview'
import OverviewProjectsPanel from '../components/dashboard/OverviewProjectsPanel'
import OverviewMessagesPanel from '../components/dashboard/OverviewMessagesPanel'
import OverviewPersonalScheduleCard from '../components/dashboard/OverviewPersonalScheduleCard'
import { TodayCalendarWidget } from '../components/dashboard/memberOverviewWidgets'
import { MEMBER_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import MyTasksCard from '../components/tasks/MyTasksCard'
import { Button, PageHeader } from '../components/ui'
import MemberHighlights, { SocialStatsBar } from '../components/members/MemberHighlights'
import CreateBookingModal from '../components/CreateBookingModal'

function BookButton() {
  const { refetch } = useMemberOverviewContext()
  const [showBooking, setShowBooking] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setShowBooking(true)}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 min-w-[160px] whitespace-nowrap rounded-xl bg-gold text-black text-[13px] font-extrabold tracking-tight ring-1 ring-gold-muted hover:bg-gold-muted hover:ring-gold-dim transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-ring"
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

function OverviewPanel({ id, kicker, title, to, linkLabel = 'View all', children, bodyClassName = '' }: {
  id: string
  kicker: string
  title: string
  to: string
  linkLabel?: string
  children: ReactNode
  bodyClassName?: string
}) {
  return <section id={id} className="overview-stage overview-permanent-panel" aria-labelledby={`${id}-title`}>
    <header className="flex items-center justify-between gap-4 border-b border-border">
      <div><p className="overview-date mb-3">{kicker}</p><h2 id={`${id}-title`}>{title}</h2></div>
      <Link to={to} className="overview-panel-link focus-ring">{linkLabel} ↗</Link>
    </header>
    <div className={bodyClassName}>{children}</div>
  </section>
}

function OverviewMainStage() {
  const [workView, setWorkView] = useState<'tasks' | 'projects'>('projects')
  const workViews = ['tasks', 'projects'] as const
  return <>
    <OverviewScorePreview onSelect={id => {
      if (id === 'tasks' || id === 'projects') setWorkView(id)
    }} />
    <div className="overview-work-grid">
      <div className="space-y-5 min-w-0">
        <section id="overview-work" className="overview-stage overview-permanent-panel" aria-label="My work">
          <header className="flex items-center justify-between gap-3 border-b border-border">
            <div>
              <p className="overview-date mb-3">{workView === 'projects' ? 'In motion' : 'Your work'}</p>
              <h2>{workView === 'projects' ? 'My Projects' : 'My Tasks'}</h2>
            </div>
            <Link to={workView === 'tasks' ? APP_ROUTES.member.tasks : APP_ROUTES.member.projects}
              className="overview-panel-link focus-ring">View all ↗</Link>
          </header>
              <div className="overview-work-tabs" role="tablist" aria-label="My work">
                {workViews.map((view, index) => <button key={view} type="button" role="tab"
                  id={`overview-${view}-tab`} aria-controls={`overview-${view}-panel`}
                  aria-selected={workView === view} tabIndex={workView === view ? 0 : -1}
                  onClick={() => setWorkView(view)}
                  onKeyDown={event => {
                    let next: typeof workView
                    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = workViews[index === 0 ? 1 : 0]
                    else if (event.key === 'Home') next = 'tasks'
                    else if (event.key === 'End') next = 'projects'
                    else return
                    event.preventDefault()
                    setWorkView(next)
                    document.getElementById(`overview-${next}-tab`)?.focus()
                  }} className="focus-ring">
                  {view === 'tasks' ? 'My Tasks' : 'My Projects'}
                </button>)}
              </div>
          {/* Keep task selections and filters intact when switching views. */}
          <div id="overview-tasks-panel" role="tabpanel" aria-labelledby="overview-tasks-tab"
            hidden={workView !== 'tasks'} className="overview-task-body">
            <MyTasksCard embedded />
          </div>
          <div id="overview-projects-panel" role="tabpanel" aria-labelledby="overview-projects-tab"
            hidden={workView !== 'projects'}>
            <OverviewProjectsPanel />
          </div>
        </section>
        <OverviewPanel id="overview-messages" kicker="Conversations" title="Messages" to={APP_ROUTES.member.content} linkLabel="Open forum" bodyClassName="p-4">
          <OverviewMessagesPanel />
        </OverviewPanel>
      </div>
      <aside className="space-y-5 min-w-0" aria-label="Sessions and today's schedule">
        <OverviewPanel id="overview-sessions" kicker="Today's schedule" title="Sessions" to={APP_ROUTES.member.calendar} linkLabel="Calendar" bodyClassName="p-4">
          <TodayCalendarWidget />
        </OverviewPanel>
        <OverviewPersonalScheduleCard />
      </aside>
    </div>
  </>
}

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Workspace')
  const { profile, appRole } = useAuth()
  const [showingWidgetView, setShowingWidgetView] = useState(false)
  return (
    <div className="overview-page mx-auto animate-fade-in space-y-5">
      <MemberOverviewProvider>
        <p className="overview-date">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · Overview</p>
        <PageHeader className="overview-greeting" title={`Hello, ${profile?.display_name?.split(' ')[0] ?? 'there'}.`}
          actions={<div className="overview-header-actions">
            <Button variant="secondary" onClick={() => setShowingWidgetView(value => !value)}
              iconLeft={showingWidgetView ? <Sparkles size={16} aria-hidden="true" /> : <LayoutGrid size={16} aria-hidden="true" />}>
              {showingWidgetView ? 'Today View' : 'Widget View'}
            </Button>
            <BookButton />
          </div>} />
        <div className="overview-people-row">
          <div className="overview-team"><MemberHighlights /></div>
          <SocialStatsBar variant="compact" />
        </div>
        {showingWidgetView ? <WorkspacePanel role={appRole} userId={profile?.id ?? 'guest'}
          scope="member_overview" definitions={MEMBER_WIDGET_DEFINITIONS} controlsDescription="" showControls={false} /> : <OverviewMainStage />}
      </MemberOverviewProvider>
    </div>
  )
}
