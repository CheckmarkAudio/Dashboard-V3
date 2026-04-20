import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import type { EducationStudent, TeamMember } from '../types'
import {
  GraduationCap,
  Plus,
  X,
  Save,
  Loader2,
  Edit2,
  Trash2,
  Search,
} from 'lucide-react'

const STATUS_OPTIONS: EducationStudent['status'][] = ['active', 'paused', 'completed']

type StudentForm = {
  student_name: string
  contact_email: string
  instrument: string
  level: string
  status: EducationStudent['status']
  assigned_to: string
  notes: string
}

const EMPTY_FORM: StudentForm = {
  student_name: '',
  contact_email: '',
  instrument: '',
  level: '',
  status: 'active',
  assigned_to: '',
  notes: '',
}

function studentToForm(s: EducationStudent): StudentForm {
  return {
    student_name: s.student_name,
    contact_email: s.contact_email ?? '',
    instrument: s.instrument ?? '',
    level: s.level ?? '',
    status: s.status,
    assigned_to: s.assigned_to ?? '',
    notes: s.notes ?? '',
  }
}

function StatusBadge({ status }: { status: EducationStudent['status'] }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize'
  if (status === 'active') {
    return <span className={`${base} bg-emerald-500/15 text-emerald-400 border border-emerald-500/30`}>{status}</span>
  }
  if (status === 'paused') {
    return <span className={`${base} bg-gold/15 text-gold border border-gold/35`}>{status}</span>
  }
  return <span className={`${base} bg-surface-hover text-text-light border border-border`}>{status}</span>
}

export default function Education() {
  useDocumentTitle('Education - Checkmark Workspace')
  const { profile } = useAuth()
  const { toast } = useToast()
  const [students, setStudents] = useState<EducationStudent[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | EducationStudent['status']>('all')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [showForm, setShowForm] = useState(false)
  const [editingStudent, setEditingStudent] = useState<EducationStudent | null>(null)
  const [formData, setFormData] = useState<StudentForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const teamById = useMemo(() => {
    const m = new Map<string, TeamMember>()
    teamMembers.forEach((t) => m.set(t.id, t))
    return m
  }, [teamMembers])

  const loadTeam = useCallback(async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('display_name')
    if (error) {
      console.error('Load team error:', error)
      toast(`Could not load team members: ${error.message}`, 'error')
      return
    }
    if (data) setTeamMembers(data as TeamMember[])
  }, [toast])

  const loadStudents = useCallback(async () => {
    if (!profile) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('education_students')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Load students error:', error)
      toast(`Could not load students: ${error.message}`, 'error')
      setLoading(false)
      return
    }
    if (data) setStudents(data as EducationStudent[])
    setLoading(false)
  }, [profile, toast])

  useEffect(() => {
    loadTeam()
  }, [loadTeam])

  useEffect(() => {
    setLoading(true)
    loadStudents()
  }, [loadStudents])

  const openNew = () => {
    setEditingStudent(null)
    setFormData(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (s: EducationStudent) => {
    setEditingStudent(s)
    setFormData(studentToForm(s))
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingStudent(null)
    setFormData(EMPTY_FORM)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSubmitting(true)
    const payload = {
      student_name: formData.student_name.trim(),
      contact_email: formData.contact_email.trim() || null,
      instrument: formData.instrument.trim() || null,
      level: formData.level.trim() || null,
      status: formData.status,
      assigned_to: formData.assigned_to || null,
      notes: formData.notes.trim() || null,
    }
    if (editingStudent) {
      const { error } = await supabase
        .from('education_students')
        .update(payload)
        .eq('id', editingStudent.id)
      setSubmitting(false)
      if (error) {
        console.error(error)
        toast(error.message || 'Could not update student', 'error')
        return
      }
      toast('Student updated', 'success')
    } else {
      const { error } = await supabase.from('education_students').insert(payload)
      setSubmitting(false)
      if (error) {
        console.error(error)
        toast(error.message || 'Could not add student', 'error')
        return
      }
      toast('Student added', 'success')
    }
    closeForm()
    loadStudents()
  }

  const handleDelete = async (s: EducationStudent) => {
    if (!confirm(`Remove ${s.student_name} from the roster?`)) return
    const { error } = await supabase.from('education_students').delete().eq('id', s.id)
    if (error) {
      console.error(error)
      toast(error.message || 'Could not delete', 'error')
      return
    }
    toast('Student removed', 'success')
    if (editingStudent?.id === s.id) closeForm()
    loadStudents()
  }

  const teacherLabel = (id: string | null) => {
    if (!id) return '—'
    return teamById.get(id)?.display_name ?? 'Unknown'
  }

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const teacher = s.assigned_to
        ? (teamById.get(s.assigned_to)?.display_name ?? 'Unknown')
        : '—'
      return (
        s.student_name.toLowerCase().includes(q) ||
        (s.instrument && s.instrument.toLowerCase().includes(q)) ||
        (s.level && s.level.toLowerCase().includes(q)) ||
        (s.contact_email && s.contact_email.toLowerCase().includes(q)) ||
        teacher.toLowerCase().includes(q)
      )
    })
  }, [students, statusFilter, search, teamById])

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[40vh]"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-gold" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
        Sign in to manage education students.
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/30 bg-surface-alt text-gold">
            <GraduationCap size={22} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text">Education</h1>
            <p className="mt-0.5 text-sm text-text-muted">Music school students and lesson tracking.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => (showForm ? closeForm() : openNew())}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-hover hover:border-gold/40"
        >
          {showForm ? <X size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
          {showForm ? 'Close' : 'Add student'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4"
        >
          <h2 className="text-lg font-medium text-text flex items-center gap-2">
            {editingStudent ? (
              <Edit2 size={18} className="text-gold" aria-hidden="true" />
            ) : (
              <Plus size={18} className="text-gold" aria-hidden="true" />
            )}
            {editingStudent ? 'Edit student' : 'New student'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="edu-student-name"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted"
              >
                Student name *
              </label>
              <input
                id="edu-student-name"
                required
                value={formData.student_name}
                onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                placeholder="Full name"
              />
            </div>
            <div>
              <label
                htmlFor="edu-email"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted"
              >
                Email
              </label>
              <input
                id="edu-email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="edu-instrument"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted"
              >
                Instrument
              </label>
              <input
                id="edu-instrument"
                value={formData.instrument}
                onChange={(e) => setFormData({ ...formData, instrument: e.target.value })}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                placeholder="e.g. Piano, Voice"
              />
            </div>
            <div>
              <label
                htmlFor="edu-level"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted"
              >
                Level
              </label>
              <input
                id="edu-level"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                placeholder="Beginner, intermediate…"
              />
            </div>
            <div>
              <label
                htmlFor="edu-status"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted"
              >
                Status
              </label>
              <select
                id="edu-status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as EducationStudent['status'] })
                }
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st} className="capitalize">
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="edu-assigned-to"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted"
              >
                Assigned teacher
              </label>
              <select
                id="edu-assigned-to"
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="edu-notes"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted"
              >
                Notes
              </label>
              <textarea
                id="edu-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-xl border border-border px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {editingStudent && (
              <button
                type="button"
                onClick={() => handleDelete(editingStudent)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-950/30"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-muted hover:bg-surface-hover hover:text-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Save size={16} aria-hidden="true" />
              )}
              {editingStudent ? 'Save changes' : 'Add student'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students, instrument, teacher…"
            aria-label="Search students"
            className="w-full rounded-xl border border-border py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            aria-label="Filter by status"
            className="rounded-xl border border-border px-3 py-2.5 text-sm"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st} className="capitalize">
                {st}
              </option>
            ))}
          </select>
          <div className="flex rounded-xl border border-border p-0.5 bg-surface-alt" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'table'}
              onClick={() => setViewMode('table')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-surface text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'cards'}
              onClick={() => setViewMode('cards')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'cards' ? 'bg-surface text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface py-16 text-center text-text-muted text-sm">
          No students match your filters.
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-alt text-left">
                  <th className="px-4 py-3 font-medium text-text-muted">Student</th>
                  <th className="px-4 py-3 font-medium text-text-muted hidden sm:table-cell">Instrument</th>
                  <th className="px-4 py-3 font-medium text-text-muted hidden md:table-cell">Level</th>
                  <th className="px-4 py-3 font-medium text-text-muted">Status</th>
                  <th className="px-4 py-3 font-medium text-text-muted hidden lg:table-cell">Teacher</th>
                  <th className="px-4 py-3 w-24">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-hover/80 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-text">{s.student_name}</span>
                      {s.contact_email && (
                        <p className="text-xs text-text-light mt-0.5 truncate max-w-[200px]">{s.contact_email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted hidden sm:table-cell">
                      {s.instrument || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-muted hidden md:table-cell">{s.level || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-text-muted hidden lg:table-cell">
                      {teacherLabel(s.assigned_to)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="rounded-lg p-2 text-text-muted hover:bg-surface-hover hover:text-gold"
                          aria-label="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="rounded-lg p-2 text-text-muted hover:bg-red-950/40 hover:text-red-400"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-border bg-surface-alt/80 p-4 flex flex-col gap-3 hover:border-border-light transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-text">{s.student_name}</h3>
                  {s.contact_email && (
                    <p className="text-xs text-text-light mt-0.5">{s.contact_email}</p>
                  )}
                </div>
                <StatusBadge status={s.status} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-text-light">Instrument</dt>
                  <dd className="text-text-muted mt-0.5">{s.instrument || '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-light">Level</dt>
                  <dd className="text-text-muted mt-0.5">{s.level || '—'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-text-light">Teacher</dt>
                  <dd className="text-text-muted mt-0.5">{teacherLabel(s.assigned_to)}</dd>
                </div>
              </dl>
              {s.notes && (
                <p className="text-xs text-text-light line-clamp-2 border-t border-border pt-2">{s.notes}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => openEdit(s)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-medium text-text hover:bg-surface-hover"
                >
                  <Edit2 size={14} aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/25"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
