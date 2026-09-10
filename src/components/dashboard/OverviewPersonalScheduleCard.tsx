import { useMemo } from 'react'
import { CalendarRange, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { formatTimeRange, toLocalDateString, weekdayLabel } from '../../lib/schedule/expand'
import { useTeamSchedule } from '../../lib/schedule/useTeamSchedule'
import type { ExpandedSchedule, Weekday } from '../../types'
import './OverviewPersonalScheduleCard.css'

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

  const today = toLocalDateString(new Date())

  return (
    <section className="personal-schedule" aria-label="Personal work schedule">
      <header className="personal-schedule-heading">
        <h2><CalendarRange size={17} aria-hidden="true" />Work Schedule</h2>
        <span>{weekLabel}</span>
      </header>

      {loading ? (
        <div className="personal-schedule-loading" role="status">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading schedule</span>
        </div>
      ) : error ? (
        <p className="personal-schedule-error" role="status">Could not load schedule.</p>
      ) : (
        <ol className="personal-schedule-days">
          {days.map(({ date, entries }) => {
            const dateKey = toLocalDateString(date)
            const weekday = date.getDay() as Weekday
            const isToday = dateKey === today
            const closedDefault = weekday === 0 || weekday === 1

            return (
              <li
                key={dateKey}
                className="personal-schedule-day"
                data-today={isToday || undefined}
                data-empty={entries.length === 0 || undefined}
                aria-current={isToday ? 'date' : undefined}
              >
                <time className="personal-schedule-date" dateTime={dateKey}>
                  <strong>{weekdayLabel(weekday)}</strong>
                  <span>{dayNumberLabel(date)}</span>
                  {isToday && <span className="personal-schedule-today">Today</span>}
                </time>
                {entries.length > 0 ? (
                  <ul className="personal-schedule-entries">
                    {entries.map((entry) => (
                      <li className="personal-schedule-entry" key={entry.key}>
                        <span className="personal-schedule-time">{timeRangeForEntry(entry)}</span>
                        <span className="personal-schedule-status" data-pending={entry.status === 'pending' || undefined}>
                          {entry.status === 'pending' ? 'Pending' : locationLabel(entry)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="personal-schedule-empty">{closedDefault ? 'Studio closed' : 'Not scheduled'}</span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
