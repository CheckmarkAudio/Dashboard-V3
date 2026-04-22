import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Loader2, Plus, Search } from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { PageHeader } from '../../components/ui'
import {
  fetchTaskTemplateLibrary,
  taskTemplateKeys,
} from '../../lib/queries/taskTemplates'
import {
  TemplateCard,
  TemplateEditorModal,
  TemplatePreviewModal,
} from '../../components/admin/templates'

/**
 * Assign page (`/admin/templates`) — the comprehensive template library.
 *
 * Shipped in PR #9 as a full replacement of the legacy Templates.tsx
 * which targeted the `report_templates` table. This page targets the
 * new `task_templates` system (admin blueprints for one-off assignments)
 * and calls only the PR #6 + PR #8 RPCs — zero direct table writes.
 *
 * Hero header + filter bar + card grid + "New Template" CTA. Clicking
 * a card opens TemplatePreviewModal, which branches into edit /
 * duplicate / assign / archive flows.
 *
 * Legacy `report_templates` direct-CRUD surface is intentionally gone.
 * Admins still manage daily-checklist templates via the existing
 * `PublishChecklistModal`. Phase 3 will unify the two template concepts.
 */

export default function Templates() {
  useDocumentTitle('Assign - Checkmark Workspace')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [onboardingOnly, setOnboardingOnly] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)

  const libraryQuery = useQuery({
    queryKey: taskTemplateKeys.library(roleFilter, includeInactive),
    queryFn: () =>
      fetchTaskTemplateLibrary({ roleTag: roleFilter, includeInactive }),
  })

  const all = libraryQuery.data ?? []

  // A second unfiltered query so the role-tag pills + stats remain
  // stable regardless of the current filter selection. React Query
  // dedupes identical keys so this is a shared cache entry; the call
  // only actually hits Supabase once per (null, includeInactive) pair.
  const allForPills = useQuery({
    queryKey: taskTemplateKeys.library(null, includeInactive),
    queryFn: () => fetchTaskTemplateLibrary({ roleTag: null, includeInactive }),
  })
  const roleTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of allForPills.data ?? []) {
      if (t.role_tag) set.add(t.role_tag)
    }
    return Array.from(set).sort()
  }, [allForPills.data])

  // ── Client-side filters (search + onboarding) ────────────────────
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

  // ── Stats for the hero ───────────────────────────────────────────
  const poolForStats = allForPills.data ?? []
  const activeCount = poolForStats.filter((t) => t.is_active).length
  const onboardingCount = poolForStats.filter((t) => t.is_onboarding).length
  const itemCount = poolForStats.reduce((s, t) => s + t.item_count, 0)

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <PageHeader
        icon={FolderKanban}
        title="Assign"
        subtitle="Build reusable templates for onboarding, role-specific work, and anything you'll send out more than once. Click a card to preview, edit, duplicate, or assign."
      />

      {/* Top row: stats + New Template ─────────────────────────────── */}
      <section className="flex items-center justify-between gap-4">
        <div className="flex gap-6">
          <Stat label="Templates" value={activeCount} muted={libraryQuery.isLoading} />
          <Stat label="Onboarding" value={onboardingCount} muted={libraryQuery.isLoading} />
          <Stat label="Items" value={itemCount} muted={libraryQuery.isLoading} />
        </div>
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold text-black text-sm font-bold hover:bg-gold-muted focus-ring"
        >
          <Plus size={16} aria-hidden="true" />
          New Template
        </button>
      </section>

      {/* Filter bar ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter templates by name, description, or tag…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-alt border border-border text-sm focus-ring placeholder:text-text-light/70"
          />
        </div>

        {/* Role tag pills + toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            label="All roles"
            active={roleFilter === null}
            onClick={() => setRoleFilter(null)}
          />
          {roleTags.map((tag) => (
            <FilterPill
              key={tag}
              label={tag}
              active={roleFilter === tag}
              onClick={() => setRoleFilter(tag)}
            />
          ))}
          <div className="flex-1" />
          <ToggleChip
            label="Onboarding only"
            active={onboardingOnly}
            onClick={() => setOnboardingOnly((v) => !v)}
          />
          <ToggleChip
            label="Include archived"
            active={includeInactive}
            onClick={() => setIncludeInactive((v) => !v)}
          />
        </div>
      </section>

      {/* Grid ──────────────────────────────────────────────────────── */}
      <section>
        {libraryQuery.isLoading ? (
          <div className="py-16 flex items-center justify-center text-text-light">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : libraryQuery.error ? (
          <p className="py-8 text-center text-[13px] text-rose-300">
            Could not load templates.
          </p>
        ) : templates.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gold/10 ring-1 ring-gold/20 mb-3">
              <FolderKanban size={22} className="text-gold" aria-hidden="true" />
            </div>
            <p className="text-[15px] font-bold text-text">
              {all.length === 0 ? 'No templates yet' : 'No matches'}
            </p>
            <p className="text-[12px] text-text-light mt-1 max-w-sm">
              {all.length === 0
                ? "Create your first reusable blueprint. Onboarding, weekly priorities, role-specific checklists — anything you'll assign more than once."
                : 'Try clearing filters or widening your search.'}
            </p>
            {all.length === 0 && (
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-black text-sm font-bold hover:bg-gold-muted focus-ring"
              >
                <Plus size={14} aria-hidden="true" />
                Create template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onClick={() => setPreviewTemplateId(t.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modals ──────────────────────────────────────────────────── */}
      {editorOpen && (
        <TemplateEditorModal
          onClose={() => setEditorOpen(false)}
          onSaved={(newId) => {
            // After create, jump straight to preview so admin can add items.
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
    </div>
  )
}

// ─── Small presentational atoms ──────────────────────────────────────

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
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-light">
        {label}
      </p>
      <p
        className={`text-[22px] font-bold tracking-tight leading-none ${
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
      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
        active
          ? 'bg-gold/20 text-gold ring-1 ring-gold/40'
          : 'bg-surface-alt text-text-muted ring-1 ring-border hover:text-text hover:bg-surface-hover'
      }`}
    >
      {label}
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
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
        active
          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40'
          : 'bg-surface-alt text-text-muted ring-1 ring-border hover:text-text hover:bg-surface-hover'
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
