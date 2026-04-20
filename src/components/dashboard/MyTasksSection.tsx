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
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { useMemberOverviewContext } from '../../contexts/MemberOverviewContext'

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

// New flywheel palette — all cool-toned, none in the red/yellow/green
// family (those are reserved for priority). Tag backgrounds/rings sit
// at very low opacity so the colored TEXT reads first, not a loud
// pill. See src/index.css for the matching CSS tokens.
const STAGE_STYLES: Record<Stage, { dot: string; text: string; bg: string; ring: string }> = {
  deliver: { dot: 'bg-blue-400',   text: 'text-blue-300',   bg: 'bg-blue-500/5',   ring: 'ring-blue-500/15' },
  capture: { dot: 'bg-violet-400', text: 'text-violet-300', bg: 'bg-violet-500/5', ring: 'ring-violet-500/15' },
  share:   { dot: 'bg-cyan-400',   text: 'text-cyan-300',   bg: 'bg-cyan-500/5',   ring: 'ring-cyan-500/15' },
  attract: { dot: 'bg-pink-400',   text: 'text-pink-300',   bg: 'bg-pink-500/5',   ring: 'ring-pink-500/15' },
  book:    { dot: 'bg-orange-400', text: 'text-orange-300', bg: 'bg-orange-500/5', ring: 'ring-orange-500/15' },
}

/**
 * Maps a checklist item to a flywheel stage using a 3-pass heuristic:
 *
 *   1. Item-text keywords (most specific signal — overrides category)
 *   2. Category bucket (broad mapping)
 *   3. Deterministic id-hash fallback (genuinely ambiguous items spread
 *      across all 5 stages instead of all defaulting to a single bucket
 *      and looking fake)
 *
 * Permanent fix is a per-item `flywheel_stage` column on team_checklist_items
 * that admins set in Templates UI — tracked in PROJECT_STATE.md as part of
 * the flywheel event ledger work.
 */
function mapItemToStage(item: { id: string; category: string | null; item_text: string | null }): Stage {
  const t = (item.item_text ?? '').toLowerCase()
  const c = (item.category ?? '').toLowerCase()

  // Pass 1: item-text keyword match (highest signal).
  if (/\b(lead|outreach|research|prospect)/.test(t)) return 'attract'
  if (/\b(book|schedule|invoice|contract|payment)/.test(t)) return 'book'
  if (/\b(social|post|reel|story|carousel|content idea|marketing|publish)/.test(t)) return 'share'
  if (/\b(photo|clip|footage|capture|record|behind[- ]the[- ]scenes)/.test(t)) return 'capture'
  if (/\b(master|mix|export|deliver|session|client|backup)/.test(t)) return 'deliver'

  // Pass 2: category bucket.
  if (c.includes('marketing') || c.includes('share')) return 'share'
  if (c.includes('content support') || c.includes('artist') || c.includes('capture')) return 'capture'
  if (c.includes('lead') || c.includes('attract') || c.includes('outreach')) return 'attract'
  if (c.includes('admin') || c.includes('organization') || c.includes('book') || c.includes('schedule')) return 'book'
  if (c.includes('systems') || c.includes('documentation')) return 'share'

  // Pass 3: deterministic hash so vague items spread across all 5 stages.
  const stages: Stage[] = ['deliver', 'capture', 'share', 'attract', 'book']
  let hash = 0
  for (let i = 0; i < item.id.length; i++) hash = ((hash << 5) - hash) + item.id.charCodeAt(i)
  return stages[Math.abs(hash) % 5] as Stage
}

/**
 * Sort tagged items so the "All" tab visually rotates through stages
 * (Deliver → Capture → Share → Attract → Book → Deliver → ...) rather
 * than clumping by category. Per-stage tabs sort by completion + sort_order.
 */
function rotatingStageOrder<T extends { stage: Stage; is_completed: boolean }>(items: T[]): T[] {
  const buckets: Record<Stage, T[]> = { deliver: [], capture: [], share: [], attract: [], book: [] }
  for (const item of items) buckets[item.stage].push(item)
  const order: Stage[] = ['deliver', 'capture', 'share', 'attract', 'book']
  const result: T[] = []
  let idx = 0
  while (result.length < items.length) {
    const stage = order[idx % order.length] as Stage
    const next = buckets[stage].shift()
    if (next) result.push(next)
    idx++
    // Safety: if we iterate too many times without progress, break.
    if (idx > items.length * order.length) break
  }
  // Push completed items to the bottom (active first).
  return result.sort((a, b) => Number(a.is_completed) - Number(b.is_completed))
}

export default function MyTasksSection() {
  const { daily, loading, error } = useMemberOverviewContext()
  const [filter, setFilter] = useState<FilterValue>('all')

  const taggedItems = useMemo(
    () =>
      daily.items.map((item) => ({
        ...item,
        stage: mapItemToStage(item),
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

  // "All" tab: rotate through stages so the visible top of the list spans
  // the flywheel rather than clumping by category. Per-stage tabs keep the
  // natural sort_order from the checklist instance.
  const filtered = useMemo(() => {
    if (filter === 'all') return rotatingStageOrder(taggedItems)
    return taggedItems
      .filter((t) => t.stage === filter)
      .sort((a, b) => Number(a.is_completed) - Number(b.is_completed))
  }, [filter, taggedItems])

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
      <div className="flex-1 min-h-0 overflow-hidden -mx-1 pr-1">
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
              // Row lifts on hover — border + brighter bg so the row
              // feels tactile, matching the Workspace-UI-Draft pattern.
              className={`group flex items-center gap-2.5 px-2 py-2 rounded-xl border border-transparent bg-white/[0.018] hover:bg-white/[0.04] hover:border-white/10 transition-all ${
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

    </div>
  )
}
