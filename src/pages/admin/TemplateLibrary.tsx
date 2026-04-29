import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownAZ,
  ArrowUpDown,
  Calendar,
  FileText,
  FolderKanban,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  Search,
  Tag,
} from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { Button, PageHeader } from '../../components/ui'
import {
  fetchTaskTemplateLibrary,
  taskTemplateKeys,
} from '../../lib/queries/taskTemplates'
import {
  CANONICAL_ROLE_TAGS,
  iconForRole,
} from '../../components/admin/templates/roleTags'
import TemplatePreviewModal from '../../components/admin/templates/TemplatePreviewModal'
import TemplateEditorModal from '../../components/admin/templates/TemplateEditorModal'
import type { TaskTemplateLibraryEntry } from '../../types/assignments'

/**
 * TemplateLibrary — full-page Templates manager (PR #56).
 *
 * Reachable from the new Assign page's sidebar "Templates" link
 * (`/admin/template-library`). Same functionality as the
 * `AdminTemplatesWidget` (search · canonical role pills · Onboarding
 * toggle · Show-archived toggle · Arrange-by sort · friendly per-role
 * thumbnails · click-to-preview · click-to-edit · "+ New Template")
 * but laid out for a full page: bigger title, bigger search, multi-
 * column thumbnail grid that scales with viewport (3 cols at md,
 * 4 cols at lg+).
 *
 * The widget version stays in place so the legacy widget-grid Assign
 * page still has it. Both call the same `get_task_template_library`
 * RPC and share the react-query cache key, so loading one warms the
 * other.
 */

type ArrangeBy = 'alpha' | 'date' | 'role'

const ARRANGE_OPTIONS: { value: ArrangeBy; label: string; icon: typeof ArrowDownAZ }[] = [
  { value: 'alpha', label: 'A–Z',    icon: ArrowDownAZ },
  { value: 'date',  label: 'Newest', icon: Calendar    },
  { value: 'role',  label: 'Role',   icon: Tag         },
]

export default function TemplateLibrary() {
  useDocumentTitle('Templates - Checkmark Workspace')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [onboardingOnly, setOnboardingOnly] = useState(false)
  const [arrangeBy, setArrangeBy] = useState<ArrangeBy>('alpha')
  const [editorOpen, setEditorOpen] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const libraryQuery = useQuery({
    queryKey: taskTemplateKeys.library(roleFilter, includeInactive),
    queryFn: () =>
      fetchTaskTemplateLibrary({ roleTag: roleFilter, includeInactive }),
  })

  // Unfiltered pool so counts on pills stay stable regardless of
  // which role pill is currently active.
  const poolQuery = useQuery({
    queryKey: taskTemplateKeys.library(null, includeInactive),
    queryFn: () => fetchTaskTemplateLibrary({ roleTag: null, includeInactive }),
  })

  const countsByTag = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of poolQuery.data ?? []) {
      if (t.role_tag) map[t.role_tag] = (map[t.role_tag] ?? 0) + 1
    }
    return map
  }, [poolQuery.data])

  const extraRoleTags = useMemo(() => {
    const canonicalSet = new Set<string>(CANONICAL_ROLE_TAGS.map((t) => t.value))
    return Object.keys(countsByTag)
      .filter((t) => !canonicalSet.has(t))
      .sort()
  }, [countsByTag])

  const templates = useMemo(() => {
    const all = libraryQuery.data ?? []
    const needle = search.trim().toLowerCase()
    const filtered = all.filter((t) => {
      if (onboardingOnly && !t.is_onboarding) return false
      if (!needle) return true
      return (
        t.name.toLowerCase().includes(needle) ||
        (t.description ?? '').toLowerCase().includes(needle) ||
        (t.role_tag ?? '').toLowerCase().includes(needle)
      )
    })
    const sorted = filtered.slice()
    if (arrangeBy === 'alpha') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else if (arrangeBy === 'date') {
      sorted.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    } else if (arrangeBy === 'role') {
      sorted.sort((a, b) => {
        const ar = a.role_tag ?? ''
        const br = b.role_tag ?? ''
        if (ar === br) return a.name.localeCompare(b.name)
        if (!ar) return 1
        if (!br) return -1
        return ar.localeCompare(br)
      })
    }
    return sorted
  }, [libraryQuery.data, search, onboardingOnly, arrangeBy])

  const grouped = useMemo(() => {
    if (arrangeBy !== 'role') return null
    const groups = new Map<string, typeof templates>()
    for (const t of templates) {
      const key = t.role_tag ?? '__none__'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label:
        key === '__none__'
          ? 'No role'
          : (CANONICAL_ROLE_TAGS.find((r) => r.value === key)?.label
            ?? key.charAt(0).toUpperCase() + key.slice(1)),
      items,
    }))
  }, [arrangeBy, templates])

  const total = poolQuery.data?.length ?? 0

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 animate-fade-in">
      <PageHeader
        icon={Layers}
        title={
          <span className="inline-flex items-center gap-2">
            Templates
            <span className="text-sm font-medium text-text-muted bg-surface-alt px-2.5 py-0.5 rounded-full">
              {total}
            </span>
          </span>
        }
        subtitle="Reusable blueprints for onboarding and repeat work — apply to any member from the Assign page."
        actions={
          <Button
            variant="primary"
            iconLeft={<Plus size={16} aria-hidden="true" />}
            onClick={() => setEditorOpen(true)}
          >
            New Template
          </Button>
        }
      />

      {/* ─── Toolbar ───────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        {/* Row 1 — search */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name, description, or role…"
            aria-label="Search templates"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface-alt border border-border text-sm focus-ring placeholder:text-text-light/70"
          />
        </div>

        {/* Row 2 — role pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill label="All" count={total} active={roleFilter === null} onClick={() => setRoleFilter(null)} />
          {CANONICAL_ROLE_TAGS.map((t) => (
            <Pill
              key={t.value}
              label={t.label}
              count={countsByTag[t.value] ?? 0}
              active={roleFilter === t.value}
              onClick={() => setRoleFilter(t.value)}
            />
          ))}
          {extraRoleTags.map((t) => (
            <Pill
              key={t}
              label={t.charAt(0).toUpperCase() + t.slice(1)}
              count={countsByTag[t] ?? 0}
              active={roleFilter === t}
              onClick={() => setRoleFilter(t)}
              subtle
            />
          ))}
        </div>

        {/* Row 3 — toggles + arrange-by */}
        <div className="flex flex-wrap items-center gap-2">
          <Toggle label="Onboarding" active={onboardingOnly} onClick={() => setOnboardingOnly((v) => !v)} />
          <Toggle label="Show archived" active={includeInactive} onClick={() => setIncludeInactive((v) => !v)} />
          <div className="ml-auto inline-flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-text-light">
              <ArrowUpDown size={10} aria-hidden="true" />
              Arrange
            </span>
            <div className="inline-flex rounded-full bg-surface-alt ring-1 ring-border overflow-hidden">
              {ARRANGE_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const active = arrangeBy === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setArrangeBy(opt.value)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      active
                        ? 'bg-gold/20 text-gold'
                        : 'text-text-muted hover:text-text hover:bg-surface-hover'
                    }`}
                  >
                    <Icon size={10} aria-hidden="true" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Grid ──────────────────────────────────────────────── */}
      {libraryQuery.isLoading ? (
        <div className="bg-surface rounded-2xl border border-border p-12 flex items-center justify-center text-text-light">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading templates…
        </div>
      ) : libraryQuery.error ? (
        <p className="bg-surface rounded-2xl border border-rose-500/30 p-6 text-center text-[13px] text-rose-300">
          Could not load templates. {(libraryQuery.error as Error).message}
        </p>
      ) : templates.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gold/10 ring-1 ring-gold/20 mb-3">
            <FolderKanban size={20} className="text-gold" aria-hidden="true" />
          </div>
          <p className="text-[15px] font-bold text-text">
            {total === 0 ? 'No templates yet' : 'No matches'}
          </p>
          <p className="text-[12px] text-text-light mt-1 max-w-[36ch] mx-auto">
            {total === 0
              ? 'Build your first reusable blueprint — apply to any member with one click.'
              : 'Try clearing some filters to see more.'}
          </p>
          {total === 0 && (
            <div className="mt-4">
              <Button
                variant="primary"
                iconLeft={<Plus size={16} aria-hidden="true" />}
                onClick={() => setEditorOpen(true)}
              >
                Create your first template
              </Button>
            </div>
          )}
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.key}>
              <div className="flex items-center gap-3 mb-3 px-1">
                <span className="text-[11px] uppercase tracking-wider font-bold text-gold">
                  {g.label}
                </span>
                <span className="tabular-nums text-[11px] font-bold text-text-light/70 px-2 py-0.5 rounded-full bg-surface-alt ring-1 ring-border">
                  {g.items.length}
                </span>
                <div className="flex-1 h-px bg-border/60" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {g.items.map((t) => (
                  <BigThumbnail
                    key={t.id}
                    template={t}
                    onClick={() => setPreviewId(t.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {templates.map((t) => (
            <BigThumbnail
              key={t.id}
              template={t}
              onClick={() => setPreviewId(t.id)}
            />
          ))}
        </div>
      )}

      {/* ─── Modals ────────────────────────────────────────────── */}
      {editorOpen && (
        <TemplateEditorModal
          onClose={() => setEditorOpen(false)}
          onSaved={(newId) => {
            setEditorOpen(false)
            setPreviewId(newId)
          }}
        />
      )}
      {previewId && (
        <TemplatePreviewModal
          templateId={previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  )
}

// ─── Atoms ─────────────────────────────────────────────────────────

function Pill({
  label,
  count,
  active,
  onClick,
  subtle = false,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  subtle?: boolean
}) {
  const isEmpty = count === 0 && !active
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={isEmpty}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
        active
          ? 'bg-gold/20 text-gold ring-1 ring-gold/40'
          : isEmpty
            ? 'bg-surface/60 text-text-light/40 ring-1 ring-border/40 cursor-default'
            : subtle
              ? 'bg-surface-alt/60 text-text-muted ring-1 ring-border/60 hover:text-text hover:bg-surface-hover'
              : 'bg-surface-alt text-text-muted ring-1 ring-border hover:text-text hover:bg-surface-hover'
      }`}
    >
      {label}
      <span
        className={`tabular-nums text-[10px] font-bold ${
          active ? 'text-gold/80' : 'text-text-light/70'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function Toggle({
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
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

/**
 * BigThumbnail — page-scaled version of the widget's friendly tile.
 * Larger icon bubble (w-16 h-16), bigger title (14px), more padding,
 * description preview when available. Whole tile opens the preview
 * modal. Same role-icon mapping as the widget.
 */
function BigThumbnail({
  template,
  onClick,
}: {
  template: TaskTemplateLibraryEntry
  onClick: () => void
}) {
  const { name, description, item_count, is_active, is_onboarding, role_tag } = template
  const muted = !is_active
  const Icon = iconForRole(role_tag)
  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      className={`group relative flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-gradient-to-b from-surface to-surface/70 ring-1 ring-border/70 hover:ring-gold/50 hover:from-surface hover:to-surface/85 transition-all focus-ring shadow-[0_4px_20px_rgba(0,0,0,0.15)] ${
        muted ? 'opacity-60 hover:opacity-100' : ''
      }`}
    >
      <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/10 ring-1 ring-gold/25 group-hover:bg-gold/15 transition-colors">
        <Icon size={26} className="text-gold" aria-hidden="true" />
        {is_onboarding && (
          <span
            aria-hidden="true"
            title="Onboarding"
            className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-400 ring-2 ring-[rgb(19,22,28)]"
          >
            <GraduationCap size={9} className="text-emerald-950" aria-hidden="true" />
          </span>
        )}
      </div>
      <span className="text-[14px] font-bold text-text leading-tight text-center line-clamp-2 w-full">
        {name}
      </span>
      {description && (
        <span className="text-[11px] text-text-light leading-snug text-center line-clamp-2 w-full">
          {description}
        </span>
      )}
      <span className="inline-flex items-center gap-1 tabular-nums text-[11px] font-bold text-text-muted mt-auto pt-1">
        <FileText size={10} aria-hidden="true" />
        {item_count} {item_count === 1 ? 'task' : 'tasks'}
        {role_tag && (
          <>
            <span className="text-text-light/40 px-0.5">·</span>
            <span className="text-text-light/80">{role_tag}</span>
          </>
        )}
      </span>
      {!is_active && (
        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-white/[0.06] text-[9px] font-bold text-text-light uppercase tracking-wider">
          Archived
        </span>
      )}
    </button>
  )
}
