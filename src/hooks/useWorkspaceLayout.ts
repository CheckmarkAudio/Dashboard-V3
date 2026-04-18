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
  const existing = sortWidgets(layout.widgets).filter((widget) => allowedIds.has(widget.id))
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

  return {
    layout,
    visibleWidgets,
    moveWidget,
    toggleWidgetVisibility,
    resetLayout,
  }
}
