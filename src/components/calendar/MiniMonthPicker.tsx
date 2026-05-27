// 2026-05-26 — Mini month-picker for the Calendar page left sidebar.
//
// Slots in ABOVE the existing "Today / On Shift Today" CalendarDayCard
// in the 300px left column. Mirrors the Izmahsa calendar reference
// structurally (month label + chevrons + 7×6 grid with prev/next-
// month spillover) but uses our existing dark + gold token palette
// instead of Izmahsa's lime so the page stays on-brand.
//
// Click any day → fires `onSelectDate(YYYY-MM-DD)`. The Calendar page
// resolves which week that day belongs to and updates both
// `weekOffset` (so the week grid scrolls) and `selectedDate` (so the
// CalendarDayCard refreshes to that day's bookings + shifts).
//
// Local state is just `viewMonth` — what month the grid is showing.
// Defaults to the month containing `selectedDate` so opening the page
// always shows the right month without scroll surprise.

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { localDateKey } from '../../lib/dates'

interface MiniMonthPickerProps {
  /** Selected day in `YYYY-MM-DD` local form. Drives the gold pill. */
  selectedDate: string
  /** Called with a `YYYY-MM-DD` key when the user clicks any day cell. */
  onSelectDate: (dateKey: string) => void
}

const DOW_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Resolve a `YYYY-MM-DD` string to a local `Date` at noon (noon-anchor
 * avoids DST edge cases when we only care about the date portion).
 */
function parseDateKey(key: string): Date {
  // Build-time strict mode reads each split index as `number | undefined`,
  // so default each piece. A malformed key here would already be a bug
  // upstream — the fallbacks just keep Date() from being called with NaN.
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

/**
 * Build the 6×7 grid of dates for `viewMonth`. The first row starts
 * on the Monday of the week containing the 1st of the month; the
 * last row ends on the Sunday of the week containing the last day.
 * Spillover days from the prev / next month are included so the grid
 * is always a full 42 cells — keeps the layout stable as months
 * change shape.
 */
function buildMonthCells(viewMonth: Date): Date[] {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1, 12)
  // JS getDay(): Sun=0..Sat=6. Convert to Mon=0..Sun=6 so the grid
  // matches the Mo-Su header we render below.
  const firstDow = (first.getDay() + 6) % 7
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - firstDow)
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push(d)
  }
  return cells
}

export default function MiniMonthPicker({ selectedDate, onSelectDate }: MiniMonthPickerProps) {
  const selectedDateObj = useMemo(() => parseDateKey(selectedDate), [selectedDate])
  // Default the grid to whatever month contains the current selection.
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1, 12),
  )

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth])
  const todayKey = localDateKey()
  const currentMonthIndex = viewMonth.getMonth()

  const goPrevMonth = () => {
    const d = new Date(viewMonth)
    d.setMonth(d.getMonth() - 1)
    setViewMonth(d)
  }
  const goNextMonth = () => {
    const d = new Date(viewMonth)
    d.setMonth(d.getMonth() + 1)
    setViewMonth(d)
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-3.5 shadow-sm">
      {/* Header — month label + chevrons. Centered label feels more
          like a "picker" than left-aligned, which would look like
          a section title. */}
      <div className="flex items-center justify-between mb-2.5">
        <button
          type="button"
          onClick={goPrevMonth}
          aria-label="Previous month"
          className="w-6 h-6 inline-flex items-center justify-center rounded-md text-text-light hover:text-gold hover:bg-surface-hover transition-colors focus-ring"
        >
          <ChevronLeft size={14} />
        </button>
        <p className="text-[13px] font-semibold text-text">
          {MONTH_LABELS[currentMonthIndex]} {viewMonth.getFullYear()}
        </p>
        <button
          type="button"
          onClick={goNextMonth}
          aria-label="Next month"
          className="w-6 h-6 inline-flex items-center justify-center rounded-md text-text-light hover:text-gold hover:bg-surface-hover transition-colors focus-ring"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-y-1 mb-1">
        {DOW_LABELS.map((label) => (
          <span
            key={label}
            className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Date grid — 6 rows × 7 cols. Spillover days from prev/next
          month dim so the user reads the current month's rectangle
          at a glance. */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d) => {
          const key = localDateKey(d)
          const inMonth = d.getMonth() === currentMonthIndex
          const isToday = key === todayKey
          const isSelected = key === selectedDate
          // Build the class string per cell. Selected is the strongest
          // affordance (filled gold pill); today gets a thin gold ring
          // when not selected; out-of-month dims to text-light.
          const baseClass =
            'h-7 w-7 mx-auto inline-flex items-center justify-center rounded-full text-[11px] font-semibold transition-colors focus-ring'
          const stateClass = isSelected
            ? 'bg-gold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.15)_inset]'
            : isToday
              ? 'ring-1 ring-gold/60 text-gold hover:bg-surface-hover'
              : inMonth
                ? 'text-text hover:bg-surface-hover'
                : 'text-text-muted/60 hover:bg-surface-hover hover:text-text-light'
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              aria-label={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              aria-current={isToday ? 'date' : undefined}
              className={`${baseClass} ${stateClass}`}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
