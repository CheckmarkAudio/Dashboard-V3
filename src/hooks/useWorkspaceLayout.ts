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

  // PR #32 — move a widget based on a dnd-kit drop target. `overId`
  // can be either a column droppable id (`col-N`) or another widget's
  // id. The move is computed from the FRESHEST state inside setLayout's
  // functional update, so rapid-fire calls from onDragOver don't race.
  //
  // Same (col, index) as source → no-op so calling this on every drag
  // tick is safe.
  const moveWidgetByDropTarget = (
    activeId: WorkspaceWidgetState['id'],
    overId: string | number,
  ) => {
    setLayout((current) => {
      const active = current.widgets.find((w) => w.id === activeId)
      if (!active) return current

      // Group VISIBLE widgets by column. Hidden widgets are preserved
      // untouched — we only reorder what's actually on screen.
      const hiddenWidgets = current.widgets.filter((w) => !w.visible)
      const byCol = new Map<number, WorkspaceWidgetState[]>()
      for (const w of current.widgets) {
        if (!w.visible) continue
        const list = byCol.get(w.col) ?? []
        list.push(w)
        byCol.set(w.col, list)
      }
      for (const list of byCol.values()) list.sort((a, b) => a.order - b.order)

      // Locate active within its current column.
      const sourceCol = active.col
      const sourceList = byCol.get(sourceCol) ?? []
      const sourceIdx = sourceList.findIndex((w) => w.id === activeId)
      if (sourceIdx < 0) return current

      // Resolve destination from overId.
      let destCol: number
      let destIdx: number
      const overIdStr = typeof overId === 'string' ? overId : String(overId)
      const colMatch = /^col-(\d+)$/.exec(overIdStr)
      if (colMatch) {
        destCol = Number(colMatch[1])
        destIdx = (byCol.get(destCol) ?? []).length
      } else {
        let found: { col: number; idx: number } | null = null
        for (const [col, list] of byCol.entries()) {
          const idx = list.findIndex((w) => w.id === overIdStr)
          if (idx !== -1) {
            found = { col, idx }
            break
          }
        }
        if (!found) return current
        destCol = found.col
        destIdx = found.idx
      }

      // No-op if identical to current position.
      if (destCol === sourceCol && destIdx === sourceIdx) return current

      // Remove from source.
      sourceList.splice(sourceIdx, 1)
      byCol.set(sourceCol, sourceList)

      // Adjust destIdx when same-column-and-moving-forward (removing
      // source shifts later indices down by 1).
      const insertIdx =
        destCol === sourceCol && destIdx > sourceIdx ? destIdx - 1 : destIdx

      const destList = byCol.get(destCol) ?? []
      const clampedIdx = Math.max(0, Math.min(insertIdx, destList.length))
      destList.splice(clampedIdx, 0, { ...active, col: destCol })
      byCol.set(destCol, destList)

      // Flatten + re-assign contiguous orders per column. Hidden
      // widgets kept as-is at the end of the array (the render layer
      // doesn't depend on overall array order — it groups by col +
      // order at render time).
      const nextVisible: WorkspaceWidgetState[] = []
      for (const [col, list] of byCol.entries()) {
        list.forEach((w, idx) => nextVisible.push({ ...w, col, order: idx }))
      }
      return { ...current, widgets: [...nextVisible, ...hiddenWidgets] }
    })
  }

  return {
    layout,
    visibleWidgets,
    moveWidget,
    moveWidgetByDropTarget,
    reorderWidgets,
    toggleWidgetVisibility,
    resetLayout,
  }
}
