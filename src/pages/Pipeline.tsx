import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { fetchPipelineEntries, pipelineKeys } from '../lib/queries/pipeline'
import { fetchTeamMembers, teamMemberKeys } from '../lib/queries/teamMembers'
import { isFollowupOverdue } from '../lib/dates'
import {
  Button, Input, Textarea, Select, Badge, PageHeader,
  type BadgeVariant,
} from '../components/ui'
import PipelineEntryModal from '../components/pipeline/PipelineEntryModal'
import type { ArtistPipelineEntry, TeamMember } from '../types'
import {
  GitBranch,
  Plus,
  Save,
  Loader2,
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

function notesPreview(notes: string | null, max = 72): string {
  if (!notes) return 'No notes'
  const t = notes.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export default function Pipeline() {
  useDocumentTitle('Pipeline - Checkmark Workspace')
  const { profile } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<PipelineForm>(EMPTY_FORM)
  const [expanded, setExpanded] = useState<ArtistPipelineEntry | null>(null)
  const [submittingAdd, setSubmittingAdd] = useState(false)
  const [advancingId, setAdvancingId] = useState<string | null>(null)

  // Phase 3.1 — react-query reads. Both queries share cache across the
  // app, so jumping Pipeline → KPI → Pipeline reuses data until the
  // 30-second stale window lapses. Mutations invalidate pipelineKeys
  // below instead of calling a hand-rolled reload.
  const pipelineQuery = useQuery({
    queryKey: pipelineKeys.list(),
    queryFn: fetchPipelineEntries,
    enabled: !!profile,
  })
  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const entries: ArtistPipelineEntry[] = pipelineQuery.data ?? []
  const teamMembers: TeamMember[] = teamQuery.data ?? []
  const loading = pipelineQuery.isLoading || teamQuery.isLoading

  // Phase 3.5 — teamById was already memoized; keep it but sourced from
  // the shared cache.
  const teamById = useMemo(() => {
    const m = new Map<string, TeamMember>()
    teamMembers.forEach((t) => m.set(t.id, t))
    return m
  }, [teamMembers])

  const reloadPipeline = () =>
    queryClient.invalidateQueries({ queryKey: pipelineKeys.list() })

  // Surface query errors via toast, same shape as the old callbacks.
  if (pipelineQuery.error) {
    toast(`Could not load pipeline: ${(pipelineQuery.error as Error).message}`, 'error')
  }
  if (teamQuery.error) {
    toast(`Could not load team members: ${(teamQuery.error as Error).message}`, 'error')
  }

  const openExpanded = (e: ArtistPipelineEntry) => setExpanded(e)
  const closeExpanded = () => setExpanded(null)

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
    reloadPipeline()
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
    await reloadPipeline()
    if (expanded?.id === entry.id) {
      setExpanded({ ...entry, stage: next })
    }
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

      <PipelineEntryModal
        entry={expanded}
        teamMembers={teamMembers}
        advancingId={advancingId}
        onClose={closeExpanded}
        onSaved={() => { reloadPipeline(); closeExpanded() }}
        onAdvance={handleAdvance}
      />
    </div>
  )
}
