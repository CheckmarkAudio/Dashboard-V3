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

  // PR #32 — backfill `col` for widgets that pre-date v15 column-snap.
  const existing = sortWidgets(layout.widgets)
    .filter((widget) => allowedIds.has(widget.id))
    .map((widget) => {
      if (typeof widget.col === 'number') return widget
      const fallback = defaultById.get(widget.id)
      return { ...widget, col: fallback?.col ?? 1 }
    })
  const existingIds = new Set(existing.map((widget) => widget.id))
  const missing = defaults.widgets.filter((widget) => !existingIds.has(widget.id))

  // Re-index `order` per column so values are always contiguous 0..N-1
  // within each column regardless of user shuffles or appended missing
  // widgets.
  const combined = [...existing, ...missing]
  const perColumnSeq: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  const nextWidgets = combined
    .slice()
    .sort((a, b) => (a.col - b.col) || (a.order - b.order))
    .map((widget) => {
      const col = widget.col ?? 1
      const order = perColumnSeq[col] ?? 0
      perColumnSeq[col] = order + 1
      return { ...widget, col, order }
    })

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

  // PR #32 — move a widget to (destCol, destIndex) in that column's
  // stack. Handles both intra-column reorder (shift siblings) and
  // cross-column moves (remove from source, insert into dest). All
  // affected columns get re-indexed to contiguous 0..N-1 orders so
  // the state is always canonical.
  const moveWidgetToColumn = (
    id: WorkspaceWidgetState['id'],
    destCol: number,
    destIndex: number,
  ) => {
    setLayout((current) => {
      const moving = current.widgets.find((w) => w.id === id)
      if (!moving) return current

      // Group + sort by column.
      const byCol = new Map<number, WorkspaceWidgetState[]>()
      for (const w of current.widgets) {
        const list = byCol.get(w.col) ?? []
        list.push(w)
        byCol.set(w.col, list)
      }
      for (const list of byCol.values()) list.sort((a, b) => a.order - b.order)

      // Remove from source column.
      const sourceList = byCol.get(moving.col) ?? []
      const sourceIdx = sourceList.findIndex((w) => w.id === id)
      if (sourceIdx >= 0) sourceList.splice(sourceIdx, 1)
      byCol.set(moving.col, sourceList)

      // Insert into destination column at the clamped index.
      const destList = byCol.get(destCol) ?? []
      const clampedIndex = Math.max(0, Math.min(destIndex, destList.length))
      destList.splice(clampedIndex, 0, { ...moving, col: destCol })
      byCol.set(destCol, destList)

      // Flatten + re-assign contiguous orders per column.
      const nextWidgets: WorkspaceWidgetState[] = []
      for (const [col, list] of byCol.entries()) {
        list.forEach((w, idx) => nextWidgets.push({ ...w, col, order: idx }))
      }
      return { ...current, widgets: nextWidgets }
    })
  }

  return {
    layout,
    visibleWidgets,
    moveWidget,
    moveWidgetToColumn,
    reorderWidgets,
    toggleWidgetVisibility,
    resetLayout,
  }
}
