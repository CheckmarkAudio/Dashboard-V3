import { useMemo } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTasks } from '../contexts/TaskContext'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/* ── Time grid config ── */
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7 AM to 7 PM
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEK_DATES = ['Apr 14', 'Apr 15', 'Apr 16', 'Apr 17', 'Apr 18', 'Apr 19', 'Apr 20']
const WEEK_KEYS = ['2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17', '2026-04-18', '2026-04-19', '2026-04-20']
const TODAY_KEY = '2026-04-14'

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`
}

function durationLabel(start: string, end: string): string {
  const mins = timeToMinutes(end) - timeToMinutes(start)
  const hrs = Math.floor(mins / 60)
  const rm = mins % 60
  return hrs > 0 ? `${hrs}h${rm > 0 ? ` ${rm}m` : ''}` : `${rm}m`
}

export default function Calendar() {
  useDocumentTitle('Calendar - Checkmark Audio')
  const { bookings } = useTasks()

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const map: Record<string, typeof bookings> = {}
    for (const b of bookings) {
      if (!map[b.date]) map[b.date] = []
      map[b.date].push(b)
    }
    return map
  }, [bookings])

  const todayBookings = bookingsByDate[TODAY_KEY] ?? []

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2 text-text-muted">
          <button className="p-1 rounded hover:bg-surface-hover transition-colors"><ChevronLeft size={16} /></button>
          <span className="text-xs font-semibold text-gold">This Week</span>
          <button className="p-1 rounded hover:bg-surface-hover transition-colors"><ChevronRight size={16} /></button>
          <span className="text-xs text-text-muted ml-1">Apr 14 – Apr 20, 2026</span>
        </div>
      </div>

      {/* 2-column layout: Today (narrow) | This Week (wide) */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 items-start">

        {/* ── Column 1: Today ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-[13px] font-bold text-text">Today</h2>
            <p className="text-[10px] text-text-muted">Tuesday, April 14</p>
          </div>
          <div className="px-4 py-2">
            {todayBookings.length > 0 ? (
              <div className="space-y-1">
                {todayBookings.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)).map(b => (
                  <div key={b.id} className="py-2 border-b border-border/20 last:border-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-text">{b.client}</p>
                      <span className="text-[9px] font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded">{durationLabel(b.startTime, b.endTime)}</span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5">{formatTime12(b.startTime)} – {formatTime12(b.endTime)}</p>
                    <p className="text-[10px] text-text-light">{b.assignee} · {b.studio}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-text-light italic py-4 text-center">No bookings today</p>
            )}
          </div>
        </div>

        {/* ── Column 2: This Week (time-blocked grid) ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-[13px] font-bold text-text">This Week</h2>
          </div>

          {/* Weekly grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Day headers */}
              <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-border/30">
                <div />
                {DAYS.map((day, i) => {
                  const isToday = WEEK_KEYS[i] === TODAY_KEY
                  return (
                    <div key={day} className={`text-center py-2 border-l border-border/20 ${isToday ? 'bg-gold/[0.04]' : ''}`}>
                      <p className={`text-[10px] font-semibold uppercase ${isToday ? 'text-gold' : 'text-text-muted'}`}>{day}</p>
                      <p className={`text-[9px] ${isToday ? 'text-gold' : 'text-text-light'}`}>{WEEK_DATES[i]}</p>
                    </div>
                  )
                })}
              </div>

              {/* Time rows */}
              <div className="relative">
                {HOURS.map(hour => (
                  <div key={hour} className="grid grid-cols-[50px_repeat(7,1fr)] h-[48px] border-b border-border/10">
                    <div className="text-[9px] text-text-light font-medium pr-2 text-right pt-0.5">
                      {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                    </div>
                    {DAYS.map((_, di) => {
                      const isToday = WEEK_KEYS[di] === TODAY_KEY
                      return <div key={di} className={`border-l border-border/10 ${isToday ? 'bg-gold/[0.02]' : ''}`} />
                    })}
                  </div>
                ))}

                {/* Booking blocks overlay */}
                {WEEK_KEYS.map((dateKey, dayIndex) => {
                  const dayBookings = bookingsByDate[dateKey] ?? []
                  return dayBookings.map(b => {
                    const startMin = timeToMinutes(b.startTime)
                    const endMin = timeToMinutes(b.endTime)
                    const gridStart = 7 * 60 // 7 AM
                    const topPx = ((startMin - gridStart) / 60) * 48
                    const heightPx = ((endMin - startMin) / 60) * 48
                    // Position: skip the time column (50px), then offset by day
                    const leftPercent = ((dayIndex) / 7) * 100
                    const widthPercent = 100 / 7

                    return (
                      <div
                        key={b.id}
                        className="absolute rounded-md border border-gold/30 bg-gold/10 px-1.5 py-1 overflow-hidden cursor-default hover:bg-gold/15 transition-colors"
                        style={{
                          top: topPx,
                          height: Math.max(heightPx - 2, 20),
                          left: `calc(50px + ${leftPercent}% + 2px)`,
                          width: `calc(${widthPercent}% - 4px)`,
                        }}
                      >
                        <p className="text-[10px] font-semibold text-gold truncate">{b.client}</p>
                        {heightPx > 30 && <p className="text-[8px] text-text-muted truncate">{b.assignee}</p>}
                        {heightPx > 45 && <p className="text-[8px] text-text-light truncate">{formatTime12(b.startTime)}–{formatTime12(b.endTime)}</p>}
                      </div>
                    )
                  })
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
