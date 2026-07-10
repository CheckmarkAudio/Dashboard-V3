import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BriefcaseBusiness,
  CheckSquare,
  FolderUp,
  MessageCircle,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useMemberOverviewContext } from '../../contexts/MemberOverviewContext'
import { localDateKey } from '../../lib/dates'
import { fetchMemberAssignedTasks } from '../../lib/queries/assignments'
import { supabase } from '../../lib/supabase'
import type { AssignedTask } from '../../types/assignments'
import { useDmThreads } from '../messages/useDmThreads'
import { notificationWorkflowKey, useNotificationWorkflow } from '../notifications/notificationWorkflow'

export type OverviewScoreId = 'tasks' | 'messages' | 'sessions' | 'media'

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    let frame = 0
    const duration = 520
    const start = window.performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      setDisplay(Math.round(value * progress))
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }

    setDisplay(0)
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [value])

  return <>{display.toLocaleString()}</>
}

type ScoreTone = 'gold' | 'violet' | 'sky' | 'emerald'
const MESSAGE_COUNTER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const SCORE_TONE_CLASSES: Record<
  ScoreTone,
  { icon: string; ring: string; active: string; bar: string; glow: string }
> = {
  gold: {
    icon: 'bg-gold/12 text-gold ring-gold/25',
    ring: 'hover:border-gold/45 hover:ring-gold/20',
    active: 'border-gold/60 ring-gold/25',
    bar: 'bg-gold',
    glow: 'from-gold/12',
  },
  violet: {
    icon: 'bg-violet-500/12 text-violet-300 ring-violet-400/25',
    ring: 'hover:border-violet-400/45 hover:ring-violet-400/20',
    active: 'border-violet-400/60 ring-violet-400/25',
    bar: 'bg-violet-400',
    glow: 'from-violet-500/10',
  },
  sky: {
    icon: 'bg-sky-500/12 text-sky-300 ring-sky-400/25',
    ring: 'hover:border-sky-400/45 hover:ring-sky-400/20',
    active: 'border-sky-400/60 ring-sky-400/25',
    bar: 'bg-sky-400',
    glow: 'from-sky-500/10',
  },
  emerald: {
    icon: 'bg-emerald-500/12 text-emerald-300 ring-emerald-400/25',
    ring: 'hover:border-emerald-400/45 hover:ring-emerald-400/20',
    active: 'border-emerald-400/60 ring-emerald-400/25',
    bar: 'bg-emerald-400',
    glow: 'from-emerald-500/10',
  },
}

function OverviewScoreCard({
  id,
  label,
  value,
  total,
  active,
  onSelect,
  icon: Icon,
  tone,
  loading = false,
  error = false,
}: {
  id: OverviewScoreId
  label: string
  value: number
  total?: number
  active: boolean
  onSelect: (id: OverviewScoreId) => void
  icon: typeof CheckSquare
  tone: ScoreTone
  loading?: boolean
  error?: boolean
}) {
  const toneClasses = SCORE_TONE_CLASSES[tone]
  const percent = total && total > 0
    ? Math.max(0, Math.min(100, (value / total) * 100))
    : value > 0
      ? 100
      : 0
  const showTotal = typeof total === 'number' && total > 0

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={active}
      className={[
        'group relative overflow-hidden rounded-xl border bg-surface p-3 text-left transition-all duration-200 ease-out',
        'hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)] hover:ring-2 active:translate-y-0 focus-ring',
        active
          ? `-translate-y-1 scale-[1.01] shadow-[0_16px_34px_rgba(0,0,0,0.12)] ring-2 ${toneClasses.active}`
          : 'border-border',
        toneClasses.ring,
      ].join(' ')}
      aria-label={`${label}: ${value}${showTotal ? ` of ${total}` : ''}`}
    >
      <span
        className={[
          'pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-70',
          toneClasses.glow,
        ].join(' ')}
        aria-hidden="true"
      />
      <div className="relative flex min-h-[112px] flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-text-muted">
            {label}
          </span>
          <span
            className={[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1',
              toneClasses.icon,
            ].join(' ')}
            aria-hidden="true"
          >
            <Icon size={17} strokeWidth={2.3} />
          </span>
        </div>

        <div>
          <div className="flex items-baseline gap-1.5 text-text">
            <span className="text-4xl font-black tracking-[-0.04em] leading-none tabular-nums">
              {loading ? '0' : error ? '--' : <AnimatedNumber value={value} />}
            </span>
            {showTotal && !error && (
              <span className="text-lg font-black tracking-[-0.03em] text-text-muted tabular-nums">
                /{total}
              </span>
            )}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-alt">
            <div
              className={[
                'h-full rounded-full transition-[width] duration-700 ease-out',
                loading || error ? 'bg-border' : toneClasses.bar,
              ].join(' ')}
              style={{ width: `${loading || error ? 0 : percent}%` }}
            />
          </div>
        </div>
      </div>
    </button>
  )
}

function toMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

function completedToday(task: AssignedTask, todayKey: string): boolean {
  return Boolean(task.completed_at && localDateKey(new Date(task.completed_at)) === todayKey)
}

function recentMessageThread(latestCreatedAt: string | null): boolean {
  if (!latestCreatedAt) return false
  return Date.now() - new Date(latestCreatedAt).getTime() <= MESSAGE_COUNTER_WINDOW_MS
}

export default function OverviewScorePreview({
  activeId,
  onSelect,
}: {
  activeId: OverviewScoreId
  onSelect: (id: OverviewScoreId) => void
}) {
  const { profile } = useAuth()
  const { todaySessions, loading: overviewLoading, error: overviewError } = useMemberOverviewContext()
  const workflow = useNotificationWorkflow()
  const dmThreadsQuery = useDmThreads()
  const todayKey = localDateKey()
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const monthStartIso = useMemo(() => {
    const current = new Date()
    return new Date(current.getFullYear(), current.getMonth(), 1).toISOString()
  }, [todayKey])

  const tasksQuery = useQuery({
    queryKey: ['assigned-tasks', profile?.id ?? 'none'],
    queryFn: () => fetchMemberAssignedTasks(profile!.id, { includeCompleted: true }),
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
  })

  const mediaMonthQuery = useQuery({
    queryKey: ['overview-score-media-month', 'team', monthStartIso],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('media_submissions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStartIso)
      if (error) throw error
      return count ?? 0
    },
    staleTime: 60_000,
  })

  const tasks = tasksQuery.data ?? []
  const tasksLeft = tasks.filter((task) => !task.is_completed).length
  const tasksCompletedToday = tasks.filter((task) => completedToday(task, todayKey)).length
  const taskLoopTotal = tasksLeft + tasksCompletedToday

  const dmThreads = dmThreadsQuery.data ?? []
  const visibleMessageThreads = dmThreads.filter((thread) => {
    const workflowRecord = workflow.getRecord(notificationWorkflowKey('dm', thread.channel_id))
    return (thread.unread_count ?? 0) > 0 || recentMessageThread(thread.latest_created_at) || workflowRecord
  })
  const messageThreadsResolved = visibleMessageThreads.filter((thread) => {
    return workflow.getRecord(notificationWorkflowKey('dm', thread.channel_id))?.status === 'resolved'
  }).length
  const messageThreadTotal = visibleMessageThreads.length

  const activeSessions = todaySessions.filter((session) => {
    const status = session.status.toLowerCase()
    return status !== 'cancelled' && status !== 'canceled'
  })
  const sessionsDone = activeSessions.filter((session) => toMinutes(session.end_time) < nowMinutes).length

  return (
    <div
      className="rounded-xl border border-gold/20 bg-gradient-to-br from-gold/10 via-surface to-surface p-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.04)]"
      aria-label="Overview score metrics"
    >
      <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
        <OverviewScoreCard
          id="tasks"
          label="Tasks done"
          value={tasksCompletedToday}
          total={taskLoopTotal}
          active={activeId === 'tasks'}
          onSelect={onSelect}
          icon={CheckSquare}
          tone="gold"
          loading={tasksQuery.isLoading}
          error={tasksQuery.isError}
        />
        <OverviewScoreCard
          id="messages"
          label="Messages resolved"
          value={messageThreadsResolved}
          total={messageThreadTotal}
          active={activeId === 'messages'}
          onSelect={onSelect}
          icon={MessageCircle}
          tone="violet"
          loading={dmThreadsQuery.isLoading}
          error={dmThreadsQuery.isError}
        />
        <OverviewScoreCard
          id="sessions"
          label="Sessions done"
          value={sessionsDone}
          total={activeSessions.length}
          active={activeId === 'sessions'}
          onSelect={onSelect}
          icon={BriefcaseBusiness}
          tone="sky"
          loading={overviewLoading}
          error={Boolean(overviewError)}
        />
        <OverviewScoreCard
          id="media"
          label="Media this month"
          value={mediaMonthQuery.data ?? 0}
          active={activeId === 'media'}
          onSelect={onSelect}
          icon={FolderUp}
          tone="emerald"
          loading={mediaMonthQuery.isLoading}
          error={mediaMonthQuery.isError}
        />
      </div>
    </div>
  )
}
