import { useMemo, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTasks } from '../contexts/TaskContext'
import { ChevronLeft, ChevronRight, StickyNote } from 'lucide-react'

/* ── Time grid config ── */
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7 AM to 7 PM
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEK_DATES = ['Apr 14', 'Apr 15', 'Apr 16', 'Apr 17', 'Apr 18', 'Apr 19', 'Apr 20']
const WEEK_KEYS = ['2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17', '2026-04-18', '2026-04-19', '2026-04-20']
const TODAY_KEY = '2026-04-14'

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
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2 text-text-muted">
          <button className="p-1 rounded hover:bg-surface-hover transition-colors"><ChevronLeft size={16} /></button>
          <span className="text-xs font-semibold text-gold">This Week</span>
          <button className="p-1 rounded hover:bg-surface-hover transition-colors"><ChevronRight size={16} /></button>
          <span className="text-xs text-text-muted ml-1">Apr 14 – Apr 20, 2026</span>
        </div>
      </div>

      {/* 2-column layout — matched height */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 items-stretch">

        {/* ── Left column: Selected day detail ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="flex-1">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-bold text-text">{isToday ? 'Today' : selectedDateLabel.split(',')[0]}</h2>
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
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                            b.status === 'Confirmed' ? 'text-gold bg-gold/10 border-gold/20' : 'text-text-muted bg-surface-alt border-border'
                          }`}>{b.status}</span>
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
            <h2 className="text-[13px] font-bold text-text">This Week</h2>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Day headers — clickable */}
              <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-border/30">
                <div />
                {DAYS.map((day, i) => {
                  const isActualToday = WEEK_KEYS[i] === TODAY_KEY
                  const isSelected = WEEK_KEYS[i] === selectedDate
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(WEEK_KEYS[i])}
                      className={`text-center py-2 border-l border-border/20 transition-all ${isSelected ? 'bg-gold/[0.08]' : isActualToday ? 'bg-gold/[0.03]' : 'hover:bg-white/[0.02]'}`}
                    >
                      <p className={`text-[10px] font-semibold uppercase ${isSelected ? 'text-gold' : isActualToday ? 'text-gold/60' : 'text-text-muted'}`}>{day}</p>
                      <p className={`text-[9px] ${isSelected ? 'text-gold' : isActualToday ? 'text-gold/50' : 'text-text-light'}`}>{WEEK_DATES[i]}</p>
                      {isSelected && <div className="w-1 h-1 rounded-full bg-gold mx-auto mt-0.5" />}
                    </button>
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
                      const isSel = WEEK_KEYS[di] === selectedDate
                      return <div key={di} className={`border-l border-border/10 ${isSel ? 'bg-gold/[0.03]' : ''}`} />
                    })}
                  </div>
                ))}

                {/* Booking blocks overlay */}
                {WEEK_KEYS.map((dateKey, dayIndex) => {
                  const dayBookings = bookingsByDate[dateKey] ?? []
                  return dayBookings.map(b => {
                    const startMin = timeToMinutes(b.startTime)
                    const endMin = timeToMinutes(b.endTime)
                    const gridStart = 7 * 60
                    const topPx = ((startMin - gridStart) / 60) * 48
                    const heightPx = ((endMin - startMin) / 60) * 48
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
