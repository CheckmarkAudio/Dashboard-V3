import type { ReactNode } from 'react'
import {
  DAY_START_MIN,
  DAY_END_MIN,
  formatTimeDisplay,
  pad2,
} from '../../lib/time'

/**
 * Reusable day-column time grid. Renders hour-marker rows (top labels +
 * horizontal rule per hour) inside a fixed-height container; consumers
 * position event blocks absolutely on top via `topPct` / `heightPct` from
 * `blockLayout`.
 *
 * Used by Sessions.tsx (single-day view) and CalendarWeek.tsx (each of
 * seven day columns). Keeping it dumb — no data fetching, no click
 * handlers, just the grid.
 */
export interface TimeGridProps {
  /** Minute of day for the first hour label. Defaults to 8:00 AM. */
  rangeStart?: number
  /** Minute of day for the last visible hour. Defaults to 9:00 PM. */
  rangeEnd?: number
  /** Height of the grid in pixels. Defaults to 640 (Sessions page default). */
  heightPx?: number
  /** Show the "HH AM/PM" text labels on the left side of each hour row. */
  showLabels?: boolean
  /** Optional children rendered absolutely on top of the grid (event blocks). */
  children?: ReactNode
  /** Optional className applied to the outer positioned container. */
  className?: string
}

export function TimeGrid({
  rangeStart = DAY_START_MIN,
  rangeEnd = DAY_END_MIN,
  heightPx = 640,
  showLabels = true,
  children,
  className = '',
}: TimeGridProps) {
  const startHour = Math.floor(rangeStart / 60)
  const endHour = Math.ceil(rangeEnd / 60)
  const hours: number[] = []
  for (let h = startHour; h <= endHour; h++) hours.push(h)

  return (
    <div
      className={['relative', className].filter(Boolean).join(' ')}
      style={{ height: `${heightPx}px` }}
    >
      {/* Hour rows */}
      {hours.map((h) => {
        const mins = h * 60
        const topPct = ((mins - rangeStart) / (rangeEnd - rangeStart)) * 100
        // Clamp the last hour so its label doesn't bleed past the bottom.
        const clampedTop = Math.min(topPct, 99)
        return (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-border"
            style={{ top: `${clampedTop}%` }}
          >
            {showLabels && (
              <span className="absolute -top-2 left-1 text-[10px] text-text-light tabular-nums select-none pointer-events-none">
                {formatTimeDisplay(`${pad2(h)}:00`)}
              </span>
            )}
          </div>
        )
      })}

      {/* Event layer */}
      {children}
    </div>
  )
}

export default TimeGrid
