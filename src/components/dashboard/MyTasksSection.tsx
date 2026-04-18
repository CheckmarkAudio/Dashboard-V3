// ============================================================================
// MyTasksSection — "Today by flywheel stage" task list for Overview.
//
// Renders today's daily checklist as a filterable list with stage filter
// pills + colored stage badges per task. Designed to fit inside a fixed-
// height widget frame; the task list scrolls internally if there are many
// items so the Overview page itself doesn't grow.
//
// CURRENT LIMITATIONS:
//   - Stage tagging is a category-string lookup, not a DB-tracked field.
//     When the flywheel event ledger lands, swap mapCategoryToStage for
//     a per-item stage column.
//   - Reads from useMemberOverviewContext().daily so completion stays in
//     sync without new mutations.
// ============================================================================

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2, AlertCircle, ChevronRight } from 'lucide-react'
import { useMemberOverviewContext } from '../../contexts/MemberOverviewContext'
import { APP_ROUTES } from '../../app/routes'

type Stage = 'deliver' | 'capture' | 'share' | 'attract' | 'book'
type FilterValue = 'all' | Stage

const STAGES: { value: FilterValue; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'deliver',  label: 'Deliver' },
  { value: 'capture',  label: 'Capture' },
  { value: 'share',    label: 'Share' },
  { value: 'attract',  label: 'Attract' },
  { value: 'book',     label: 'Book' },
]

const STAGE_STYLES: Record<Stage, { dot: string; text: string; bg: string; ring: string }> = {
  deliver: { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' },
  capture: { dot: 'bg-sky-400',     text: 'text-sky-300',     bg: 'bg-sky-500/10',     ring: 'ring-sky-500/30' },
  share:   { dot: 'bg-violet-400',  text: 'text-violet-300',  bg: 'bg-violet-500/10',  ring: 'ring-violet-500/30' },
  attract: { dot: 'bg-amber-400',   text: 'text-amber-300',   bg: 'bg-amber-500/10',   ring: 'ring-amber-500/30' },
  book:    { dot: 'bg-rose-400',    text: 'text-rose-300',    bg: 'bg-rose-500/10',    ring: 'ring-rose-500/30' },
}

function mapCategoryToStage(category: string | null | undefined): Stage {
  const c = (category ?? '').toLowerCase()
  if (c.includes('marketing') || c.includes('share')) return 'share'
  if (c.includes('content support') || c.includes('artist') || c.includes('capture')) return 'capture'
  if (c.includes('lead') || c.includes('attract') || c.includes('outreach')) return 'attract'
  if (c.includes('book') || c.includes('schedule')) return 'book'
  return 'deliver'
}

export default function MyTasksSection() {
  const { daily, loading, error } = useMemberOverviewContext()
  const [filter, setFilter] = useState<FilterValue>('all')

  const taggedItems = useMemo(
    () =>
      daily.items.map((item) => ({
        ...item,
        stage: mapCategoryToStage(item.category),
      })),
    [daily.items],
  )

  const counts = useMemo(() => {
    const c: Record<FilterValue, number> = { all: 0, deliver: 0, capture: 0, share: 0, attract: 0, book: 0 }
    for (const t of taggedItems) {
      c.all += 1
      c[t.stage] += 1
    }
    return c
  }, [taggedItems])

  const filtered = filter === 'all' ? taggedItems : taggedItems.filter((t) => t.stage === filter)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-light">
        <Loader2 size={18} className="animate-spin" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="h-full flex items-center gap-2 text-sm text-amber-300">
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
    )
  }

  // Today's date string for the eyebrow ("TODAY · WED, APR 17"). Computed
  // at render so it updates without a refresh on day-change boundary.
  const todayLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* TODAY eyebrow — anchors the widget in time. ADHD-friendly: makes
          it obvious at a glance that this is "right now, this morning". */}
      <p className="text-[11px] font-semibold tracking-[0.06em] text-gold/70 mb-2 shrink-0">
        TODAY · {todayLabel}
      </p>

      {/* Filter pills — readable at a glance. Active = gold/15 chip. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3 shrink-0">
        {STAGES.map((s) => {
          const isActive = filter === s.value
          const stageStyle = s.value !== 'all' ? STAGE_STYLES[s.value as Stage] : null
          return (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium tracking-tight transition-all ${
                isActive
                  ? 'bg-gold/15 text-gold ring-1 ring-gold/30'
                  : 'bg-surface-alt text-text-muted hover:text-text border border-border/60'
              }`}
            >
              {stageStyle && <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} aria-hidden="true" />}
              <span>{s.label}</span>
              {counts[s.value] > 0 && (
                <span className={`tabular-nums text-[11px] ${isActive ? 'text-gold/80' : 'text-text-light'}`}>
                  {counts[s.value]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Task rows — internal scroll keeps the page itself non-scrolling. */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 pr-1">
        {filtered.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
              <Check size={18} className="text-gold" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-medium text-text">All clear</p>
            <p className="text-[12px] text-text-light mt-0.5">
              {filter === 'all' ? 'No tasks open for today.' : `Nothing in ${filter} stage today.`}
            </p>
          </div>
        )}

        {filtered.map((task) => {
          const ss = STAGE_STYLES[task.stage]
          return (
            <div
              key={task.id}
              className={`group flex items-center gap-2.5 px-1.5 py-2 rounded-lg transition-colors hover:bg-surface-hover/40 ${
                task.is_completed ? 'opacity-50' : ''
              }`}
            >
              <button
                onClick={() => void daily.toggleItem(task.id)}
                aria-label={task.is_completed ? 'Mark task incomplete' : 'Mark task complete'}
                className="shrink-0"
              >
                <div
                  className={`w-[18px] h-[18px] rounded-md border-[1.5px] flex items-center justify-center transition-all ${
                    task.is_completed
                      ? 'bg-gold/30 border-gold/50'
                      : 'border-border-light group-hover:border-gold/60'
                  }`}
                >
                  {task.is_completed && <Check size={12} className="text-gold" aria-hidden="true" />}
                </div>
              </button>

              <span
                className={`flex-1 min-w-0 text-[14px] font-normal tracking-tight truncate ${
                  task.is_completed ? 'line-through text-text-light' : 'text-text'
                }`}
              >
                {task.item_text}
              </span>

              <span
                className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium tracking-tight ${ss.bg} ${ss.text} ring-1 ${ss.ring}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} aria-hidden="true" />
                {task.stage.charAt(0).toUpperCase() + task.stage.slice(1)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer link */}
      <Link
        to={APP_ROUTES.member.tasks}
        className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-[12px] text-text-light hover:text-gold transition-colors group shrink-0"
      >
        <span>{counts.all} today</span>
        <span className="flex items-center gap-1.5 font-medium group-hover:text-gold">
          Full checklist <ChevronRight size={11} />
        </span>
      </Link>
    </div>
  )
}
