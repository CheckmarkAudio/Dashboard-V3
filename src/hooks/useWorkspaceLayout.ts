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

  // PR #32 — backfill (col, row) for widgets that pre-date v15 manual
  // placement. If a saved widget is missing coords, fall back to the
  // default coords for its id, so sanitize is idempotent on the new
  // shape even if version gating ever misses a migration.
  const existing = sortWidgets(layout.widgets)
    .filter((widget) => allowedIds.has(widget.id))
    .map((widget) => {
      const needsCoords =
        typeof widget.col !== 'number' || typeof widget.row !== 'number'
      if (!needsCoords) return widget
      const fallback = defaultById.get(widget.id)
      return {
        ...widget,
        col: fallback?.col ?? 1,
        row: fallback?.row ?? 1,
      }
    })
  const existingIds = new Set(existing.map((widget) => widget.id))
  const missing = defaults.widgets.filter((widget) => !existingIds.has(widget.id))

  const nextWidgets = [...existing, ...missing].map((widget, index) => ({
    ...widget,
    order: index,
  }))

  return {
    ...defaults,
    widgets: nextWidgets,
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

  const moveWidget = (id: WorkspaceWidgetState['id'], direction: 'up' | 'down') => {
    setLayout((current) => {
      const widgets = sortWidgets(current.widgets)
      const index = widgets.findIndex((widget) => widget.id === id)
      if (index === -1) return current
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= widgets.length) return current
      const next = [...widgets]
      const [item] = next.splice(index, 1)
      if (!item) return current
      next.splice(target, 0, item)
      return {
        ...current,
        widgets: next.map((widget, order) => ({ ...widget, order })),
      }
    })
  }

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

  // Replace the full widget order with a new id sequence (drag-and-drop
  // callers hand us the complete, already-reordered list). Ids that
  // aren't in `orderedIds` get appended so nothing disappears if the
  // caller passed a stale list.
  const reorderWidgets = (orderedIds: WorkspaceWidgetState['id'][]) => {
    setLayout((current) => {
      const byId = new Map(current.widgets.map((w) => [w.id, w]))
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((w): w is WorkspaceWidgetState => !!w)
      const leftovers = current.widgets.filter((w) => !orderedIds.includes(w.id))
      const combined = [...reordered, ...leftovers]
      return {
        ...current,
        widgets: combined.map((w, i) => ({ ...w, order: i })),
      }
    })
  }

  // PR #32 — move a single widget to an explicit (col, row) cell. Used
  // by the manual-placement drag handler. Pure coord update — does not
  // touch order, span, or rowSpan. No auto-pack / compaction happens;
  // if this leaves other cells empty, they stay empty.
  const moveWidgetToCell = (
    id: WorkspaceWidgetState['id'],
    col: number,
    row: number,
  ) => {
    setLayout((current) => ({
      ...current,
      widgets: current.widgets.map((widget) =>
        widget.id === id ? { ...widget, col, row } : widget,
      ),
    }))
  }

  return {
    layout,
    visibleWidgets,
    moveWidget,
    moveWidgetToCell,
    reorderWidgets,
    toggleWidgetVisibility,
    resetLayout,
  }
}
