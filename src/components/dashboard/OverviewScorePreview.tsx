import { useQuery } from '@tanstack/react-query'
import {
  BriefcaseBusiness,
  CheckSquare,
  FolderKanban,
  MessageCircle,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useMemberOverviewContext } from '../../contexts/MemberOverviewContext'
import { localDateKey } from '../../lib/dates'
import { fetchMemberAssignedTasks } from '../../lib/queries/assignments'
import type { AssignedTask } from '../../types/assignments'
import { useOverviewProjects } from './OverviewProjectsPanel'
import { useDmThreads } from '../messages/useDmThreads'

export type OverviewScoreId = 'tasks' | 'projects' | 'messages' | 'sessions'

function OverviewScoreCard({
  id, label, value, total, icon: Icon, loading = false, error = false, onSelect,
}: {
  id: OverviewScoreId
  label: string
  value: number
  total?: number
  icon: typeof CheckSquare
  loading?: boolean
  error?: boolean
  onSelect?: (id: OverviewScoreId) => void
}) {
  return (
    <a href={id === 'tasks' || id === 'projects' ? '#overview-work' : `#overview-${id}`}
      onClick={() => onSelect?.(id)}
      className="overview-score focus-ring"
      aria-label={`${label}: ${loading ? 'loading' : error ? 'unavailable' : value}`}>
      <div className="overview-score-main flex items-center gap-3">
        <span className="overview-score-icon shrink-0" aria-hidden="true"><Icon size={18} strokeWidth={1.6} /></span>
        <div className="min-w-0">
          <span className="overview-score-label block text-[10px] font-bold uppercase tracking-[.09em] text-text-muted">{label}</span>
          <span className="block mt-2 overview-score-value">{loading ? '…' : error ? '—' : value.toLocaleString()}</span>
        </div>
      </div>
      <span className="overview-score-note block mt-3 text-[11px] text-text-muted">
        {loading ? 'Loading…' : error ? 'Could not load' : id === 'tasks'
          ? `${(total ?? 0) - value} completed today` : id === 'messages' ? `${total ?? 0} conversations · ${value} unread`
          : id === 'sessions' ? `${value} of ${total ?? 0} remaining today` : 'Open projects'}
        <span className="float-right text-gold" aria-hidden="true">↗</span>
      </span>
    </a>
  )
}

function toMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

function completedToday(task: AssignedTask, todayKey: string): boolean {
  return Boolean(task.completed_at && localDateKey(new Date(task.completed_at)) === todayKey)
}

export default function OverviewScorePreview({ onSelect }: { onSelect?: (id: OverviewScoreId) => void }) {
  const projectsQuery = useOverviewProjects()
  const { profile } = useAuth()
  const { todaySessions, loading: overviewLoading, error: overviewError } = useMemberOverviewContext()
  const dmThreadsQuery = useDmThreads()
  const todayKey = localDateKey()
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const tasksQuery = useQuery({
    queryKey: ['assigned-tasks', profile?.id ?? 'none'],
    queryFn: () => fetchMemberAssignedTasks(profile!.id, { includeCompleted: true }),
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
  })

  const tasks = tasksQuery.data ?? []
  const tasksLeft = tasks.filter((task) => !task.is_completed).length
  const tasksCompletedToday = tasks.filter((task) => completedToday(task, todayKey)).length
  const taskLoopTotal = tasksLeft + tasksCompletedToday

  const dmThreads = dmThreadsQuery.data ?? []
  const messageThreadsLeft = dmThreads.filter((thread) => (thread.unread_count ?? 0) > 0).length
  const messageThreadTotal = dmThreads.length

  const activeSessions = todaySessions.filter((session) => {
    const status = session.status.toLowerCase()
    return status !== 'cancelled' && status !== 'canceled'
  })
  const sessionsLeft = activeSessions.filter((session) => toMinutes(session.end_time) >= nowMinutes).length

  return (
    <div
      className="overview-scores"
      aria-label="Overview score metrics"
    >
      <div className="overview-count-grid">
        <OverviewScoreCard
          id="tasks"
          onSelect={onSelect}
          label="Open tasks"
          value={tasksLeft}
          total={taskLoopTotal}
          icon={CheckSquare}
          loading={tasksQuery.isLoading}
          error={tasksQuery.isError}
        />
        <OverviewScoreCard id="projects" onSelect={onSelect} label="Active projects" value={projectsQuery.data?.length ?? 0}
          icon={FolderKanban} loading={projectsQuery.isLoading} error={projectsQuery.isError} />
        <OverviewScoreCard
          id="messages"
          label="Messages"
          value={messageThreadsLeft}
          total={messageThreadTotal}
          icon={MessageCircle}
          loading={dmThreadsQuery.isLoading}
          error={dmThreadsQuery.isError}
        />
        <OverviewScoreCard
          id="sessions"
          label="Sessions today"
          value={sessionsLeft}
          total={activeSessions.length}
          icon={BriefcaseBusiness}
          loading={overviewLoading}
          error={Boolean(overviewError)}
        />
      </div>
    </div>
  )
}
