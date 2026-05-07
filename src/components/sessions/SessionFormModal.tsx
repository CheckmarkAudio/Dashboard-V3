// Phase 4.2 — extracted from Sessions.tsx so the page file stays
// focused on the day-view layout. This modal owns its own form state,
// validation, and Supabase mutation. Parent passes the editing target
// (null for create) + the project list for the select, and receives an
// `onSaved` callback that fires after a successful insert/update so it
// can refetch.

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { syncSessionToGoogleCalendar } from '../../lib/googleCalendar'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../Toast'
import { Button, Input, Textarea, Select, Modal } from '../ui'
import { parseTimeToMinutes } from '../../lib/time'
import type { Project, Session } from '../../types'
import { Save } from 'lucide-react'

const SESSION_TYPES: Session['session_type'][] = ['recording', 'mixing', 'lesson', 'meeting']
const SESSION_STATUSES: Session['status'][] = ['confirmed', 'pending', 'cancelled']

const TYPE_LABELS: Record<Session['session_type'], string> = {
  recording: 'Recording',
  mixing: 'Mixing',
  lesson: 'Lesson',
  meeting: 'Meeting',
}

interface SessionFormState {
  project_id: string
  client_name: string
  session_date: string
  start_time: string
  end_time: string
  session_type: Session['session_type']
  status: Session['status']
  room: string
  notes: string
}

const emptyForm = (dateStr: string): SessionFormState => ({
  project_id: '',
  client_name: '',
  session_date: dateStr,
  start_time: '10:00',
  end_time: '11:00',
  session_type: 'recording',
  status: 'pending',
  room: '',
  notes: '',
})

const fromSession = (s: Session): SessionFormState => ({
  project_id: s.project_id ?? '',
  client_name: s.client_name ?? '',
  session_date: s.session_date.slice(0, 10),
  start_time: s.start_time.slice(0, 5),
  end_time: s.end_time.slice(0, 5),
  session_type: s.session_type,
  status: s.status,
  room: s.room ?? '',
  notes: s.notes ?? '',
})

export interface SessionFormModalProps {
  open: boolean
  onClose: () => void
  /** Session being edited, or null when creating a new one. */
  editing: Session | null
  /** Default date when creating a new session (from the parent's day view). */
  defaultDate: string
  /** Project list for the "Project" select. */
  projects: Pick<Project, 'id' | 'name'>[]
  /** Fired after a successful insert or update so the parent can refetch. */
  onSaved: () => void
}

export default function SessionFormModal({
  open, onClose, editing, defaultDate, projects, onSaved,
}: SessionFormModalProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState<SessionFormState>(() => emptyForm(defaultDate))
  const [submitting, setSubmitting] = useState(false)

  // Reset the form whenever the modal opens — for edit, populate from the
  // selected session; for create, reset to the parent's current date.
  useEffect(() => {
    if (!open) return
    setForm(editing ? fromSession(editing) : emptyForm(defaultDate))
  }, [open, editing, defaultDate])

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    // Client-side validation — end strictly after start. The DB has a
    // check constraint as the real gate; this just gives a faster toast.
    if (parseTimeToMinutes(form.end_time) <= parseTimeToMinutes(form.start_time)) {
      toast('End time must be after start time', 'error')
      return
    }

    setSubmitting(true)

    const payload = {
      project_id: form.project_id || null,
      client_name: form.client_name.trim() || null,
      session_date: form.session_date,
      start_time: form.start_time.length === 5 ? `${form.start_time}:00` : form.start_time,
      end_time: form.end_time.length === 5 ? `${form.end_time}:00` : form.end_time,
      session_type: form.session_type,
      status: form.status,
      room: form.room.trim() || null,
      notes: form.notes.trim() || null,
      ...(editing ? {} : { created_by: profile.id }),
    }

    if (editing) {
      const { data, error } = await supabase
        .from('sessions')
        .update(payload)
        .eq('id', editing.id)
        .select('id')
        .single()
      if (error) {
        console.error(error)
        toast(error.message || 'Failed to update session', 'error')
        setSubmitting(false)
        return
      }
      try {
        await syncSessionToGoogleCalendar(data.id)
        toast('Session updated')
      } catch (err) {
        toast(`Session updated, but Google Calendar sync failed: ${(err as Error).message}`, 'error')
      }
    } else {
      const { data, error } = await supabase
        .from('sessions')
        .insert(payload)
        .select('id')
        .single()
      if (error) {
        console.error(error)
        toast(error.message || 'Failed to create session', 'error')
        setSubmitting(false)
        return
      }
      try {
        await syncSessionToGoogleCalendar(data.id)
        toast('Session booked')
      } catch (err) {
        toast(`Session booked, but Google Calendar sync failed: ${(err as Error).message}`, 'error')
      }
    }

    setSubmitting(false)
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editing ? 'Edit session' : 'New session'}
      size="md"
      locked={submitting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="session-field-date"
          label="Date"
          type="date"
          required
          value={form.session_date}
          onChange={(e) => setForm({ ...form, session_date: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="session-field-start"
            label="Start"
            type="time"
            required
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
          <Input
            id="session-field-end"
            label="End"
            type="time"
            required
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            id="session-field-type"
            label="Type"
            value={form.session_type}
            onChange={(e) => setForm({ ...form, session_type: e.target.value as Session['session_type'] })}
          >
            {SESSION_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </Select>
          <Select
            id="session-field-status"
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Session['status'] })}
            className="capitalize"
          >
            {SESSION_STATUSES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </Select>
        </div>
        <Select
          id="session-field-project"
          label="Project"
          value={form.project_id}
          onChange={(e) => setForm({ ...form, project_id: e.target.value })}
        >
          <option value="">None</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Input
          id="session-field-client"
          label="Client"
          placeholder="Optional"
          value={form.client_name}
          onChange={(e) => setForm({ ...form, client_name: e.target.value })}
        />
        <Input
          id="session-field-room"
          label="Room"
          placeholder="e.g. Studio A"
          value={form.room}
          onChange={(e) => setForm({ ...form, room: e.target.value })}
        />
        <Textarea
          id="session-field-notes"
          label="Notes"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            iconLeft={!submitting ? <Save className="h-4 w-4" aria-hidden="true" /> : undefined}
          >
            {editing ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
