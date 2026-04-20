import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { supabase } from '../lib/supabase'
import type { Project, TeamMember } from '../types'
import {
  FolderKanban,
  Plus,
  X,
  Save,
  Loader2,
  Edit2,
  Trash2,
  Filter,
} from 'lucide-react'

const PROJECT_TYPES: Project['project_type'][] = [
  'recording',
  'mixing',
  'mastering',
  'artist_dev',
  'education',
  'internal',
]

const STATUS_OPTIONS: Project['status'][] = ['active', 'paused', 'completed', 'archived']

const TYPE_LABELS: Record<Project['project_type'], string> = {
  recording: 'Recording',
  mixing: 'Mixing',
  mastering: 'Mastering',
  artist_dev: 'Artist dev',
  education: 'Education',
  internal: 'Internal',
}

const TYPE_BADGE: Record<Project['project_type'], string> = {
  recording: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  mixing: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  mastering: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  artist_dev: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  education: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  internal: 'bg-text-light/10 text-text-muted border-border',
}

const STATUS_BADGE: Record<Project['status'], string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  paused: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  completed: 'bg-text-light/10 text-text-muted border-border',
  archived: 'bg-text-light/5 text-text-light border-border',
}

type ProjectFormState = {
  name: string
  client_name: string
  project_type: Project['project_type']
  status: Project['status']
  assigned_to: string
  notes: string
  due_date: string
}

const EMPTY_FORM: ProjectFormState = {
  name: '',
  client_name: '',
  project_type: 'recording',
  status: 'active',
  assigned_to: '',
  notes: '',
  due_date: '',
}

function formatDueDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function Projects() {
  useDocumentTitle('Projects - Checkmark Workspace')
  const { profile } = useAuth()
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [team, setTeam] = useState<Pick<TeamMember, 'id' | 'display_name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectFormState>(EMPTY_FORM)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const memberNameById = useMemo(() => {
    const m = new Map<string, string>()
    team.forEach((t) => m.set(t.id, t.display_name))
    return m
  }, [team])

  const loadTeam = useCallback(async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('id, display_name')
      .order('display_name', { ascending: true })
    if (error) {
      console.error(error)
      toast('Could not load team members', 'error')
      return
    }
    if (data) setTeam(data as Pick<TeamMember, 'id' | 'display_name'>[])
  }, [toast])

  const loadProjects = useCallback(async () => {
    if (!profile) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) {
      console.error(error)
      toast('Could not load projects', 'error')
      setProjects([])
    } else if (data) {
      setProjects(data as Project[])
    }
    setLoading(false)
  }, [profile, toast])

  useEffect(() => {
    loadTeam()
  }, [loadTeam])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (p: Project) => {
    setEditing(p)
    setForm({
      name: p.name,
      client_name: p.client_name ?? '',
      project_type: p.project_type,
      status: p.status,
      assigned_to: p.assigned_to ?? '',
      notes: p.notes ?? '',
      due_date: p.due_date ? p.due_date.slice(0, 10) : '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    if (submitting) return
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSubmitting(true)

    const payload = {
      name: form.name.trim(),
      client_name: form.client_name.trim() || null,
      project_type: form.project_type,
      status: form.status,
      assigned_to: form.assigned_to || null,
      notes: form.notes.trim() || null,
      due_date: form.due_date || null,
    }

    if (editing) {
      const { error } = await supabase.from('projects').update(payload).eq('id', editing.id)
      if (error) {
        console.error(error)
        toast(error.message || 'Failed to update project', 'error')
        setSubmitting(false)
        return
      }
      toast('Project updated')
    } else {
      const { error } = await supabase.from('projects').insert(payload)
      if (error) {
        console.error(error)
        toast(error.message || 'Failed to create project', 'error')
        setSubmitting(false)
        return
      }
      toast('Project created')
    }

    setSubmitting(false)
    closeModal()
    loadProjects()
  }

  const handleDelete = async (p: Project) => {
    if (!confirm(`Delete project “${p.name}”? This cannot be undone.`)) return
    setDeletingId(p.id)
    const { error } = await supabase.from('projects').delete().eq('id', p.id)
    setDeletingId(null)
    if (error) {
      console.error(error)
      toast(error.message || 'Failed to delete project', 'error')
      return
    }
    toast('Project deleted')
    loadProjects()
  }

  const filtered = projects.filter((p) => {
    if (filterType !== 'all' && p.project_type !== filterType) return false
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    return true
  })

  if (loading && projects.length === 0) {
    return (
      <div
        className="flex items-center justify-center min-h-[40vh]"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-9 w-9 animate-spin text-gold" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-alt border border-border">
            <FolderKanban className="h-5 w-5 text-gold" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text">Projects</h1>
            <p className="mt-1 text-sm text-text-muted">
              Studio productions — tracking, mixing, and artist work in one place.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New project
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-text-muted">
          <Filter className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-wider">Filters</span>
        </div>
        <div className="flex flex-1 flex-wrap gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="min-w-[140px] rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm"
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="min-w-[140px] rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-text-light sm:ml-auto">
          {filtered.length} of {projects.length} shown
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
          <p className="text-sm text-text-muted">No projects match these filters.</p>
          <button
            type="button"
            onClick={() => {
              setFilterType('all')
              setFilterStatus('all')
            }}
            className="mt-3 text-sm text-gold hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="group flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-border hover:bg-surface-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-text leading-snug line-clamp-2">{p.name}</h2>
                <div className="flex shrink-0 gap-1 opacity-80 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="rounded-lg p-1.5 text-text-muted hover:bg-surface-alt hover:text-text"
                    aria-label="Edit project"
                  >
                    <Edit2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    disabled={deletingId === p.id}
                    className="rounded-lg p-1.5 text-text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                    aria-label="Delete project"
                  >
                    {deletingId === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
              {p.client_name ? (
                <p className="mt-2 text-sm text-text-muted line-clamp-1">{p.client_name}</p>
              ) : (
                <p className="mt-2 text-sm text-text-light italic">No client</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[p.project_type]}`}
                >
                  {TYPE_LABELS[p.project_type]}
                </span>
                <span
                  className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[p.status]}`}
                >
                  {p.status}
                </span>
              </div>
              <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-xs text-text-muted">
                <div className="flex justify-between gap-2">
                  <dt>Assigned</dt>
                  <dd className="text-text text-right">
                    {p.assigned_to ? memberNameById.get(p.assigned_to) ?? '—' : 'Unassigned'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Due</dt>
                  <dd className="text-text text-right">{formatDueDate(p.due_date)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-modal-title"
        >
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface shadow-xl animate-slide-up">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
              <h2 id="project-modal-title" className="text-lg font-semibold text-text">
                {editing ? 'Edit project' : 'New project'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-text-muted hover:bg-surface-hover hover:text-text"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div>
                <label htmlFor="project-form-name" className="mb-1.5 block text-sm font-medium text-text">
                  Name
                </label>
                <input
                  id="project-form-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                  placeholder="e.g. Artist LP — vocals week"
                />
              </div>
              <div>
                <label htmlFor="project-form-client" className="mb-1.5 block text-sm font-medium text-text">
                  Client
                </label>
                <input
                  id="project-form-client"
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                  placeholder="Optional"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="project-form-type" className="mb-1.5 block text-sm font-medium text-text">
                    Type
                  </label>
                  <select
                    id="project-form-type"
                    value={form.project_type}
                    onChange={(e) =>
                      setForm({ ...form, project_type: e.target.value as Project['project_type'] })
                    }
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                  >
                    {PROJECT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="project-form-status" className="mb-1.5 block text-sm font-medium text-text">
                    Status
                  </label>
                  <select
                    id="project-form-status"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as Project['status'] })
                    }
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm capitalize"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="project-form-assigned" className="mb-1.5 block text-sm font-medium text-text">
                  Assigned to
                </label>
                <select
                  id="project-form-assigned"
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                >
                  <option value="">Unassigned</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="project-form-due-date" className="mb-1.5 block text-sm font-medium text-text">
                  Due date
                </label>
                <input
                  id="project-form-due-date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="project-form-notes" className="mb-1.5 block text-sm font-medium text-text">
                  Notes
                </label>
                <textarea
                  id="project-form-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border px-3 py-2.5 text-sm"
                  placeholder="Internal notes…"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-muted hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  )}
                  {editing ? 'Save changes' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
