import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import {
  Button, Input, Textarea, Select, Badge, EmptyState, PageHeader, Modal,
  type BadgeVariant,
} from '../components/ui'
import type { ArtistPipelineEntry, TeamMember } from '../types'
import {
  GitBranch,
  Plus,
  Save,
  Loader2,
  Edit2,
  Trash2,
  ChevronRight,
  AlertCircle,
  User,
} from 'lucide-react'

const STAGES: {
  key: ArtistPipelineEntry['stage']
  label: string
  badge: BadgeVariant
}[] = [
  { key: 'inquiry',         label: 'Inquiry',         badge: 'stage-capture' },
  { key: 'onboarding',      label: 'Onboarding',      badge: 'stage-share'   },
  { key: 'active',          label: 'Active',          badge: 'stage-deliver' },
  { key: 'release_support', label: 'Release Support', badge: 'stage-attract' },
  { key: 'alumni',          label: 'Alumni',          badge: 'neutral'       },
]

type PipelineForm = {
  artist_name: string
  contact_email: string
  contact_phone: string
  stage: ArtistPipelineEntry['stage']
  assigned_to: string
  notes: string
  next_followup: string
}

const EMPTY_FORM: PipelineForm = {
  artist_name: '',
  contact_email: '',
  contact_phone: '',
  stage: 'inquiry',
  assigned_to: '',
  notes: '',
  next_followup: '',
}

function isFollowupOverdue(nextFollowup: string | null): boolean {
  if (!nextFollowup) return false
  const d = nextFollowup.slice(0, 10)
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return d < `${y}-${m}-${day}`
}

function notesPreview(notes: string | null, max = 72): string {
  if (!notes) return 'No notes'
  const t = notes.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function entryToForm(e: ArtistPipelineEntry): PipelineForm {
  return {
    artist_name: e.artist_name,
    contact_email: e.contact_email ?? '',
    contact_phone: e.contact_phone ?? '',
    stage: e.stage,
    assigned_to: e.assigned_to ?? '',
    notes: e.notes ?? '',
    next_followup: e.next_followup ? e.next_followup.slice(0, 10) : '',
  }
}

export default function Pipeline() {
  useDocumentTitle('Pipeline - Checkmark Audio')
  const { profile } = useAuth()
  const { toast } = useToast()
  const [entries, setEntries] = useState<ArtistPipelineEntry[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<PipelineForm>(EMPTY_FORM)
  const [expanded, setExpanded] = useState<ArtistPipelineEntry | null>(null)
  const [editForm, setEditForm] = useState<PipelineForm>(EMPTY_FORM)
  const [submittingAdd, setSubmittingAdd] = useState(false)
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [advancingId, setAdvancingId] = useState<string | null>(null)

  const teamById = useMemo(() => {
    const m = new Map<string, TeamMember>()
    teamMembers.forEach((t) => m.set(t.id, t))
    return m
  }, [teamMembers])

  const loadTeam = useCallback(async () => {
    const { data, error } = await supabase
      .from('intern_users')
      .select('*')
      .order('display_name')
    if (error) {
      console.error('Load team error:', error)
      toast(`Could not load team members: ${error.message}`, 'error')
      return
    }
    if (data) setTeamMembers(data as TeamMember[])
  }, [toast])

  const loadPipeline = useCallback(async () => {
    if (!profile) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('artist_pipeline')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) {
      console.error('Load pipeline error:', error)
      toast(`Could not load pipeline: ${error.message}`, 'error')
      setLoading(false)
      return
    }
    if (data) setEntries(data as ArtistPipelineEntry[])
    setLoading(false)
  }, [profile, toast])

  useEffect(() => {
    loadTeam()
  }, [loadTeam])

  useEffect(() => {
    setLoading(true)
    loadPipeline()
  }, [loadPipeline])

  const openExpanded = (e: ArtistPipelineEntry) => {
    setExpanded(e)
    setEditForm(entryToForm(e))
  }

  const closeExpanded = () => {
    setExpanded(null)
  }

  const handleAddSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!profile) return
    setSubmittingAdd(true)
    const payload = {
      artist_name: addForm.artist_name.trim(),
      contact_email: addForm.contact_email.trim() || null,
      contact_phone: addForm.contact_phone.trim() || null,
      stage: addForm.stage,
      assigned_to: addForm.assigned_to || null,
      notes: addForm.notes.trim() || null,
      next_followup: addForm.next_followup || null,
    }
    const { error } = await supabase.from('artist_pipeline').insert(payload)
    setSubmittingAdd(false)
    if (error) {
      console.error(error)
      toast(error.message || 'Could not add artist', 'error')
      return
    }
    toast('Artist added', 'success')
    setShowAddForm(false)
    setAddForm(EMPTY_FORM)
    loadPipeline()
  }

  const handleEditSave = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!expanded) return
    setSubmittingEdit(true)
    const payload = {
      artist_name: editForm.artist_name.trim(),
      contact_email: editForm.contact_email.trim() || null,
      contact_phone: editForm.contact_phone.trim() || null,
      stage: editForm.stage,
      assigned_to: editForm.assigned_to || null,
      notes: editForm.notes.trim() || null,
      next_followup: editForm.next_followup || null,
    }
    const { error } = await supabase
      .from('artist_pipeline')
      .update(payload)
      .eq('id', expanded.id)
    setSubmittingEdit(false)
    if (error) {
      console.error(error)
      toast(error.message || 'Could not save changes', 'error')
      return
    }
    toast('Saved', 'success')
    loadPipeline()
    const { data } = await supabase.from('artist_pipeline').select('*').eq('id', expanded.id).maybeSingle()
    if (data) {
      setExpanded(data as ArtistPipelineEntry)
      setEditForm(entryToForm(data as ArtistPipelineEntry))
    } else {
      closeExpanded()
    }
  }

  const handleAdvance = async (entry: ArtistPipelineEntry, e?: React.SyntheticEvent) => {
    e?.stopPropagation()
    const idx = STAGES.findIndex((s) => s.key === entry.stage)
    if (idx < 0 || idx >= STAGES.length - 1) return
    const nextStage = STAGES[idx + 1]
    if (!nextStage) return
    const next = nextStage.key
    setAdvancingId(entry.id)
    const { error } = await supabase
      .from('artist_pipeline')
      .update({ stage: next })
      .eq('id', entry.id)
    setAdvancingId(null)
    if (error) {
      console.error(error)
      toast(error.message || 'Could not advance stage', 'error')
      return
    }
    toast(`Moved to ${nextStage.label}`, 'success')
    await loadPipeline()
    if (expanded?.id === entry.id) {
      setExpanded({ ...entry, stage: next })
      setEditForm((f) => ({ ...f, stage: next }))
    }
  }

  const handleDelete = async () => {
    if (!expanded) return
    if (!confirm(`Remove "${expanded.artist_name}" from the pipeline?`)) return
    const { error } = await supabase.from('artist_pipeline').delete().eq('id', expanded.id)
    if (error) {
      console.error(error)
      toast(error.message || 'Could not delete', 'error')
      return
    }
    toast('Artist removed', 'success')
    closeExpanded()
    loadPipeline()
  }

  const assigneeLabel = (id: string | null) => {
    if (!id) return 'Unassigned'
    return teamById.get(id)?.display_name ?? 'Unknown'
  }

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
        Sign in to view the artist pipeline.
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in pb-8">
      <PageHeader
        icon={GitBranch}
        title="Artist pipeline"
        subtitle="Track artists from inquiry through alumni."
        actions={
          <Button
            variant={showAddForm ? 'secondary' : 'primary'}
            onClick={() => {
              setShowAddForm((v) => !v)
              if (showAddForm) setAddForm(EMPTY_FORM)
            }}
            iconLeft={<Plus size={18} aria-hidden="true" />}
          >
            {showAddForm ? 'Close' : 'Add artist'}
          </Button>
        }
      />

      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4"
        >
          <h2 className="text-lg font-medium text-text flex items-center gap-2">
            <Plus size={18} className="text-gold" aria-hidden="true" />
            New artist
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="pipe-add-name"
              label="Artist name"
              required
              placeholder="Artist or project name"
              value={addForm.artist_name}
              onChange={(e) => setAddForm({ ...addForm, artist_name: e.target.value })}
              wrapperClassName="sm:col-span-2"
            />
            <Input
              id="pipe-add-email"
              label="Email"
              type="email"
              placeholder="contact@\u2026"
              value={addForm.contact_email}
              onChange={(e) => setAddForm({ ...addForm, contact_email: e.target.value })}
            />
            <Input
              id="pipe-add-phone"
              label="Phone"
              placeholder="Optional"
              value={addForm.contact_phone}
              onChange={(e) => setAddForm({ ...addForm, contact_phone: e.target.value })}
            />
            <Select
              id="pipe-add-stage"
              label="Stage"
              value={addForm.stage}
              onChange={(e) => setAddForm({ ...addForm, stage: e.target.value as ArtistPipelineEntry['stage'] })}
            >
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
            <Select
              id="pipe-add-assigned"
              label="Assigned to"
              value={addForm.assigned_to}
              onChange={(e) => setAddForm({ ...addForm, assigned_to: e.target.value })}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </Select>
            <Input
              id="pipe-add-followup"
              label="Next follow-up"
              type="date"
              value={addForm.next_followup}
              onChange={(e) => setAddForm({ ...addForm, next_followup: e.target.value })}
            />
            <Textarea
              id="pipe-add-notes"
              label="Notes"
              rows={3}
              placeholder="Internal notes\u2026"
              value={addForm.notes}
              onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
              wrapperClassName="sm:col-span-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddForm(false)
                setAddForm(EMPTY_FORM)
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submittingAdd}
              iconLeft={!submittingAdd ? <Save size={16} aria-hidden="true" /> : undefined}
            >
              Save artist
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="flex min-w-max gap-4 items-start">
          {STAGES.map((col) => {
            const colEntries = entries.filter((e) => e.stage === col.key)
            return (
              <div
                key={col.key}
                role="region"
                aria-label={col.label}
                className="w-[280px] shrink-0 flex flex-col rounded-2xl border border-border bg-surface-alt/80"
              >
                <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                  <Badge variant={col.badge} size="sm">{col.label}</Badge>
                  <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-text-muted">
                    {colEntries.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-2 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto">
                  {colEntries.map((entry) => {
                    const overdue = isFollowupOverdue(entry.next_followup)
                    return (
                      <div
                        key={entry.id}
                        className={`w-full rounded-xl border text-left transition-colors ${
                          overdue
                            ? 'border-red-500/50 bg-red-950/20 hover:bg-red-950/35'
                            : 'border-border bg-surface hover:bg-surface-hover hover:border-border-light'
                        }`}
                      >
                        <div className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openExpanded(entry)}
                              className="font-medium text-text text-sm leading-snug hover:underline text-left"
                            >
                              {entry.artist_name}
                            </button>
                            {overdue && (
                              <AlertCircle
                                size={16}
                                className="shrink-0 text-red-400"
                                aria-label="Follow-up overdue"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <User size={12} className="shrink-0" aria-hidden="true" />
                            <span className="truncate">{assigneeLabel(entry.assigned_to)}</span>
                          </div>
                          {entry.next_followup && (
                            <p
                              className={`text-xs ${
                                overdue ? 'text-red-300 font-medium' : 'text-text-light'
                              }`}
                            >
                              Follow-up: {entry.next_followup.slice(0, 10)}
                            </p>
                          )}
                          <p className="text-xs text-text-light line-clamp-2">{notesPreview(entry.notes)}</p>
                          {entry.stage !== 'alumni' && (
                            <div className="pt-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={(ev) => handleAdvance(entry, ev)}
                                loading={advancingId === entry.id}
                                iconLeft={advancingId !== entry.id ? <ChevronRight size={12} aria-hidden="true" /> : undefined}
                                className="text-gold hover:text-gold"
                              >
                                Advance
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {colEntries.length === 0 && (
                    <p className="py-6 text-center text-xs text-text-light">No artists</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Modal
        open={!!expanded}
        onClose={closeExpanded}
        title={
          <span className="flex items-center gap-2">
            <Edit2 size={18} className="text-gold" aria-hidden="true" />
            {expanded?.artist_name ?? ''}
          </span>
        }
        size="lg"
        locked={submittingEdit}
      >
        <form onSubmit={handleEditSave} className="space-y-4">
          <Input
            id="pipe-edit-name"
            label="Artist name"
            required
            value={editForm.artist_name}
            onChange={(e) => setEditForm({ ...editForm, artist_name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="pipe-edit-email"
              label="Email"
              type="email"
              value={editForm.contact_email}
              onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
            />
            <Input
              id="pipe-edit-phone"
              label="Phone"
              value={editForm.contact_phone}
              onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
            />
          </div>
          <Select
            id="pipe-edit-stage"
            label="Stage"
            value={editForm.stage}
            onChange={(e) => setEditForm({ ...editForm, stage: e.target.value as ArtistPipelineEntry['stage'] })}
          >
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
          <Select
            id="pipe-edit-assigned"
            label="Assigned to"
            value={editForm.assigned_to}
            onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
          >
            <option value="">Unassigned</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </Select>
          <Input
            id="pipe-edit-followup"
            label="Next follow-up"
            type="date"
            value={editForm.next_followup}
            onChange={(e) => setEditForm({ ...editForm, next_followup: e.target.value })}
          />
          <Textarea
            id="pipe-edit-notes"
            label="Notes"
            rows={4}
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            {expanded && editForm.stage !== 'alumni' && (
              <Button
                type="button"
                variant="secondary"
                onClick={(ev) => handleAdvance(expanded, ev)}
                loading={advancingId === expanded.id}
                iconLeft={advancingId !== expanded.id ? <ChevronRight size={16} aria-hidden="true" /> : undefined}
                className="text-gold hover:text-gold"
              >
                Advance stage
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              iconLeft={<Trash2 size={16} aria-hidden="true" />}
            >
              Delete
            </Button>
            <div className="flex-1 min-w-[120px]" />
            <Button
              type="submit"
              variant="primary"
              loading={submittingEdit}
              iconLeft={!submittingEdit ? <Save size={16} aria-hidden="true" /> : undefined}
            >
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
