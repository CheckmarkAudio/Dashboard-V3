import { useMemo } from 'react'
import { CalendarRange, Clock, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { formatTimeRange, toLocalDateString, weekdayLabel } from '../../lib/schedule/expand'
import { useTeamSchedule } from '../../lib/schedule/useTeamSchedule'
import type { ExpandedSchedule, Weekday } from '../../types'

function startOfSundayWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function endOfSaturdayWeek(date: Date): Date {
  const end = new Date(startOfSundayWeek(date))
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

function timeRangeForEntry(entry: ExpandedSchedule): string {
  const start = new Date(entry.starts_at)
  const end = new Date(entry.ends_at)
  return formatTimeRange(
    `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}:00`,
    `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}:00`,
  )
}

function locationLabel(entry: ExpandedSchedule): string {
  const note = entry.note?.toLowerCase() ?? ''
  if (note.includes('wfh') || note.includes('remote') || note.includes('home')) return 'WFH'
  return 'Studio'
}

function dayNumberLabel(date: Date): string {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function OverviewPersonalScheduleCard() {
  const { profile } = useAuth()
  const memberId = profile?.id ?? '00000000-0000-0000-0000-000000000000'
  const weekStart = useMemo(() => startOfSundayWeek(new Date()), [])
  const range = useMemo(
    () => ({
      from: toLocalDateString(weekStart),
      to: toLocalDateString(endOfSaturdayWeek(weekStart)),
    }),
    [weekStart],
  )

  const { expanded, loading, error } = useTeamSchedule({
    range,
    memberId,
    includePending: true,
  })

  const days = useMemo(() => {
    const out: { date: Date; entries: ExpandedSchedule[] }[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)
      out.push({ date, entries: [] })
    }

    const byDate = new Map(out.map((day) => [toLocalDateString(day.date), day]))
    for (const entry of expanded) {
      const bucket = byDate.get(toLocalDateString(new Date(entry.starts_at)))
      if (bucket) bucket.entries.push(entry)
    }
    return out
  }, [expanded, weekStart])

  const weekLabel = `${dayNumberLabel(weekStart)} - ${dayNumberLabel(endOfSaturdayWeek(weekStart))}`

  return (
    <section
      className="rounded-xl border border-border bg-surface p-3 shadow-[0_8px_20px_rgba(0,0,0,0.04)]"
      aria-label="Personal work schedule"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25"
            aria-hidden="true"
          >
            <CalendarRange size={16} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-extrabold text-text">Work Schedule</h2>
            <p className="truncate text-[11px] font-semibold text-text-muted">{weekLabel}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[170px] items-center justify-center text-text-muted">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        </div>
      ) : error ? (
        <div className="overflow-hidden rounded-xl bg-surface-alt/25 ring-1 ring-border/40">
          <p className="border-b border-border/30 px-3 py-2 text-[11px] font-bold text-amber-500">
            Could not load schedule.
          </p>
          <div className="divide-y divide-border/35">
            {days.map(({ date }) => {
              const weekday = date.getDay() as Weekday
              const closedDefault = weekday === 0 || weekday === 1
              return (
                <div
                  key={toLocalDateString(date)}
                  className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2 px-3 py-2.5"
                >
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-[0.08em] text-text">
                      {weekdayLabel(weekday)}
                    </p>
                    <p className="text-[10px] font-semibold text-text-muted">{dayNumberLabel(date)}</p>
                  </div>
                  <div className="text-[11px] font-semibold text-text-muted">
                    {closedDefault ? 'Studio closed' : 'Unavailable'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface-alt/25 ring-1 ring-border/40 divide-y divide-border/35">
          {days.map(({ date, entries }) => {
            const weekday = date.getDay() as Weekday
            const closedDefault = weekday === 0 || weekday === 1

            return (
              <div
                key={toLocalDateString(date)}
                className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-2 px-3 py-2.5"
              >
                <div className="pt-0.5">
                  <p className="text-[12px] font-black uppercase tracking-[0.08em] text-text">
                    {weekdayLabel(weekday)}
                  </p>
                  <p className="text-[10px] font-semibold text-text-muted">{dayNumberLabel(date)}</p>
                </div>

                <div className="min-w-0 space-y-1">
                  {entries.length > 0 ? (
                    entries.map((entry) => (
                      <div
                        key={entry.key}
                        className={[
                          'flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold',
                          entry.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-gold/10 text-text',
                        ].join(' ')}
                      >
                        <Clock size={11} className="shrink-0 text-gold" aria-hidden="true" />
                        <span className="min-w-0 truncate">{timeRangeForEntry(entry)}</span>
                        <span className="ml-auto shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-text-muted">
                          {entry.status === 'pending' ? 'Pending' : locationLabel(entry)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-[11px] font-semibold text-text-muted">
                      {closedDefault ? 'Studio closed' : 'Not scheduled'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
