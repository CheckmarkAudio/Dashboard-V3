import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { supabase } from '../lib/supabase'
import {
  Button, Input, Textarea, Select, EmptyState, PageHeader, Modal,
} from '../components/ui'
import type { Project, Session } from '../types'
import {
  Mic,
  Plus,
  Save,
  Loader2,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react'

const SESSION_TYPES: Session['session_type'][] = ['recording', 'mixing', 'lesson', 'meeting']
const SESSION_STATUSES: Session['status'][] = ['confirmed', 'pending', 'cancelled']

const TYPE_LABELS: Record<Session['session_type'], string> = {
  recording: 'Recording',
  mixing: 'Mixing',
  lesson: 'Lesson',
  meeting: 'Meeting',
}

const TYPE_STYLE: Record<Session['session_type'], string> = {
  recording: 'text-blue-300',
  mixing: 'text-violet-300',
  lesson: 'text-cyan-300',
  meeting: 'text-text-muted',
}

const STATUS_DOT: Record<Session['status'], string> = {
  confirmed: 'bg-emerald-400',
  pending: 'bg-gold',
  cancelled: 'bg-red-400',
}

const DAY_START_MIN = 8 * 60
const DAY_END_MIN = 21 * 60
const DAY_RANGE = DAY_END_MIN - DAY_START_MIN

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseTimeToMinutes(t: string): number {
  const parts = t.split(':').map(Number)
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  return h * 60 + m
}

function formatTimeDisplay(t: string) {
  const m = parseTimeToMinutes(t)
  const h = Math.floor(m / 60)
  const min = m % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${pad2(min)} ${ampm}`
}

function blockLayout(start: string, end: string): { topPct: number; heightPct: number } {
  let sm = parseTimeToMinutes(start)
  let em = parseTimeToMinutes(end)
  if (em <= sm) em = sm + 30
  sm = Math.max(DAY_START_MIN, Math.min(sm, DAY_END_MIN))
  em = Math.max(sm + 15, Math.min(em, DAY_END_MIN + 60))
  const top = ((sm - DAY_START_MIN) / DAY_RANGE) * 100
  const height = ((em - sm) / DAY_RANGE) * 100
  return {
    topPct: Math.max(0, Math.min(top, 100)),
    heightPct: Math.max(3, Math.min(height, 100 - top)),
  }
}

type SessionFormState = {
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

const EMPTY_FORM = (dateStr: string): SessionFormState => ({
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

function sessionBorderClass(status: Session['status']) {
  if (status === 'pending') return 'border-2 border-dashed border-gold'
  if (status === 'cancelled') return 'border border-border opacity-60'
  return 'border border-border'
}

export default function Sessions() {
  useDocumentTitle('Sessions - Checkmark Audio')
  const { profile } = useAuth()
  const { toast } = useToast()
  const [viewDate, setViewDate] = useState(() => new Date())
  const dateStr = useMemo(() => toYMD(viewDate), [viewDate])

  const [sessions, setSessions] = useState<Session[]>([])
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Session | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<SessionFormState>(() => EMPTY_FORM(toYMD(new Date())))

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>()
    projects.forEach((p) => m.set(p.id, p.name))
    return m
  }, [projects])

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .order('name', { ascending: true })
    if (error) {
      console.error(error)
      return
    }
    if (data) setProjects(data as Pick<Project, 'id' | 'name'>[])
  }, [])

  const loadSessions = useCallback(async () => {
    if (!profile) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_date', dateStr)
      .order('start_time', { ascending: true })
    if (error) {
      console.error(error)
      toast('Could not load sessions', 'error')
      setSessions([])
    } else if (data) {
      setSessions(data as Session[])
    }
    setLoading(false)
  }, [profile, dateStr, toast])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const goPrevDay = () => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() - 1)
    setViewDate(d)
  }

  const goNextDay = () => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + 1)
    setViewDate(d)
  }

  const goToday = () => setViewDate(new Date())

  const isToday = toYMD(new Date()) === dateStr

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM(dateStr))
    setModalOpen(true)
  }

  const openEdit = (s: Session) => {
    setEditing(s)
    setForm({
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
    setModalOpen(true)
  }

  const closeModal = () => {
    if (submitting) return
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM(dateStr))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    // Client-side validation — ensure end_time is strictly after start_time.
    // The server will also reject invalid ranges via a check constraint, but
    // catching it here gives the user an immediate, friendlier toast.
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
      const { error } = await supabase.from('sessions').update(payload).eq('id', editing.id)
      if (error) {
        console.error(error)
        toast(error.message || 'Failed to update session', 'error')
        setSubmitting(false)
        return
      }
      toast('Session updated')
    } else {
      const { error } = await supabase.from('sessions').insert(payload)
      if (error) {
        console.error(error)
        toast(error.message || 'Failed to create session', 'error')
        setSubmitting(false)
        return
      }
      toast('Session booked')
    }

    setSubmitting(false)
    closeModal()
    loadSessions()
  }

  const handleDelete = async (s: Session) => {
    if (!confirm('Remove this session from the schedule?')) return
    setDeletingId(s.id)
    const { error } = await supabase.from('sessions').delete().eq('id', s.id)
    setDeletingId(null)
    if (error) {
      console.error(error)
      toast(error.message || 'Failed to delete session', 'error')
      return
    }
    toast('Session deleted')
    loadSessions()
  }

  const hours = useMemo(() => {
    const list: number[] = []
    for (let h = 8; h <= 20; h++) list.push(h)
    return list
  }, [])

  const headerDate = viewDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      <PageHeader
        icon={Mic}
        title="Sessions"
        subtitle="Studio bookings by day — rooms, clients, and status at a glance."
        actions={
          <Button
            variant="primary"
            onClick={openCreate}
            iconLeft={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Book session
          </Button>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-surface px-4 py-3">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <Button
            variant="secondary"
            size="sm"
            onClick={goPrevDay}
            aria-label="Previous day"
            className="!p-2"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div className="min-w-[200px] text-center">
            <p className="text-sm font-medium text-text">{headerDate}</p>
            {isToday && (
              <span className="text-label text-gold">Today</span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={goNextDay}
            aria-label="Next day"
            className="!p-2"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={goToday} disabled={isToday}>
          Today
        </Button>
      </div>

      {loading && sessions.length === 0 ? (
        <div
          className="flex items-center justify-center min-h-[320px]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-9 w-9 animate-spin text-gold" aria-hidden="true" />
          <span className="sr-only">Loading…</span>
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No sessions on this day"
          description="Book the studio and keep the team aligned."
          action={
            <Button
              variant="primary"
              onClick={openCreate}
              iconLeft={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Book the first session
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div
            className="relative hidden lg:block rounded-2xl border border-border bg-bg overflow-hidden"
            aria-hidden="true"
          >
            <div className="border-b border-border bg-surface-alt px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-muted">
              Timeline
            </div>
            <div className="relative h-[640px]">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-border/60 text-[10px] text-text-light pl-2 pt-0.5"
                  style={{ top: `${((h * 60 - DAY_START_MIN) / DAY_RANGE) * 100}%` }}
                >
                  {h > 12 ? h - 12 : h}
                  {h >= 12 ? ' PM' : ' AM'}
                </div>
              ))}
              {sessions.map((s) => {
                const { topPct, heightPct } = blockLayout(s.start_time, s.end_time)
                return (
                  <div
                    key={s.id}
                    className={`absolute left-12 right-2 rounded-xl bg-surface-alt px-2 py-1.5 shadow-sm ${sessionBorderClass(s.status)}`}
                    style={{ top: `${topPct}%`, height: `${heightPct}%`, minHeight: 44 }}
                  >
                    <div className="flex h-full flex-col overflow-hidden">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-text">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[s.status]}`}
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {formatTimeDisplay(s.start_time)} – {formatTimeDisplay(s.end_time)}
                        </span>
                      </div>
                      <p className={`truncate text-xs font-medium ${TYPE_STYLE[s.session_type]}`}>
                        {TYPE_LABELS[s.session_type]}
                      </p>
                      <p className="truncate text-[11px] text-text-muted">
                        {s.client_name || projectNameById.get(s.project_id ?? '') || 'Session'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-text-muted flex items-center gap-2 lg:hidden">
              <Clock className="h-4 w-4 text-gold" aria-hidden="true" />
              {sessions.length} session{sessions.length === 1 ? '' : 's'}
            </h2>
            <ul className="space-y-3">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-2xl bg-surface p-4 transition-colors hover:bg-surface-hover ${sessionBorderClass(s.status)}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex h-2 w-2 rounded-full ${STATUS_DOT[s.status]}`}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold text-text capitalize">{s.status}</span>
                        <span className="text-text-light">·</span>
                        <span className={`text-sm font-medium ${TYPE_STYLE[s.session_type]}`}>
                          {TYPE_LABELS[s.session_type]}
                        </span>
                      </div>
                      <p className="flex items-center gap-2 text-sm text-text">
                        <Clock className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                        {formatTimeDisplay(s.start_time)} – {formatTimeDisplay(s.end_time)}
                      </p>
                      <p className="text-sm text-text-muted">
                        <span className="text-text">Client: </span>
                        {s.client_name || '—'}
                      </p>
                      {s.project_id && (
                        <p className="text-xs text-text-light truncate">
                          Project: {projectNameById.get(s.project_id) ?? s.project_id}
                        </p>
                      )}
                      {s.room && (
                        <p className="text-xs text-text-muted">
                          Room: <span className="text-text">{s.room}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(s)}
                        aria-label="Edit session"
                        className="!p-2"
                      >
                        <Edit2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(s)}
                        loading={deletingId === s.id}
                        aria-label="Delete session"
                        className="!p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10"
                      >
                        {deletingId !== s.id && <Trash2 className="h-4 w-4" aria-hidden="true" />}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
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
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
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
    </div>
  )
}
