import { useEffect, useMemo, useState } from 'react'
import type { AppRole } from '../domain/permissions'
import { getDefaultWorkspaceLayout } from '../domain/workspaces/registry'
import { loadWorkspaceLayout, saveWorkspaceLayout } from '../domain/workspaces/storage'
import type {
  WorkspaceLayout,
  WorkspaceScope,
  WorkspaceWidgetDefinition,
  WorkspaceWidgetState,
} from '../domain/workspaces/types'

interface UseWorkspaceLayoutOptions {
  scope: WorkspaceScope
  role: AppRole
  userId: string
  // Pre-scoped — the caller imports MEMBER_WIDGET_DEFINITIONS or
  // ADMIN_WIDGET_DEFINITIONS directly; this hook never filters by
  // role/scope again. See domain/workspaces/types.ts for the split
  // rationale (architectural lockdown).
  definitions: WorkspaceWidgetDefinition[]
}

function sortWidgets(widgets: WorkspaceWidgetState[]): WorkspaceWidgetState[] {
  return [...widgets].sort((a, b) => a.order - b.order)
}

// Lean 3 — collapse the prior (col, order) tuple to a single flat
// `order` sequence. `col` is preserved on each state row as a sort
// hint when migrating from a multi-column layout, but the renderer
// uses only `order`. Sanitization re-indexes `order` so values are
// always 0..N-1 across the full visible set.
function sanitizeLayout(
  layout: WorkspaceLayout,
  scope: WorkspaceScope,
  role: AppRole,
  definitions: WorkspaceWidgetDefinition[],
): WorkspaceLayout {
  const allowedIds = new Set(
    definitions
      .filter((widget) => widget.allowedRoles.includes(role))
      .map((widget) => widget.id),
  )

  const defaults = getDefaultWorkspaceLayout(scope)
  const defaultById = new Map(defaults.widgets.map((w) => [w.id, w]))

  // Backfill `col` on any pre-Lean-3 state rows missing it. Used only
  // as a stable sort key when re-flattening.
  const existing = sortWidgets(layout.widgets)
    .filter((widget) => allowedIds.has(widget.id))
    .map((widget) => {
      if (typeof widget.col === 'number') return widget
      const fallback = defaultById.get(widget.id)
      return { ...widget, col: fallback?.col ?? 1 }
    })
  const existingIds = new Set(existing.map((widget) => widget.id))
  const missing = defaults.widgets.filter((widget) => !existingIds.has(widget.id))

  // Flatten into one sequence sorted by (col asc, order asc) — this
  // mirrors how the prior 3-column grid read row-by-row when scanned
  // top-to-bottom, left-to-right. Re-index `order` to 0..N-1.
  const combined = [...existing, ...missing]
    .slice()
    .sort((a, b) => (a.col - b.col) || (a.order - b.order))
    .map((widget, index) => ({ ...widget, order: index }))

  return {
    ...defaults,
    widgets: combined,
  }
}

export function useWorkspaceLayout({
  scope,
  role,
  userId,
  definitions,
}: UseWorkspaceLayoutOptions) {
  const [layout, setLayout] = useState<WorkspaceLayout>(() => {
    const saved = loadWorkspaceLayout(scope, userId)
    return sanitizeLayout(saved ?? getDefaultWorkspaceLayout(scope), scope, role, definitions)
  })

  useEffect(() => {
    setLayout((current) => sanitizeLayout(current, scope, role, definitions))
  }, [scope, role, definitions])

  useEffect(() => {
    saveWorkspaceLayout(layout, userId)
  }, [layout, userId])

  const visibleWidgets = useMemo(
    () => sortWidgets(layout.widgets).filter((widget) => widget.visible),
    [layout.widgets],
  )

  const toggleWidgetVisibility = (id: WorkspaceWidgetState['id']) => {
    setLayout((current) => ({
      ...current,
      widgets: current.widgets.map((widget) =>
        widget.id === id ? { ...widget, visible: !widget.visible } : widget,
      ),
    }))
  }

  const resetLayout = () => {
    setLayout(getDefaultWorkspaceLayout(scope))
  }

  // Lean 3 — direct 1-for-1 swap by `order`. Used by the carousel
  // drag-end handler. `col` rides along (for backwards-compat sort
  // hints) but is no longer load-bearing.
  const swapWidgets = (
    aId: WorkspaceWidgetState['id'],
    bId: WorkspaceWidgetState['id'],
  ) => {
    setLayout((current) => {
      const a = current.widgets.find((w) => w.id === aId)
      const b = current.widgets.find((w) => w.id === bId)
      if (!a || !b) return current
      if (a.order === b.order) return current
      return {
        ...current,
        widgets: current.widgets.map((w) => {
          if (w.id === aId) return { ...w, order: b.order, col: b.col }
          if (w.id === bId) return { ...w, order: a.order, col: a.col }
          return w
        }),
      }
    })
  }

  return {
    layout,
    visibleWidgets,
    swapWidgets,
    toggleWidgetVisibility,
    resetLayout,
  }
}
