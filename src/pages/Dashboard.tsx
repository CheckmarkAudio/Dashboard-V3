import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  ExternalLink,
  FolderUp,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MessageSquareText,
  Plus,
  Sparkles,
} from 'lucide-react'
import { APP_ROUTES } from '../app/routes'
import { MemberOverviewProvider, useMemberOverviewContext } from '../contexts/MemberOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import OverviewScorePreview, { type OverviewScoreId } from '../components/dashboard/OverviewScorePreview'
import OverviewPersonalScheduleCard from '../components/dashboard/OverviewPersonalScheduleCard'
import { MEMBER_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { Button, PageHeader } from '../components/ui'
import MemberHighlights, { SocialStatsBar } from '../components/members/MemberHighlights'
import CreateBookingModal from '../components/CreateBookingModal'
import { supabase } from '../lib/supabase'
import type { MemberWidgetId } from '../domain/workspaces/types'

const MEMBER_SCOPE = 'member_overview' as const
type OverviewViewMode = 'main' | 'widgets'

const OVERVIEW_STAGE_META: Record<
  OverviewScoreId,
  {
    title: string
    icon: typeof ListChecks
    route: string
    widgetId?: MemberWidgetId
  }
> = {
  tasks: {
    title: 'My Tasks',
    icon: ListChecks,
    route: APP_ROUTES.member.tasks,
    widgetId: 'team_tasks',
  },
  messages: {
    title: 'Notifications',
    icon: MessageSquareText,
    route: APP_ROUTES.member.content,
    widgetId: 'forum_notifications',
  },
  sessions: {
    title: 'Sessions',
    icon: CalendarDays,
    route: APP_ROUTES.member.booking,
    widgetId: 'today_calendar',
  },
  media: {
    title: 'Media',
    icon: FolderUp,
    route: APP_ROUTES.member.addMedia,
  },
}

interface OverviewMediaSubmission {
  id: string
  original_filename: string
  drive_view_url: string | null
  created_at: string
  submitter?: { display_name: string | null } | { display_name: string | null }[] | null
}

function BookButton() {
  const { refetch } = useMemberOverviewContext()
  const [showBooking, setShowBooking] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setShowBooking(true)}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 w-full min-w-[180px] rounded-xl bg-gold text-black text-[13px] font-extrabold tracking-tight ring-1 ring-gold-muted hover:bg-gold-muted hover:ring-gold-dim transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-ring"
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

function OverviewActionStrip() {
  return (
    <div
      className="rounded-xl border border-gold/20 bg-gradient-to-r from-gold/10 via-surface to-surface p-2.5 shadow-[0_8px_22px_rgba(0,0,0,0.04)]"
      aria-label="Overview quick actions"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SocialStatsBar variant="compact" />
        <div className="w-full sm:w-[190px]">
          <BookButton />
        </div>
      </div>
    </div>
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
    <div className={['widget-card flex flex-col', className].filter(Boolean).join(' ')}>
      {!definition.hideTitle && (
        <div className="px-4 py-3 widget-frame-head">
          <h3 className="text-[15px] font-bold tracking-tight text-text leading-tight">
            {definition.title}
          </h3>
        </div>
      )}
      <div className="flex-1 min-h-0 p-4">
        <Widget />
      </div>
    </div>
  )
}

function formatMediaDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function mediaSubmitterName(item: OverviewMediaSubmission): string | null {
  if (Array.isArray(item.submitter)) return item.submitter[0]?.display_name ?? null
  return item.submitter?.display_name ?? null
}

function OverviewMediaPanel() {
  const { profile } = useAuth()
  const mediaQuery = useQuery({
    queryKey: ['overview-recent-media', profile?.id ?? 'none'],
    enabled: Boolean(profile?.id),
    queryFn: async (): Promise<OverviewMediaSubmission[]> => {
      const { data, error } = await supabase
        .from('media_submissions')
        .select('id, original_filename, drive_view_url, created_at, submitter:team_members!media_submissions_member_id_fkey(display_name)')
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return (data ?? []) as OverviewMediaSubmission[]
    },
    staleTime: 60_000,
  })

  if (mediaQuery.isLoading) {
    return (
      <div className="widget-card flex min-h-[650px] items-center justify-center text-text-light">
        Loading media
      </div>
    )
  }

  if (mediaQuery.isError) {
    return (
      <div className="widget-card flex min-h-[650px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-amber-400">Could not load media.</p>
          <Link
            to={APP_ROUTES.member.addMedia}
            className="inline-flex items-center justify-center rounded-xl bg-gold px-4 py-2 text-sm font-extrabold text-black shadow-[0_8px_18px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:bg-gold-muted focus-ring"
          >
            Add Media
          </Link>
        </div>
      </div>
    )
  }

  const media = mediaQuery.data ?? []

  return (
    <div className="widget-card flex min-h-[650px] flex-col">
      <div className="flex-1 p-4">
        {media.length === 0 ? (
          <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-border bg-surface-alt/40">
            <Link
              to={APP_ROUTES.member.addMedia}
              className="inline-flex items-center justify-center rounded-xl bg-gold px-4 py-2 text-sm font-extrabold text-black shadow-[0_8px_18px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:bg-gold-muted focus-ring"
            >
              Add Media
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-alt/30">
            {media.map((item) => {
              const submitterName = mediaSubmitterName(item)
              const content = (
                <>
                  <span className="min-w-0 truncate text-sm font-semibold text-text">
                    {item.original_filename}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[12px] font-semibold text-text-muted">
                    {submitterName && (
                      <span className="hidden max-w-[120px] truncate sm:inline">
                        {submitterName}
                      </span>
                    )}
                    <span>{formatMediaDate(item.created_at)}</span>
                  </span>
                </>
              )

              if (!item.drive_view_url) {
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    {content}
                  </div>
                )
              }

              return (
                <a
                  key={item.id}
                  href={item.drive_view_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-hover focus-ring"
                >
                  {content}
                  <ExternalLink
                    size={14}
                    className="shrink-0 text-text-light transition-colors group-hover:text-gold"
                    aria-hidden="true"
                  />
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function renderOverviewStage(scoreId: OverviewScoreId) {
  if (scoreId === 'media') return <OverviewMediaPanel />
  const widgetId = OVERVIEW_STAGE_META[scoreId].widgetId
  if (!widgetId) return null
  return <OverviewWidgetCard id={widgetId} className="min-h-[650px]" />
}

function OverviewMainStage({
  activeScoreId,
  onSelectScore,
}: {
  activeScoreId: OverviewScoreId
  onSelectScore: (id: OverviewScoreId) => void
}) {
  const activeStage = OVERVIEW_STAGE_META[activeScoreId]
  const ActiveIcon = activeStage.icon

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(430px,520px)_minmax(0,1fr)] lg:items-start">
      <div className="space-y-4">
        <OverviewScorePreview activeId={activeScoreId} onSelect={onSelectScore} />
        <OverviewPersonalScheduleCard />
      </div>

      <section className="rounded-xl border border-border bg-gradient-to-br from-surface via-surface to-gold/5">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/25"
              aria-hidden="true"
            >
              <ActiveIcon size={16} strokeWidth={2} />
            </span>
            <h2 className="truncate text-base font-bold text-text">{activeStage.title}</h2>
          </div>
          <Link
            to={activeStage.route}
            className="shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-extrabold text-text-muted transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:text-text focus-ring"
          >
            Open page
          </Link>
        </header>

        <div key={activeScoreId} className="animate-fade-in p-3 sm:p-4">
          {renderOverviewStage(activeScoreId)}
        </div>
      </section>
    </div>
  )
}

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Workspace')
  const { profile, appRole } = useAuth()
  const [viewMode, setViewMode] = useState<OverviewViewMode>('main')
  const [activeScoreId, setActiveScoreId] = useState<OverviewScoreId>('tasks')
  const showingWidgetView = viewMode === 'widgets'

  return (
    <div className="max-w-[1440px] mx-auto animate-fade-in space-y-5">
      <MemberOverviewProvider>
        <PageHeader
          icon={LayoutDashboard}
          title="Overview"
          actions={
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
          }
        />
        <MemberHighlights />
        <OverviewActionStrip />
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
          <OverviewMainStage activeScoreId={activeScoreId} onSelectScore={setActiveScoreId} />
        )}
      </MemberOverviewProvider>
    </div>
  )
}
