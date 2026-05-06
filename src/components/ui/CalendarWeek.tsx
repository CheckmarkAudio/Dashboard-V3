import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import {
  addDays,
  blockLayout,
  DAY_END_MIN,
  DAY_START_MIN,
  formatTimeDisplay,
  isSameDay,
} from '../../lib/time'
import { localDateKey } from '../../lib/dates'
import type { CalendarEvent } from '../../types'
import Badge, { type BadgeVariant } from './Badge'
import Button from './Button'
import TimeGrid from './TimeGrid'

/**
 * Phase 5.5 — Week-view calendar grid.
 *
 * Renders a 7-column Monday–Sunday week. Each column uses TimeGrid for
 * hour rows and positions its event blocks via blockLayout(). All-day
 * events (schedule focus areas) render in the header strip above the
 * time grid.
 *
 * The component is purely presentational — parent owns weekStart state
 * and passes prev/next/today handlers. Data comes pre-loaded via
 * `loadWeekEvents` from `src/lib/calendar.ts`.
 */
export interface CalendarWeekProps {
  weekStart: Date
  events: CalendarEvent[]
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
  onEventClick?: (event: CalendarEvent) => void
  /** Show a small member-name chip inside each event (team view only). */
  showMemberChip?: boolean
  /** Extra title shown above the nav ("Studio Intern's week", etc.). */
  title?: string
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarWeek({
  weekStart,
  events,
  onPrevWeek,
  onNextWeek,
  onToday,
  onEventClick,
  showMemberChip = false,
  title,
}: CalendarWeekProps) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  // Split events into all-day (schedule_focus) and timed (session/meeting).
  const { allDayByDay, timedByDay } = useMemo(() => {
    const allDay = new Map<string, CalendarEvent[]>()
    const timed = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const bucket = ev.start_time ? timed : allDay
      const list = bucket.get(ev.date) ?? []
      list.push(ev)
      bucket.set(ev.date, list)
    }
    return { allDayByDay: allDay, timedByDay: timed }
  }, [events])

  const todayStr = useMemo(() => localDateKey(new Date()), [])

  const rangeLabel = useMemo(() => {
    const end = addDays(weekStart, 6)
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${fmt(weekStart)} – ${fmt(end)}, ${end.getFullYear()}`
  }, [weekStart])

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      {/* Nav strip */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="min-w-0">
          {title && (
            <p className="text-[11px] text-text-light uppercase tracking-wide mb-0.5">
              {title}
            </p>
          )}
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays size={14} className="text-gold" aria-hidden="true" />
            {rangeLabel}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onPrevWeek} aria-label="Previous week">
            <ChevronLeft size={15} aria-hidden="true" />
          </Button>
          <Button variant="secondary" size="sm" onClick={onToday}>
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={onNextWeek} aria-label="Next week">
            <ChevronRight size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Day headers + all-day row */}
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border">
        <div aria-hidden="true" />
        {days.map((d) => {
          const key = localDateKey(d)
          const isToday = key === todayStr
          return (
            <div
              key={key}
              className={`px-2 py-2 text-center border-l border-border ${
                isToday ? 'bg-gold/5' : ''
              }`}
            >
              <p className="text-[10px] uppercase tracking-wide text-text-light">
                {DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}
              </p>
              <p
                className={`text-sm font-semibold tabular-nums ${
                  isToday ? 'text-gold' : 'text-text'
                }`}
              >
                {d.getDate()}
              </p>
            </div>
          )
        })}
      </div>

      {/* All-day event row (schedule_focus) */}
      {Array.from(allDayByDay.values()).some((list) => list.length > 0) && (
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border bg-surface-alt/30">
          <div aria-hidden="true" className="flex items-start justify-end pr-1 pt-1">
            <span className="text-[9px] text-text-light uppercase tracking-wide">Focus</span>
          </div>
          {days.map((d) => {
            const key = localDateKey(d)
            const list = allDayByDay.get(key) ?? []
            return (
              <div
                key={key}
                className="border-l border-border p-1 min-h-[32px] space-y-1"
              >
                {list.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onEventClick?.(ev)}
                    className="w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded bg-gold/10 text-gold hover:bg-gold/15 transition-colors focus-ring truncate"
                    title={ev.title}
                  >
                    {ev.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Timed grid */}
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
        {/* Shared time labels gutter */}
        <div className="relative border-r border-border" style={{ height: 640 }}>
          <TimeGrid
            heightPx={640}
            rangeStart={DAY_START_MIN}
            rangeEnd={DAY_END_MIN}
            showLabels
            className="pointer-events-none"
          />
        </div>

        {days.map((d) => {
          const key = localDateKey(d)
          const list = timedByDay.get(key) ?? []
          const isToday = isSameDay(d, new Date())
          return (
            <div
              key={key}
              className={`relative border-l border-border ${isToday ? 'bg-gold/[0.03]' : ''}`}
              style={{ height: 640 }}
            >
              <TimeGrid
                heightPx={640}
                rangeStart={DAY_START_MIN}
                rangeEnd={DAY_END_MIN}
                showLabels={false}
              >
                {list.map((ev) => {
                  const { topPct, heightPct } = blockLayout(
                    ev.start_time ?? '09:00',
                    ev.end_time ?? '10:00',
                    DAY_START_MIN,
                    DAY_END_MIN,
                  )
                  const variant = badgeForEvent(ev)
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onEventClick?.(ev)}
                      className="absolute left-0.5 right-0.5 rounded-md text-[10px] text-left overflow-hidden focus-ring"
                      style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                      title={`${ev.title} · ${formatTimeDisplay(ev.start_time ?? '')}–${formatTimeDisplay(ev.end_time ?? '')}`}
                    >
                      <div className={`w-full h-full px-1.5 py-1 flex flex-col gap-0.5 ${eventBgClass(variant)}`}>
                        <div className="font-semibold leading-tight truncate">
                          {ev.title}
                        </div>
                        <div className="text-[9px] opacity-80 leading-tight truncate">
                          {formatTimeDisplay(ev.start_time ?? '')}
                        </div>
                        {showMemberChip && ev.member_name && (
                          <div className="mt-auto pt-0.5">
                            <Badge variant="neutral" size="sm">
                              {ev.member_name}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </TimeGrid>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function badgeForEvent(ev: CalendarEvent): BadgeVariant {
  if (ev.kind === 'meeting') return 'stage-deliver'
  if (ev.kind === 'schedule_focus') return 'gold'
  // session kind — pick by title hint
  const title = ev.title.toLowerCase()
  if (title.startsWith('mixing')) return 'stage-share'
  if (title.startsWith('lesson')) return 'stage-attract'
  return 'stage-capture'
}

// Solid-ish background blocks so events stand out on the grid.
function eventBgClass(variant: BadgeVariant): string {
  switch (variant) {
    case 'stage-deliver':
      return 'bg-[--color-stage-deliver-bg] text-[--color-stage-deliver-text] border border-[--color-stage-deliver-text]/30'
    case 'stage-capture':
      return 'bg-[--color-stage-capture-bg] text-[--color-stage-capture-text] border border-[--color-stage-capture-text]/30'
    case 'stage-share':
      return 'bg-[--color-stage-share-bg] text-[--color-stage-share-text] border border-[--color-stage-share-text]/30'
    case 'stage-attract':
      return 'bg-[--color-stage-attract-bg] text-[--color-stage-attract-text] border border-[--color-stage-attract-text]/30'
    case 'gold':
      return 'bg-gold/15 text-gold border border-gold/30'
    default:
      return 'bg-surface-alt text-text-muted border border-border'
  }
}

export default CalendarWeek
