import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  Calendar,
  Check,
  ChevronRight,
  FolderKanban,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { PageHeader } from '../../components/ui'
import { useToast } from '../../components/Toast'
import {
  cancelAssignmentBatch,
  fetchRecentTemplateBatches,
  fetchTaskTemplateLibrary,
  taskTemplateKeys,
} from '../../lib/queries/taskTemplates'
import {
  TemplateCard,
  TemplateEditorModal,
  TemplatePreviewModal,
} from '../../components/admin/templates'
import SessionAssignModal from '../../components/admin/assign/SessionAssignModal'
import PendingTaskRequestsWidget from '../../components/admin/assign/PendingTaskRequestsWidget'
import { AdminAssignWidget } from '../../components/dashboard/adminHubWidgets'
import type { RecentAssignmentBatch } from '../../lib/queries/taskTemplates'

// PR #21 — canonical business-section filter list. Ableton-style.
// Add, rename, or reorder a section here and every admin on every
// device picks it up on next deploy. Keep `value` lowercase to match
// the free-text `task_templates.role_tag` column in the DB.
const CANONICAL_ROLE_TAGS = [
  { value: 'engineer',  label: 'Engineer'  },
  { value: 'marketing', label: 'Marketing' },
  { value: 'intern',    label: 'Intern'    },
  { value: 'dev',       label: 'Dev'       },
  { value: 'admin',     label: 'Admin'     },
  { value: 'ops',       label: 'Ops'       },
] as const

/**
 * Assign page (`/admin/templates`) — Trello-style 3-column layout.
 *
 * PR #20 reorg:
 *   Column 1 "Assign"    — AdminAssignWidget (Session / Task / Task
 *                          Group + Recently Assigned feed) + the
 *                          Reassign-a-Session tile at the bottom.
 *   Column 2 "Approve"   — PendingTaskRequestsWidget (task requests
 *                          awaiting admin approval; inline approve +
 *                          decline + flywheel-stage step).
 *   Column 3 "Templates" — Stats + filter bar + template grid + New
 *                          Template button.
 *
 * RecentAssignmentsSection (last 10 template batches with cancel)
 * spans full-width below the grid since it's a history/audit surface
 * not tied to a single column.
 *
 * Each column is a subtle card with its own header + independent
 * scroll so long feeds in one column don't push the page.
 */

export default function Templates() {
  useDocumentTitle('Assign - Checkmark Workspace')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [onboardingOnly, setOnboardingOnly] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)
  const [sessionAssignOpen, setSessionAssignOpen] = useState(false)

  const libraryQuery = useQuery({
    queryKey: taskTemplateKeys.library(roleFilter, includeInactive),
    queryFn: () =>
      fetchTaskTemplateLibrary({ roleTag: roleFilter, includeInactive }),
  })

  const all = libraryQuery.data ?? []

  // Second unfiltered query so the role-tag pills + stats stay stable
  // regardless of current filter. React Query dedupes identical keys.
  const allForPills = useQuery({
    queryKey: taskTemplateKeys.library(null, includeInactive),
    queryFn: () => fetchTaskTemplateLibrary({ roleTag: null, includeInactive }),
  })

  // PR #21 — canonical business-section pills (Ableton-style).
  // Replaces the dynamically-extracted role_tag pills. Every section
  // always renders with its count so the filter row is stable and
  // scannable. Any role_tag that's NOT in the canonical list still
  // gets a pill (rendered after the canonical set, labeled via
  // title-case) so future studio roles don't need a code change to
  // be filterable — they just render alongside the primary pills.
  const countsByTag = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of allForPills.data ?? []) {
      if (t.role_tag) map[t.role_tag] = (map[t.role_tag] ?? 0) + 1
    }
    return map
  }, [allForPills.data])
  const extraRoleTags = useMemo(() => {
    const canonicalSet = new Set<string>(CANONICAL_ROLE_TAGS.map((t) => t.value))
    return Object.keys(countsByTag)
      .filter((t) => !canonicalSet.has(t))
      .sort()
  }, [countsByTag])

  const templates = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return all.filter((t) => {
      if (onboardingOnly && !t.is_onboarding) return false
      if (!needle) return true
      return (
        t.name.toLowerCase().includes(needle) ||
        (t.description ?? '').toLowerCase().includes(needle) ||
        (t.role_tag ?? '').toLowerCase().includes(needle)
      )
    })
  }, [all, search, onboardingOnly])

  const poolForStats = allForPills.data ?? []
  const activeCount = poolForStats.filter((t) => t.is_active).length
  const onboardingCount = poolForStats.filter((t) => t.is_onboarding).length
  const itemCount = poolForStats.reduce((s, t) => s + t.item_count, 0)

  return (
    <div className="max-w-[1440px] mx-auto animate-fade-in space-y-6">
      <PageHeader
        icon={FolderKanban}
        title="Assign"
        subtitle="Send out sessions, tasks, and task groups · approve member requests · manage the template library."
      />

      {/* ═══ Three-column board ═════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* ─── Column 1 · Assign ──────────────────────────────────── */}
        <Column title="Assign" subtitle="Send work out">
          <div className="space-y-3">
            <AdminAssignWidget />
            <ReassignSessionTile onClick={() => setSessionAssignOpen(true)} />
          </div>
        </Column>

        {/* ─── Column 2 · Approve ─────────────────────────────────── */}
        <Column title="Approve" subtitle="Pending task requests from the team">
          <PendingTaskRequestsWidget />
        </Column>

        {/* ─── Column 3 · Templates ───────────────────────────────── */}
        <Column
          title="Templates"
          subtitle="Reusable blueprints for onboarding + repeat work"
          action={
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold text-black text-[12px] font-bold hover:bg-gold-muted focus-ring"
            >
              <Plus size={12} aria-hidden="true" />
              New
            </button>
          }
        >
          <div className="space-y-3">
            {/* Stats strip */}
            <div className="flex gap-3 px-0.5">
              <Stat label="Active" value={activeCount} muted={libraryQuery.isLoading} />
              <Stat label="Onboarding" value={onboardingCount} muted={libraryQuery.isLoading} />
              <Stat label="Items" value={itemCount} muted={libraryQuery.isLoading} />
            </div>

            {/* Search */}
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-light pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name, description, or tag…"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-surface border border-border text-[13px] focus-ring placeholder:text-text-light/70"
              />
            </div>

            {/* Role pills — Ableton-style fixed canonical list +
                overflow pills for any non-canonical role_tag in the
                DB. Counts always visible next to the label so admins
                can see at a glance how many templates exist per
                section. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterPill
                label="All"
                count={allForPills.data?.length ?? 0}
                active={roleFilter === null}
                onClick={() => setRoleFilter(null)}
              />
              {CANONICAL_ROLE_TAGS.map((tag) => (
                <FilterPill
                  key={tag.value}
                  label={tag.label}
                  count={countsByTag[tag.value] ?? 0}
                  active={roleFilter === tag.value}
                  onClick={() => setRoleFilter(tag.value)}
                />
              ))}
              {extraRoleTags.map((tag) => (
                <FilterPill
                  key={tag}
                  label={tag.charAt(0).toUpperCase() + tag.slice(1)}
                  count={countsByTag[tag] ?? 0}
                  active={roleFilter === tag}
                  onClick={() => setRoleFilter(tag)}
                  subtle
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ToggleChip
                label="Onboarding"
                active={onboardingOnly}
                onClick={() => setOnboardingOnly((v) => !v)}
              />
              <ToggleChip
                label="Include archived"
                active={includeInactive}
                onClick={() => setIncludeInactive((v) => !v)}
              />
            </div>

            {/* Card grid — single column inside the narrow Templates column */}
            {libraryQuery.isLoading ? (
              <div className="py-10 flex items-center justify-center text-text-light">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : libraryQuery.error ? (
              <p className="py-6 text-center text-[12px] text-rose-300">
                Could not load templates.
              </p>
            ) : templates.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
                  <FolderKanban size={18} className="text-gold" aria-hidden="true" />
                </div>
                <p className="text-[13px] font-bold text-text">
                  {all.length === 0 ? 'No templates yet' : 'No matches'}
                </p>
                <p className="text-[11px] text-text-light mt-0.5 max-w-[24ch]">
                  {all.length === 0
                    ? 'Your first reusable blueprint.'
                    : 'Try clearing filters.'}
                </p>
                {all.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setEditorOpen(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold text-black text-[12px] font-bold hover:bg-gold-muted focus-ring"
                  >
                    <Plus size={12} aria-hidden="true" />
                    Create
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onClick={() => setPreviewTemplateId(t.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </Column>
      </div>

      {/* ═══ Full-width history strip ═══════════════════════════════ */}
      <RecentAssignmentsSection />

      {/* ═══ Modals ═════════════════════════════════════════════════ */}
      {editorOpen && (
        <TemplateEditorModal
          onClose={() => setEditorOpen(false)}
          onSaved={(newId) => {
            setEditorOpen(false)
            setPreviewTemplateId(newId)
          }}
        />
      )}
      {previewTemplateId && (
        <TemplatePreviewModal
          templateId={previewTemplateId}
          onClose={() => setPreviewTemplateId(null)}
        />
      )}
      {sessionAssignOpen && (
        <SessionAssignModal onClose={() => setSessionAssignOpen(false)} />
      )}
    </div>
  )
}

// ═══ Column shell ═════════════════════════════════════════════════
//
// Trello-style column card: header with title + subtitle + optional
// action slot, scrollable interior. `max-h` caps column height on
// large viewports so each column scrolls independently instead of
// stretching the page.

function Column({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface-alt/30 flex flex-col max-h-[calc(100vh-240px)] min-h-[480px]">
      <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/60 shrink-0">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold tracking-tight text-text">{title}</h2>
          {subtitle && (
            <p className="text-[11px] text-text-light mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">{children}</div>
    </section>
  )
}

// ═══ Reassign-a-Session tile ══════════════════════════════════════
//
// Sits at the bottom of the Assign column. AdminAssignWidget's Session
// tile creates a NEW booking; this tile reassigns an existing one to a
// different engineer (distinct RPC + distinct flow).

function ReassignSessionTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-surface-alt/60 p-3 hover:bg-surface-hover transition-colors focus-ring"
      aria-label="Reassign a booked session to a different engineer"
    >
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-500/15 ring-1 ring-cyan-500/30 text-cyan-300 shrink-0">
          <Calendar size={16} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-bold text-text">Reassign a session</h3>
          <p className="text-[11px] text-text-light truncate">
            Route an upcoming booking to a different engineer.
          </p>
        </div>
        <ChevronRight size={14} className="text-text-light shrink-0" aria-hidden="true" />
      </div>
    </button>
  )
}

// ═══ Small presentational atoms ═══════════════════════════════════

function Stat({
  label,
  value,
  muted,
}: {
  label: string
  value: number
  muted?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light">
        {label}
      </p>
      <p
        className={`text-[18px] font-bold tracking-tight leading-none mt-0.5 ${
          muted ? 'text-text-muted' : 'text-text'
        }`}
      >
        {muted ? '—' : value}
      </p>
    </div>
  )
}

function FilterPill({
  label,
  count,
  active,
  onClick,
  subtle = false,
}: {
  label: string
  /** Optional template count rendered next to the label (Ableton style). */
  count?: number
  active: boolean
  onClick: () => void
  /** Overflow pills (non-canonical role_tags) render muted so the
   *  canonical set reads as the primary filter set. */
  subtle?: boolean
}) {
  const hasCount = count !== undefined
  const isEmpty = hasCount && count === 0 && !active
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={isEmpty}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
        active
          ? 'bg-gold/20 text-gold ring-1 ring-gold/40'
          : isEmpty
            ? 'bg-surface/60 text-text-light/40 ring-1 ring-border/40 cursor-default'
            : subtle
              ? 'bg-surface-alt/60 text-text-muted ring-1 ring-border/60 hover:text-text hover:bg-surface-hover'
              : 'bg-surface text-text-muted ring-1 ring-border hover:text-text hover:bg-surface-hover'
      }`}
    >
      {label}
      {hasCount && (
        <span
          className={`tabular-nums text-[10px] font-bold ${
            active ? 'text-gold/80' : 'text-text-light/70'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
        active
          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40'
          : 'bg-surface text-text-muted ring-1 ring-border hover:text-text hover:bg-surface-hover'
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? 'bg-emerald-400' : 'bg-text-light/40'
        }`}
        aria-hidden="true"
      />
      {label}
    </button>
  )
}

// ═══ Recent assignments strip (full-width below the columns) ═════
//
// Last 10 template-batch assignments with per-row cancel. Lives
// outside the 3-column grid because it's a history/audit surface
// that doesn't belong to any single column.

function RecentAssignmentsSection() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const batchesQuery = useQuery({
    queryKey: taskTemplateKeys.recentBatches(10),
    queryFn: () => fetchRecentTemplateBatches(10),
  })

  const cancelMutation = useMutation({
    mutationFn: (batchId: string) => cancelAssignmentBatch(batchId, true),
    onSuccess: (result) => {
      toast(
        `Cancelled — ${result.cancelled_recipient_count} ${
          result.cancelled_recipient_count === 1 ? 'recipient' : 'recipients'
        }, ${result.hidden_task_count} open ${
          result.hidden_task_count === 1 ? 'task hidden' : 'tasks hidden'
        }`,
        'success',
      )
      void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to cancel', 'error')
    },
  })

  const batches = batchesQuery.data ?? []

  if (batchesQuery.isLoading) {
    return (
      <section className="pt-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-light mb-2">
          Recent assignments
        </h2>
        <div className="flex items-center gap-2 text-text-light py-4">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[12px]">Loading…</span>
        </div>
      </section>
    )
  }

  if (batches.length === 0) return null

  return (
    <section className="pt-2">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-light">
          Recent template assignments
        </h2>
        <span className="text-[10px] text-text-light">Last 10</span>
      </div>
      <div className="rounded-xl border border-border divide-y divide-border bg-surface-alt/40">
        {batches.map((b) => (
          <BatchRow
            key={b.id}
            batch={b}
            onCancel={() => {
              if (
                confirm(
                  `Cancel "${b.title}"? Active recipients will be marked cancelled and open tasks hidden from their widgets. Completed tasks stay intact.`,
                )
              ) {
                cancelMutation.mutate(b.id)
              }
            }}
            isCancelling={cancelMutation.isPending && cancelMutation.variables === b.id}
          />
        ))}
      </div>
    </section>
  )
}

function BatchRow({
  batch,
  onCancel,
  isCancelling,
}: {
  batch: RecentAssignmentBatch
  onCancel: () => void
  isCancelling: boolean
}) {
  const when = new Date(batch.created_at)
  const whenLabel = when.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const partial = batch.assignment_type === 'template_partial'

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 ${
        batch.cancelled ? 'opacity-50' : ''
      }`}
    >
      <div
        className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
          batch.cancelled
            ? 'bg-white/[0.05] text-text-light'
            : partial
              ? 'bg-amber-500/15 text-amber-300'
              : 'bg-gold/15 text-gold'
        }`}
        aria-hidden="true"
      >
        {batch.cancelled ? <Ban size={13} /> : <Check size={13} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-text truncate">
          {batch.title}
          {partial && !batch.cancelled && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-300 font-bold">
              Partial
            </span>
          )}
          {batch.cancelled && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-text-light font-bold">
              Cancelled
            </span>
          )}
        </p>
        <p className="text-[11px] text-text-light truncate">
          {batch.recipient_count} {batch.recipient_count === 1 ? 'recipient' : 'recipients'}
          {' · '}
          {whenLabel}
        </p>
      </div>
      {!batch.cancelled && (
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-text-light hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
        >
          <X size={12} aria-hidden="true" />
          {isCancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      )}
    </div>
  )
}
