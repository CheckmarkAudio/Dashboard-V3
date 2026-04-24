import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Loader2, Plus, Search } from 'lucide-react'
import {
  fetchTaskTemplateLibrary,
  taskTemplateKeys,
} from '../../../lib/queries/taskTemplates'
import TemplateCard from './TemplateCard'
import TemplatePreviewModal from './TemplatePreviewModal'
import TemplateEditorModal from './TemplateEditorModal'

/**
 * AdminTemplatesWidget — the Templates library surfaced as a
 * WorkspacePanel widget (PR #29). Previously rendered as page-level
 * content on `/admin/templates`; lifting it into a widget lets the
 * Assign page run on WorkspacePanel like Hub + Overview + Tasks.
 *
 * Owns its own state (search, role filter pills, archived toggle,
 * editor/preview modal open state). The 'admin_templates' widget id
 * resolves to this component via widgetRegistry.
 *
 * Kept compact: single-column card grid inside the widget since the
 * widget itself occupies one of three columns. Search + pill filters
 * sit at top; grid scrolls inside the widget body (the outer widget
 * frame already handles overflow).
 */

// Canonical business-section pills — same list as the old page-level
// Templates column (PR #21). Edit here to rename / reorder.
const CANONICAL_ROLE_TAGS = [
  { value: 'engineer',  label: 'Engineer'  },
  { value: 'marketing', label: 'Marketing' },
  { value: 'intern',    label: 'Intern'    },
  { value: 'dev',       label: 'Dev'       },
  { value: 'admin',     label: 'Admin'     },
  { value: 'ops',       label: 'Ops'       },
] as const

export default function AdminTemplatesWidget() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [onboardingOnly, setOnboardingOnly] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const libraryQuery = useQuery({
    queryKey: taskTemplateKeys.library(roleFilter, includeInactive),
    queryFn: () =>
      fetchTaskTemplateLibrary({ roleTag: roleFilter, includeInactive }),
  })

  // Unfiltered pool so counts on pills stay stable regardless of
  // the current role selection.
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
    return all.filter((t) => {
      if (onboardingOnly && !t.is_onboarding) return false
      if (!needle) return true
      return (
        t.name.toLowerCase().includes(needle) ||
        (t.description ?? '').toLowerCase().includes(needle) ||
        (t.role_tag ?? '').toLowerCase().includes(needle)
      )
    })
  }, [libraryQuery.data, search, onboardingOnly])

  const total = poolQuery.data?.length ?? 0

  return (
    <div className="flex flex-col h-full min-h-0 gap-2.5">
      {/* ─── Top-bar: search + "New" ─────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-light pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-border text-[13px] focus-ring placeholder:text-text-light/70"
          />
        </div>
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold text-black text-[12px] font-bold hover:bg-gold-muted focus-ring shrink-0"
        >
          <Plus size={12} aria-hidden="true" />
          New
        </button>
      </div>

      {/* ─── Pills: All + canonical + overflow + toggles ─────── */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <Toggle label="Onboarding" active={onboardingOnly} onClick={() => setOnboardingOnly((v) => !v)} />
        <Toggle label="Include archived" active={includeInactive} onClick={() => setIncludeInactive((v) => !v)} />
      </div>

      {/* ─── Grid (single-column inside a widget-width card) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        {libraryQuery.isLoading ? (
          <div className="py-8 flex items-center justify-center text-text-light">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : libraryQuery.error ? (
          <p className="py-4 text-center text-[12px] text-rose-300">
            Could not load templates.
          </p>
        ) : templates.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
              <FolderKanban size={16} className="text-gold" aria-hidden="true" />
            </div>
            <p className="text-[13px] font-bold text-text">
              {total === 0 ? 'No templates yet' : 'No matches'}
            </p>
            <p className="text-[11px] text-text-light mt-0.5 max-w-[24ch]">
              {total === 0 ? 'Your first reusable blueprint.' : 'Try clearing filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onClick={() => setPreviewId(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Modals ─────────────────────────────────────────── */}
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

// ─── Small presentational atoms ─────────────────────────────────

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
