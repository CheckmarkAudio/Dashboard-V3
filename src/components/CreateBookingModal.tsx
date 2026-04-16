import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTasks, EXISTING_CLIENTS, type BookingType, type StudioSpace } from '../contexts/TaskContext'
import { X, AlertTriangle } from 'lucide-react'

const BOOKING_TYPES: { key: BookingType; label: string }[] = [
  { key: 'engineering', label: 'Engineering' },
  { key: 'training', label: 'Training' },
  { key: 'education', label: 'Education' },
  { key: 'music_lesson', label: 'Music Lessons' },
  { key: 'consultation', label: 'Consultation' },
]

const STUDIOS: StudioSpace[] = ['Studio A', 'Studio B', 'Home Visit', 'Venue']

// Common time slots for easy selection
const TIME_PRESETS = [
  '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM',
]

function splitClockParts(value: string): [string, string] {
  const [left = '', right = ''] = value.split(':')
  return [left, right]
}

function parseClock(value: string): [number, number] {
  const [hours, minutes] = splitClockParts(value)
  return [Number(hours), Number(minutes)]
}

function to24(t: string): string {
  const [time = '00:00', period = 'AM'] = t.split(' ')
  let [h, m] = parseClock(time)
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function to12(t: string): string {
  const [h, m] = parseClock(t)
  const period = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${m.toString().padStart(2, '0')} ${period}`
}

const today = () => new Date().toISOString().split('T')[0] ?? ''

export default function CreateBookingModal({ onClose, prefillDate, prefillTime }: { onClose: () => void; prefillDate?: string; prefillTime?: string }) {
  const { addBooking, checkConflict } = useTasks()
  const { profile } = useAuth()

  const [description, setDescription] = useState('')
  const [client, setClient] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [bookingType, setBookingType] = useState<BookingType>('engineering')
  const [startDate, setStartDate] = useState(today())
  const [date, setDate] = useState(prefillDate ?? '')
  const [startTime, setStartTime] = useState(prefillTime || '10:00')
  const [endTime, setEndTime] = useState(() => {
    if (prefillTime) {
      const [h, m] = parseClock(prefillTime)
      return `${(h + 1).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }
    return '12:00'
  })
  const [assignee, setAssignee] = useState(profile?.display_name ?? 'You')
  const [studio, setStudio] = useState<StudioSpace>('Studio A')
  const [recurring, setRecurring] = useState<false | 'daily' | 'weekly' | 'monthly'>(false)

  // Conflict state — auto-clears when inputs change
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)
  const [confirmedOverride, setConfirmedOverride] = useState(false)

  // Auto-clear conflict warning when date, time, or studio changes
  useEffect(() => {
    if (!conflictWarning) return
    // Re-check conflict with new values
    if (date && startTime && endTime) {
      const conflict = checkConflict(date, startTime, endTime, studio)
      if (!conflict) {
        setConflictWarning(null)
        setConfirmedOverride(false)
      } else {
        setConflictWarning(`Schedule conflict: "${conflict.client}" is booked at ${conflict.studio} from ${to12(conflict.startTime)} to ${to12(conflict.endTime)} on this date.`)
        setConfirmedOverride(false)
      }
    }
  }, [date, startTime, endTime, studio])

  const canSubmit = description.trim() && client.trim() && date && startTime && endTime

  const filteredClients = EXISTING_CLIENTS.filter(c =>
    c.toLowerCase().includes(client.toLowerCase())
  )

  const handleSubmit = () => {
    if (!canSubmit) return
    const conflict = checkConflict(date, startTime, endTime, studio)
    if (conflict && !confirmedOverride) {
      setConflictWarning(`Schedule conflict: "${conflict.client}" is booked at ${conflict.studio} from ${to12(conflict.startTime)} to ${to12(conflict.endTime)}. Confirm to override.`)
      return
    }
    addBooking({
      description: description.trim(),
      client: client.trim(),
      type: bookingType,
      date,
      startTime,
      endTime,
      startDate,
      assignee,
      studio,
      recurring,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl border border-border w-full max-w-lg mx-4 p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-text">Book a Session</h2>
            <p className="text-[11px] text-text-muted mt-0.5">Auto-assigned to <span className="text-gold font-semibold">Book</span> KPI stage</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Booking Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Session description"
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-text-light focus:border-gold" />
          </div>

          {/* Client dropdown */}
          <div className="relative">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Client</label>
            <input type="text" value={client} onChange={e => { setClient(e.target.value); setClientDropdownOpen(true) }} onFocus={() => setClientDropdownOpen(true)} placeholder="Select existing or type new client name"
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-text-light focus:border-gold" />
            {clientDropdownOpen && client && filteredClients.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-surface-alt border border-border rounded-xl overflow-hidden shadow-lg">
                {filteredClients.map(c => (
                  <button key={c} onClick={() => { setClient(c); setClientDropdownOpen(false) }} className="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface-hover transition-colors">{c}</button>
                ))}
              </div>
            )}
            {client && !EXISTING_CLIENTS.includes(client) && <p className="text-[10px] text-gold mt-1">New client — will be added on booking</p>}
          </div>

          {/* Type of work */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Type of Work</label>
            <div className="flex flex-wrap gap-1.5">
              {BOOKING_TYPES.map(bt => (
                <button key={bt.key} onClick={() => setBookingType(bt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${bookingType === bt.key ? 'bg-gold text-black border-gold shadow-sm' : 'bg-surface-alt text-text-muted border-border hover:text-text hover:border-border-light'}`}>{bt.label}</button>
              ))}
            </div>
          </div>

          {/* Start date + Session date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm focus:border-gold" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Session Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm focus:border-gold" />
            </div>
          </div>

          {/* Time selection — easy tap presets */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">From</label>
            <div className="flex flex-wrap gap-1">
              {TIME_PRESETS.map(t => {
                const val = to24(t)
                return (
                  <button key={t} onClick={() => setStartTime(val)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${startTime === val ? 'bg-gold/12 text-gold border-gold/25' : 'text-text-light border-border hover:text-text-muted hover:border-border-light'}`}>{t}</button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">To</label>
            <div className="flex flex-wrap gap-1">
              {TIME_PRESETS.map(t => {
                const val = to24(t)
                return (
                  <button key={t} onClick={() => setEndTime(val)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${endTime === val ? 'bg-gold/12 text-gold border-gold/25' : 'text-text-light border-border hover:text-text-muted hover:border-border-light'}`}>{t}</button>
                )
              })}
            </div>
            <p className="text-[10px] text-text-light mt-1.5">{to12(startTime)} – {to12(endTime)}</p>
          </div>

          {/* Studio space */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Studio Space</label>
            <div className="flex flex-wrap gap-1.5">
              {STUDIOS.map(s => (
                <button key={s} onClick={() => setStudio(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${studio === s ? 'bg-gold/10 text-gold border-gold/30' : 'bg-surface-alt text-text-muted border-border hover:text-text'}`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Assigned to */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Assigned To</label>
            <input type="text" value={assignee} onChange={e => setAssignee(e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm focus:border-gold" />
          </div>

          {/* Recurring */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Recurring</label>
            <div className="flex gap-1.5">
              {([false, 'daily', 'weekly', 'monthly'] as const).map(opt => (
                <button key={String(opt)} onClick={() => setRecurring(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${recurring === opt ? 'bg-gold/10 text-gold border-gold/30' : 'bg-surface-alt text-text-muted border-border hover:text-text'}`}>
                  {opt === false ? 'Off' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Conflict warning — auto-clears when resolved */}
          {conflictWarning && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-400 font-semibold">{conflictWarning}</p>
                <p className="text-[10px] text-text-light mt-1">Change the date, time, or studio to resolve — or override below.</p>
                {!confirmedOverride && (
                  <button onClick={() => setConfirmedOverride(true)} className="mt-2 text-[11px] font-semibold text-red-400 underline hover:text-red-300">
                    Override and book anyway
                  </button>
                )}
                {confirmedOverride && (
                  <p className="mt-1 text-[10px] text-gold">Override confirmed. Admin will be notified.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <button onClick={handleSubmit} disabled={!canSubmit || (!!conflictWarning && !confirmedOverride)}
          className={`mt-5 w-full py-3 rounded-xl text-sm font-bold transition-all ${canSubmit && (!conflictWarning || confirmedOverride) ? 'bg-gold text-black hover:bg-gold-muted' : 'bg-surface-alt text-text-light cursor-not-allowed border border-border'}`}>
          {conflictWarning && confirmedOverride ? 'Create Booking (Override)' : 'Create Booking'}
        </button>
      </div>
    </div>
  )
}
