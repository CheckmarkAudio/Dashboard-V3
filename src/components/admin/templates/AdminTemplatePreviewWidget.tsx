import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, FolderKanban, Loader2 } from 'lucide-react'
import {
  fetchTaskTemplateLibrary,
  taskTemplateKeys,
} from '../../../lib/queries/taskTemplates'
import type { TaskTemplateLibraryEntry } from '../../../types/assignments'
import TemplatePreviewModal from './TemplatePreviewModal'

/**
 * AdminTemplatePreviewWidget — PR #46.
 *
 * Lives in col 3 of the Assign page directly below `admin_templates`.
 * Renders every active template as a small file-system-style thumbnail
 * grouped under role-tag dividers (Engineer / Marketing / Intern / …),
 * with an "No role" group at the bottom. Clicking a thumbnail opens
 * the same `TemplatePreviewModal` the Templates list uses.
 *
 * Reads from the same `get_task_template_library` RPC the Templates
 * widget uses, so the two stay in sync without an extra fetch round-
 * trip — react-query will reuse the cached payload (same key).
 *
 * Archived templates are hidden by default — Templates widget owns the
 * "Show archived" toggle for the page; Preview just renders what's
 * active so the section reads like a clean menu.
 */

const CANONICAL_ROLE_ORDER = [
  'engineer',
  'marketing',
  'intern',
  'dev',
  'admin',
  'ops',
] as const

const ROLE_LABELS: Record<string, string> = {
  engineer:  'Engineer',
  marketing: 'Marketing',
  intern:    'Intern',
  dev:       'Dev',
  admin:     'Admin',
  ops:       'Ops',
}

export default function AdminTemplatePreviewWidget() {
  const [previewId, setPreviewId] = useState<string | null>(null)

  const libraryQuery = useQuery({
    queryKey: taskTemplateKeys.library(null, false),
    queryFn: () => fetchTaskTemplateLibrary({ roleTag: null, includeInactive: false }),
  })

  const groups = useMemo(() => {
    const all = libraryQuery.data ?? []
    const byRole = new Map<string, TaskTemplateLibraryEntry[]>()
    for (const t of all) {
      const key = t.role_tag ?? '__none__'
      if (!byRole.has(key)) byRole.set(key, [])
      byRole.get(key)!.push(t)
    }
    // Stable canonical order; unknown roles sort alphabetically after
    // the canonical block; "No role" lands at the very bottom.
    const canonical = CANONICAL_ROLE_ORDER.filter((k) => byRole.has(k))
    const extras = Array.from(byRole.keys())
      .filter((k) => k !== '__none__' && !CANONICAL_ROLE_ORDER.includes(k as never))
      .sort()
    const ordered: { key: string; label: string; items: TaskTemplateLibraryEntry[] }[] = []
    for (const k of [...canonical, ...extras]) {
      const items = byRole.get(k) ?? []
      items.sort((a, b) => a.name.localeCompare(b.name))
      ordered.push({
        key: k,
        label: ROLE_LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1),
        items,
      })
    }
    if (byRole.has('__none__')) {
      const items = byRole.get('__none__')!.slice().sort((a, b) => a.name.localeCompare(b.name))
      ordered.push({ key: '__none__', label: 'No role', items })
    }
    return ordered
  }, [libraryQuery.data])

  const total = libraryQuery.data?.length ?? 0

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      {/* ─── Body ─────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        {libraryQuery.isLoading ? (
          <div className="py-8 flex items-center justify-center text-text-light">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : libraryQuery.error ? (
          <p className="py-4 text-center text-[12px] text-rose-300">
            Could not load templates.
          </p>
        ) : total === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
              <FolderKanban size={16} className="text-gold" aria-hidden="true" />
            </div>
            <p className="text-[13px] font-bold text-text">No templates yet</p>
            <p className="text-[11px] text-text-light mt-0.5 max-w-[24ch]">
              Build your first template above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-gold/80">
                    {g.label}
                  </span>
                  <span className="tabular-nums text-[10px] font-bold text-text-light/70">
                    {g.items.length}
                  </span>
                  <div className="flex-1 h-px bg-border/60" aria-hidden="true" />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {g.items.map((t) => (
                    <Thumbnail
                      key={t.id}
                      template={t}
                      onClick={() => setPreviewId(t.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Modal — same one Templates widget uses ──────────── */}
      {previewId && (
        <TemplatePreviewModal
          templateId={previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  )
}

// ─── Thumbnail atom ──────────────────────────────────────────────
//
// File-system aesthetic: small uniform tile with an icon + name +
// item count. 3 per row inside the widget so a row of templates
// reads like a Finder column. Whole tile is the click target.

function Thumbnail({
  template,
  onClick,
}: {
  template: TaskTemplateLibraryEntry
  onClick: () => void
}) {
  const { name, item_count } = template
  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      className="group flex flex-col items-center gap-1 p-1.5 rounded-lg bg-surface/60 ring-1 ring-border/60 hover:bg-surface-hover hover:ring-gold/40 transition-colors focus-ring"
    >
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-gold/10 ring-1 ring-gold/20 group-hover:bg-gold/15">
        <FileText size={14} className="text-gold" aria-hidden="true" />
      </div>
      <span className="text-[10px] font-semibold text-text leading-tight text-center line-clamp-2 w-full">
        {name}
      </span>
      <span className="tabular-nums text-[9px] text-text-light/80">
        {item_count}
      </span>
    </button>
  )
}
