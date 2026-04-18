// ============================================================================
// MyTasksSection — compact "tasks by flywheel stage" snapshot for Overview.
//
// Shows ONE small row per flywheel stage (Deliver/Capture/Share/Attract/Book)
// with a colored dot, the stage label, a progress bar, and "X / Y done".
// Designed for the ADHD-friendly Overview where the whole page should fit
// without scrolling — the long, scrollable task list lives on the Daily
// Checklist page instead.
//
// CURRENT LIMITATIONS:
//   - Stage tagging is a category-string lookup, not a DB-tracked field.
//     When the flywheel event ledger lands, swap `mapCategoryToStage()`
//     for a per-item stage column.
//   - Reads from `useMemberOverviewContext().daily` (the existing checklist
//     hook) so completion stays in sync without new mutations.
// ============================================================================

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, AlertCircle, ChevronRight } from 'lucide-react'
import { useMemberOverviewContext } from '../../contexts/MemberOverviewContext'
import { APP_ROUTES } from '../../app/routes'

type Stage = 'deliver' | 'capture' | 'share' | 'attract' | 'book'

const STAGES: { value: Stage; label: string }[] = [
  { value: 'deliver',  label: 'Deliver' },
  { value: 'capture',  label: 'Capture' },
  { value: 'share',    label: 'Share' },
  { value: 'attract',  label: 'Attract' },
  { value: 'book',     label: 'Book' },
]

const STAGE_STYLES: Record<Stage, { dot: string; bar: string; text: string }> = {
  deliver: { dot: 'bg-emerald-400', bar: 'bg-emerald-400', text: 'text-emerald-300' },
  capture: { dot: 'bg-sky-400',     bar: 'bg-sky-400',     text: 'text-sky-300' },
  share:   { dot: 'bg-violet-400',  bar: 'bg-violet-400',  text: 'text-violet-300' },
  attract: { dot: 'bg-amber-400',   bar: 'bg-amber-400',   text: 'text-amber-300' },
  book:    { dot: 'bg-rose-400',    bar: 'bg-rose-400',    text: 'text-rose-300' },
}

/**
 * Maps a checklist category string to a flywheel stage. Best-effort heuristic.
 * Items without a known mapping default to 'deliver' since most operational
 * work is delivery-stage by nature.
 */
function mapCategoryToStage(category: string | null | undefined): Stage {
  const c = (category ?? '').toLowerCase()
  if (c.includes('marketing') || c.includes('share')) return 'share'
  if (c.includes('content support') || c.includes('artist') || c.includes('capture')) return 'capture'
  if (c.includes('lead') || c.includes('attract') || c.includes('outreach')) return 'attract'
  if (c.includes('book') || c.includes('schedule')) return 'book'
  return 'deliver'
}

interface StageStat {
  stage: Stage
  total: number
  done: number
}

export default function MyTasksSection() {
  const { daily, loading, error } = useMemberOverviewContext()

  const stats = useMemo<StageStat[]>(() => {
    const acc: Record<Stage, StageStat> = {
      deliver: { stage: 'deliver', total: 0, done: 0 },
      capture: { stage: 'capture', total: 0, done: 0 },
      share:   { stage: 'share',   total: 0, done: 0 },
      attract: { stage: 'attract', total: 0, done: 0 },
      book:    { stage: 'book',    total: 0, done: 0 },
    }
    for (const item of daily.items) {
      const s = mapCategoryToStage(item.category)
      acc[s].total += 1
      if (item.is_completed) acc[s].done += 1
    }
    return STAGES.map((s) => acc[s.value])
  }, [daily.items])

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

  const totalTasks = stats.reduce((sum, s) => sum + s.total, 0)
  const totalDone = stats.reduce((sum, s) => sum + s.done, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Stage rows — one per flywheel stage. Compact, scannable, color-coded. */}
      <div className="flex-1 flex flex-col justify-center -my-1">
        {stats.map((stat) => {
          const ss = STAGE_STYLES[stat.stage]
          const label = stat.stage.charAt(0).toUpperCase() + stat.stage.slice(1)
          const pct = stat.total === 0 ? 0 : (stat.done / stat.total) * 100
          const empty = stat.total === 0
          return (
            <div
              key={stat.stage}
              className={`flex items-center gap-3 py-2 ${empty ? 'opacity-40' : ''}`}
            >
              <span className={`w-2 h-2 rounded-full ${ss.dot} shrink-0`} aria-hidden="true" />
              <span className={`text-[12px] font-medium tracking-tight w-16 shrink-0 ${ss.text}`}>
                {label}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-alt overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${ss.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] tabular-nums text-text-light w-10 text-right shrink-0">
                {empty ? '—' : `${stat.done}/${stat.total}`}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer link to full checklist */}
      <Link
        to={APP_ROUTES.member.tasks}
        className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-text-light hover:text-gold transition-colors group"
      >
        <span>{totalDone}/{totalTasks} done today</span>
        <span className="flex items-center gap-1 font-medium group-hover:text-gold">
          Open full checklist <ChevronRight size={12} />
        </span>
      </Link>
    </div>
  )
}
