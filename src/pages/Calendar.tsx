import { useMemo, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTasks } from '../contexts/TaskContext'
import { ChevronLeft, ChevronRight, StickyNote } from 'lucide-react'

/* ── Time grid config ── */
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7 AM to 7 PM
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Compute real today and this week's dates dynamically
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]
}

function getWeekDays(weekOffset: number = 0): { day: string; date: string; key: string }[] {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + (weekOffset * 7))
  const days: { day: string; date: string; key: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push({
      day: DAY_NAMES[d.getDay()],
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      key: d.toISOString().split('T')[0],
    })
  }
  return days
}

const TYPE_LABELS: Record<string, string> = {
  engineering: 'Engineering', training: 'Training', education: 'Education',
  music_lesson: 'Music Lesson', consultation: 'Consultation',
}

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
  const TODAY_KEY = getTodayKey()
  const [weekOffset, setWeekOffset] = useState(0)
  const WEEK = getWeekDays(weekOffset)
  const weekStart = WEEK[0]?.date ?? ''
  const weekEnd = WEEK[6]?.date ?? ''
  const weekLabel = weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : `${weekOffset > 0 ? '+' : ''}${weekOffset} Weeks`
  const [selectedDate, setSelectedDate] = useState(TODAY_KEY)

  // Booking notes — keyed by booking ID
  type BookingNote = { id: string; text: string; time: string }
  const [bookingNotes, setBookingNotes] = useState<Record<string, BookingNote[]>>({})
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  const addBookingNote = (bookingId: string) => {
    const text = noteInputs[bookingId]?.trim()
    if (!text) return
    const now = new Date()
    const note: BookingNote = {
      id: `note-${Date.now()}`,
      text,
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    }
    setBookingNotes(prev => ({ ...prev, [bookingId]: [...(prev[bookingId] ?? []), note] }))
    setNoteInputs(prev => ({ ...prev, [bookingId]: '' }))
  }

  const toggleNotes = (bookingId: string) => {
    setExpandedNotes(prev => { const n = new Set(prev); n.has(bookingId) ? n.delete(bookingId) : n.add(bookingId); return n })
  }

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const map: Record<string, typeof bookings> = {}
    for (const b of bookings) {
      if (!map[b.date]) map[b.date] = []
      map[b.date].push(b)
    }
    return map
  }, [bookings])

  const selectedBookings = (bookingsByDate[selectedDate] ?? []).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  const isToday = selectedDate === TODAY_KEY

  // Format the selected date for display
  const selectedDateObj = new Date(selectedDate + 'T12:00:00')
  const selectedDateLabel = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[28px] font-extrabold tracking-tight text-text">Calendar</h1>
        <div className="flex items-center gap-2 text-text-muted">
          <button onClick={() => { if (weekOffset > -1) setWeekOffset(weekOffset - 1) }} className={`p-1 rounded hover:bg-surface-hover transition-colors ${weekOffset <= -1 ? 'opacity-30 cursor-not-allowed' : ''}`}><ChevronLeft size={16} /></button>
          <button onClick={() => setWeekOffset(0)} className="text-xs font-semibold text-gold hover:underline">{weekLabel}</button>
          <button onClick={() => { if (weekOffset < 3) setWeekOffset(weekOffset + 1) }} className={`p-1 rounded hover:bg-surface-hover transition-colors ${weekOffset >= 3 ? 'opacity-30 cursor-not-allowed' : ''}`}><ChevronRight size={16} /></button>
          <span className="text-xs text-text-light ml-1">{weekStart} – {weekEnd}</span>
        </div>
      </div>

      {/* 2-column layout — matched height */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 items-stretch">

        {/* ── Left column: Selected day detail ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="flex-1">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-bold text-text tracking-tight">{isToday ? 'Today' : selectedDateLabel.split(',')[0]}</h2>
                {!isToday && (
                  <button onClick={() => setSelectedDate(TODAY_KEY)} className="text-[9px] text-gold font-semibold hover:underline">Back to Today</button>
                )}
              </div>
              <p className="text-[10px] text-text-muted">{selectedDateLabel}</p>
            </div>
            <div className="px-4 py-2">
              {selectedBookings.length > 0 ? (
                <div className="space-y-0">
                  {selectedBookings.map(b => {
                    const bNotes = bookingNotes[b.id] ?? []
                    const isOpen = expandedNotes.has(b.id)
                    return (
                      <div key={b.id} className="py-3 border-b border-border/20 last:border-0">
                        {/* Client + duration */}
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[13px] font-semibold text-text">{b.client}</p>
                          <span className="text-[9px] font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded">{durationLabel(b.startTime, b.endTime)}</span>
                        </div>
                        {/* Description */}
                        <p className="text-[11px] text-text-muted">{b.description}</p>
                        {/* Time */}
                        <p className="text-[11px] text-text mt-0.5">{formatTime12(b.startTime)} – {formatTime12(b.endTime)}</p>
                        {/* Details row */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[9px] font-semibold text-gold/80 bg-gold/5 border border-gold/15 px-1.5 py-0.5 rounded">{TYPE_LABELS[b.type] ?? b.type}</span>
                          <span className="text-[9px] text-text-muted">{b.studio}</span>
                          <span className="text-[9px] text-text-light">·</span>
                          <span className="text-[9px] text-text-muted">{b.assignee}</span>
                        </div>
                        {/* Status + Add Note button */}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="flex items-center gap-1 text-[10px] text-text-light">
                            {b.status === 'Confirmed' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                            {b.status === 'Cancelled' && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                            {b.status}
                          </span>
                          <button onClick={() => toggleNotes(b.id)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/10 text-gold border border-gold/25 text-[10px] font-semibold hover:bg-gold/20 transition-all">
                            <StickyNote size={10} />
                            {bNotes.length > 0 ? `Notes (${bNotes.length})` : 'Add Note'}
                          </button>
                        </div>

                        {/* Inline notes section */}
                        {isOpen && (
                          <div className="mt-2 pt-2 border-t border-border/15">
                            {/* Existing notes */}
                            {bNotes.length > 0 && (
                              <div className="space-y-1.5 mb-2">
                                {bNotes.map(n => (
                                  <div key={n.id} className="flex items-start gap-2 border-l-2 border-gold/30 pl-2.5 py-1">
                                    <StickyNote size={9} className="text-gold/40 mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-[11px] text-text-muted italic">{n.text}</p>
                                      <p className="text-[8px] text-text-light mt-0.5">{n.time}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Note input — autoFocus so cursor is ready */}
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                autoFocus
                                value={noteInputs[b.id] ?? ''}
                                onChange={e => setNoteInputs(prev => ({ ...prev, [b.id]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && addBookingNote(b.id)}
                                placeholder="Write a note..."
                                className="flex-1 bg-surface-alt border border-border rounded-lg px-2.5 py-1.5 text-[11px] placeholder:text-text-light focus:border-gold"
                              />
                              <button
                                onClick={() => addBookingNote(b.id)}
                                disabled={!(noteInputs[b.id]?.trim())}
                                className={`px-2 py-1.5 rounded-lg text-[9px] font-semibold transition-all ${
                                  noteInputs[b.id]?.trim() ? 'bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20' : 'bg-surface-alt text-text-light border border-border cursor-not-allowed'
                                }`}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-text-light italic py-4 text-center">No bookings this day</p>
              )}
            </div>
          </div>

        </div>

        {/* ── Right column: This Week grid ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-[16px] font-bold text-text tracking-tight">This Week</h2>
          </div>

          <div>
            <div>
              {/* Day headers — clickable */}
              <div className="grid grid-cols-[36px_repeat(7,1fr)] border-b border-border/30">
                <div />
                {WEEK.map((wd, i) => {
                  const isActualToday = wd.key === TODAY_KEY
                  const isSelected = wd.key === selectedDate
                  return (
                    <button
                      key={wd.key}
                      onClick={() => setSelectedDate(wd.key)}
                      className={`text-center py-2 border-l border-border/20 transition-all ${isSelected ? 'bg-gold/[0.08]' : isActualToday ? 'bg-gold/[0.03]' : 'hover:bg-white/[0.02]'}`}
                    >
                      <p className={`text-[10px] font-semibold uppercase ${isSelected ? 'text-gold' : isActualToday ? 'text-gold/60' : 'text-text-muted'}`}>{wd.day}</p>
                      <p className={`text-[9px] ${isSelected ? 'text-gold' : isActualToday ? 'text-gold/50' : 'text-text-light'}`}>{wd.date}</p>
                      {isSelected && <div className="w-1 h-1 rounded-full bg-gold mx-auto mt-0.5" />}
                    </button>
                  )
                })}
              </div>

              {/* Time rows with inline booking blocks */}
              <div className="relative" style={{ height: HOURS.length * 48 }}>
                {/* Grid lines */}
                {HOURS.map(hour => (
                  <div key={hour} className="absolute left-0 right-0 grid grid-cols-[36px_repeat(7,1fr)] h-[48px] border-b border-border/10" style={{ top: (hour - 7) * 48 }}>
                    <div className="text-[9px] text-text-light font-medium pr-2 text-right pt-0.5">
                      {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                    </div>
                    {WEEK.map((wd, di) => {
                      const isSel = wd.key === selectedDate
                      return <div key={di} className={`border-l border-border/10 ${isSel ? 'bg-gold/[0.03]' : ''}`} />
                    })}
                  </div>
                ))}

                {/* Booking blocks — positioned within each day column using grid math */}
                {WEEK.map((wd, dayIndex) => {
                  const dayBookings = bookingsByDate[wd.key] ?? []
                  return dayBookings.map(b => {
                    const startMin = timeToMinutes(b.startTime)
                    const endMin = timeToMinutes(b.endTime)
                    const gridStart = 7 * 60
                    const topPx = ((startMin - gridStart) / 60) * 48
                    const heightPx = ((endMin - startMin) / 60) * 48
                    // Use CSS calc that matches the grid: skip 50px time col, then position within 7 equal columns
                    const colWidth = `((100% - 36px) / 7)`
                    const colLeft = `(36px + ${colWidth} * ${dayIndex})`

                    return (
                      <div
                        key={b.id}
                        className="absolute bg-gold/8 border border-gold/20 px-1.5 py-0.5 overflow-hidden cursor-default hover:bg-gold/12 transition-colors z-10"
                        style={{
                          top: topPx + 1,
                          height: Math.max(heightPx - 2, 18),
                          left: `calc(${colLeft} + 1px)`,
                          width: `calc(${colWidth} - 2px)`,
                        }}
                      >
                        <p className="text-[10px] font-medium text-gold truncate leading-tight">{b.client}</p>
                        {heightPx > 28 && <p className="text-[8px] text-text-muted truncate leading-tight">{b.assignee}</p>}
                        {heightPx > 42 && <p className="text-[8px] text-text-light truncate leading-tight">{formatTime12(b.startTime)}–{formatTime12(b.endTime)}</p>}
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
