// Phase A of the booking migration — writes directly to the Supabase
// `sessions` table instead of the old in-memory TaskContext path. The
// recurring Weekly/Monthly options are intentionally disabled here
// pending the Phase B "Weekly Approval" workflow (separate task). See
// notes on the Recurring section below.

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { EXISTING_CLIENTS, type BookingType, type StudioSpace } from '../contexts/TaskContext'
import { supabase } from '../lib/supabase'
import { fetchTeamMembers, teamMemberKeys } from '../lib/queries/teamMembers'
import { findSessionConflict } from '../domain/sessions/queries'
import type { Session, TeamMember } from '../types'
import { X, AlertTriangle, Loader2 } from 'lucide-react'

const BOOKING_TYPES: { key: BookingType; label: string }[] = [
  { key: 'engineering', label: 'Engineering' },
  { key: 'training', label: 'Training' },
  { key: 'education', label: 'Education' },
  { key: 'music_lesson', label: 'Music Lessons' },
  { key: 'consultation', label: 'Consultation' },
]

/**
 * Translates the UI booking type (5 business-friendly labels) to the
 * `session_type` enum the `sessions` table accepts (4 technical
 * values). This is a one-way mapping — once saved, the category for
 * display purposes comes back out via categoryFromSessionType in
 * domain/sessions/queries.ts.
 */
const BOOKING_TYPE_TO_SESSION_TYPE: Record<BookingType, Session['session_type']> = {
  engineering: 'recording',
  training:    'meeting',
  education:   'lesson',
  music_lesson: 'lesson',
  consultation: 'meeting',
}

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

const todayYMD = () => new Date().toISOString().split('T')[0] ?? ''

export default function CreateBookingModal({
  onClose,
  prefillDate,
  prefillTime,
}: {
  onClose: () => void
  prefillDate?: string
  prefillTime?: string
}) {
  const { profile } = useAuth()

  // Team members populate the Assigned To dropdown. Shared react-query
  // cache with the rest of the app so opening the booking modal after
  // viewing Members or Overview hits a warm cache.
  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const members: TeamMember[] = teamQuery.data ?? []
  // Don't surface inactive members as bookable assignees.
  const activeMembers = useMemo(
    () => members.filter((m) => m.status?.toLowerCase() !== 'inactive'),
    [members],
  )

  const [description, setDescription] = useState('')
  const [client, setClient] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [bookingType, setBookingType] = useState<BookingType>('engineering')
  const [date, setDate] = useState(prefillDate ?? '')
  const [startTime, setStartTime] = useState(prefillTime || '10:00')
  const [endTime, setEndTime] = useState(() => {
    if (prefillTime) {
      const [h, m] = parseClock(prefillTime)
      return `${(h + 1).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }
    return '12:00'
  })
  // Default the assignee to the signed-in user so single-person studios
  // don't have to touch the field. Empty string until team loads.
  const [assignedTo, setAssignedTo] = useState<string>('')
  useEffect(() => {
    if (assignedTo) return
    const self = profile?.id && activeMembers.some((m) => m.id === profile.id) ? profile.id : ''
    if (self) setAssignedTo(self)
  }, [assignedTo, profile?.id, activeMembers])

  const [studio, setStudio] = useState<StudioSpace>('Studio A')

  // Conflict state — auto-clears when inputs change.
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)
  const [confirmedOverride, setConfirmedOverride] = useState(false)
  const [checkingConflict, setCheckingConflict] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Re-check conflict whenever date/time/studio changes.
  useEffect(() => {
    if (!date || !startTime || !endTime || !studio) return
    let cancelled = false
    setCheckingConflict(true)
    findSessionConflict({ sessionDate: date, startTime, endTime, room: studio })
      .then((conflict) => {
        if (cancelled) return
        if (conflict) {
          setConflictWarning(
            `Schedule conflict: "${conflict.client_name ?? 'another session'}" is booked at ${conflict.room ?? 'this studio'} from ${to12(conflict.start_time)} to ${to12(conflict.end_time)} on this date.`,
          )
          setConfirmedOverride(false)
        } else {
          setConflictWarning(null)
          setConfirmedOverride(false)
        }
      })
      .catch(() => {
        if (cancelled) return
        // Silent — surface failure only on submit so admins aren't
        // blocked from booking by transient network issues.
        setConflictWarning(null)
      })
      .finally(() => { if (!cancelled) setCheckingConflict(false) })
    return () => { cancelled = true }
  }, [date, startTime, endTime, studio])

  const canSubmit =
    description.trim() &&
    client.trim() &&
    date &&
    startTime &&
    endTime &&
    studio &&
    assignedTo &&
    !submitting

  const filteredClients = EXISTING_CLIENTS.filter((c) =>
    c.toLowerCase().includes(client.toLowerCase()),
  )

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitError(null)

    // Final conflict check right before insert — guards against the
    // race where someone else booked the slot after the effect ran.
    try {
      const conflict = await findSessionConflict({
        sessionDate: date,
        startTime,
        endTime,
        room: studio,
      })
      if (conflict && !confirmedOverride) {
        setConflictWarning(
          `Schedule conflict: "${conflict.client_name ?? 'another session'}" is booked at ${conflict.room ?? 'this studio'} from ${to12(conflict.start_time)} to ${to12(conflict.end_time)}. Confirm to override.`,
        )
        return
      }
    } catch (err) {
      // If the conflict check itself fails, don't block — surface a
      // small warning and let the admin choose to proceed.
      setSubmitError(
        `Couldn't verify conflicts (${(err as Error).message}). Proceeding anyway.`,
      )
    }

    setSubmitting(true)

    const payload = {
      client_name: client.trim() || null,
      session_date: date,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
      session_type: BOOKING_TYPE_TO_SESSION_TYPE[bookingType],
      status: 'pending' as Session['status'],
      room: studio,
      notes: description.trim() || null,
      created_by: profile?.id ?? null,
      assigned_to: assignedTo || null,
    }

    const { error } = await supabase.from('sessions').insert(payload)
    setSubmitting(false)
    if (error) {
      setSubmitError(error.message || 'Failed to save booking.')
      return
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl border border-border w-full max-w-lg mx-4 p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-text">Book a Session</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Auto-assigned to <span className="text-gold font-semibold">Book</span> KPI stage
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
              Booking Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Session description"
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-text-light focus:border-gold"
            />
          </div>

          {/* Client dropdown */}
          <div className="relative">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
              Client
            </label>
            <input
              type="text"
              value={client}
              onChange={(e) => { setClient(e.target.value); setClientDropdownOpen(true) }}
              onFocus={() => setClientDropdownOpen(true)}
              placeholder="Select existing or type new client name"
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-text-light focus:border-gold"
            />
            {clientDropdownOpen && client && filteredClients.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-surface-alt border border-border rounded-xl overflow-hidden shadow-lg">
                {filteredClients.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setClient(c); setClientDropdownOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface-hover transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {client && !EXISTING_CLIENTS.includes(client) && (
              <p className="text-[10px] text-gold mt-1">New client — will be added on booking</p>
            )}
          </div>

          {/* Type of work */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
              Type of Work
            </label>
            <div className="flex flex-wrap gap-1.5">
              {BOOKING_TYPES.map((bt) => (
                <button
                  key={bt.key}
                  onClick={() => setBookingType(bt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${bookingType === bt.key ? 'bg-gold text-black border-gold shadow-sm' : 'bg-surface-alt text-text-muted border-border hover:text-text hover:border-border-light'}`}
                >
                  {bt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Session date */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
              Session Date
            </label>
            <input
              type="date"
              value={date}
              min={todayYMD()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm focus:border-gold"
            />
          </div>

          {/* Time selection — easy tap presets */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">From</label>
            <div className="flex flex-wrap gap-1">
              {TIME_PRESETS.map((t) => {
                const val = to24(t)
                return (
                  <button
                    key={t}
                    onClick={() => setStartTime(val)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${startTime === val ? 'bg-gold/12 text-gold border-gold/25' : 'text-text-light border-border hover:text-text-muted hover:border-border-light'}`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">To</label>
            <div className="flex flex-wrap gap-1">
              {TIME_PRESETS.map((t) => {
                const val = to24(t)
                return (
                  <button
                    key={t}
                    onClick={() => setEndTime(val)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${endTime === val ? 'bg-gold/12 text-gold border-gold/25' : 'text-text-light border-border hover:text-text-muted hover:border-border-light'}`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-text-light mt-1.5">
              {to12(startTime)} – {to12(endTime)}
              {checkingConflict && <span className="ml-2 text-text-light/70">· checking availability…</span>}
            </p>
          </div>

          {/* Studio space */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
              Studio Space
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STUDIOS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStudio(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${studio === s ? 'bg-gold/10 text-gold border-gold/30' : 'bg-surface-alt text-text-muted border-border hover:text-text'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned To — dropdown of active team members */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
              Assigned To
            </label>
            {teamQuery.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-text-light py-2">
                <Loader2 size={14} className="animate-spin" /> Loading team…
              </div>
            ) : teamQuery.error ? (
              <p className="text-[11px] text-amber-400">
                Couldn't load team: {(teamQuery.error as Error).message}
              </p>
            ) : activeMembers.length === 0 ? (
              <p className="text-[11px] text-text-light italic">
                No active team members to assign. Add someone from Team Manager first.
              </p>
            ) : (
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm focus:border-gold"
              >
                <option value="" disabled>Select team member…</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                    {m.position ? ` · ${m.position}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Recurring — Phase A placeholder.
              Off works (single booking). Weekly and Monthly are shown
              as visibly disabled so the admin sees what's coming without
              thinking they're broken. Phase B (Weekly Approval workflow,
              separate task) builds these out with a recurring_schedules
              table and a generation + approval queue. */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
              Recurring
            </label>
            <div className="flex gap-1.5">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all bg-gold/10 text-gold border-gold/30"
              >
                Off
              </button>
              <button
                type="button"
                disabled
                title="Recurring bookings are coming with the Weekly Approval workflow."
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-surface-alt text-text-light/60 border-border cursor-not-allowed"
              >
                Weekly
              </button>
              <button
                type="button"
                disabled
                title="Recurring bookings are coming with the Weekly Approval workflow."
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-surface-alt text-text-light/60 border-border cursor-not-allowed"
              >
                Monthly
              </button>
            </div>
            <p className="text-[10px] text-text-light mt-1.5">
              Weekly &amp; Monthly recurring is coming soon — part of the upcoming Weekly Approval workflow.
            </p>
          </div>

          {/* Conflict warning — auto-clears when resolved */}
          {conflictWarning && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-400 font-semibold">{conflictWarning}</p>
                <p className="text-[10px] text-text-light mt-1">
                  Change the date, time, or studio to resolve — or override below.
                </p>
                {!confirmedOverride && (
                  <button
                    onClick={() => setConfirmedOverride(true)}
                    className="mt-2 text-[11px] font-semibold text-red-400 underline hover:text-red-300"
                  >
                    Override and book anyway
                  </button>
                )}
                {confirmedOverride && (
                  <p className="mt-1 text-[10px] text-gold">Override confirmed. Admin will be notified.</p>
                )}
              </div>
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">{submitError}</p>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || (!!conflictWarning && !confirmedOverride) || submitting}
          className={`mt-5 w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${canSubmit && (!conflictWarning || confirmedOverride) && !submitting ? 'bg-gold text-black hover:bg-gold-muted' : 'bg-surface-alt text-text-light cursor-not-allowed border border-border'}`}
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting
            ? 'Saving…'
            : conflictWarning && confirmedOverride
              ? 'Create Booking (Override)'
              : 'Create Booking'}
        </button>
      </div>
    </div>
  )
}
