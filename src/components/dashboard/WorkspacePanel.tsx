import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { RotateCcw, GripVertical } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useWorkspaceLayout } from '../../hooks/useWorkspaceLayout'
import type { AppRole } from '../../domain/permissions'
import type {
  WorkspaceScope,
  WorkspaceWidgetDefinition,
  WorkspaceWidgetId,
  WorkspaceWidgetState,
  WidgetRowSpan,
} from '../../domain/workspaces/types'
import DashboardWidgetFrame, { type DragHandleProps } from './DashboardWidgetFrame'
import FloatingDetailModal from '../FloatingDetailModal'
import { Button, Card } from '../ui'

/**
 * Column-snap widget grid with live sibling animation (PR #32).
 *
 * Three independent column stacks. Key dnd-kit wiring:
 *
 *   - Each column is its own `SortableContext` with
 *     `verticalListSortingStrategy` — within-column shifts animate
 *     via built-in transforms (neighbors glide out of the way).
 *   - `onDragOver` moves widgets to new columns LIVE during drag so
 *     target-column siblings shift to make space as the cursor
 *     approaches. This is what made the prior iteration feel janky
 *     (state only updated on drop).
 *   - `onDragEnd` finalizes intra-column reorder (same-column final
 *     position).
 *   - `DragOverlay` renders a floating ghost that tracks the cursor
 *     smoothly above the grid while the original slot dims to a
 *     placeholder — standard dnd-kit "card-being-carried" UX.
 *
 * `rowSpan` controls widget height inside its column (rs=1 → 340px).
 */
const ROW_HEIGHT_PX = 340
const ROW_GAP_PX = 16
const COLUMN_IDS = [1, 2, 3] as const

function widgetHeight(rowSpan: WidgetRowSpan = 1): number {
  // For >= 1-row widgets, add gap rows that get absorbed into the span.
  // For sub-1 rowSpans (compact button widgets at 0.5) just scale
  // ROW_HEIGHT_PX directly — no inter-row gap to absorb.
  const base = rowSpan * ROW_HEIGHT_PX
  return rowSpan >= 1 ? base + (rowSpan - 1) * ROW_GAP_PX : base
}

// Sortable widget inside a column. While being dragged, the original
// slot dims to 0.35 opacity so the user sees "this is where the card
// came from" — a DragOverlay copy (rendered above the grid) is what
// tracks the cursor.
function SortableWidget({
  id,
  rowSpan,
  children,
}: {
  id: WorkspaceWidgetId
  rowSpan: WidgetRowSpan
  children: (dragHandleProps: DragHandleProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: `${widgetHeight(rowSpan)}px`,
    flex: 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
    opacity: isDragging ? 0.35 : 1,
    // Hide the chrome of the placeholder a bit more while the ghost
    // floats above — a subtle dashed outline hints "card goes here."
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'rounded-2xl ring-2 ring-dashed ring-gold/40' : ''}
    >
      {children({
        attributes: attributes as DragHandleProps['attributes'],
        listeners: listeners as DragHandleProps['listeners'],
        isDragging,
      })}
    </div>
  )
}

// A droppable column. Always registered (even when empty) so
// cross-column drops land. No outline when idle — the sibling-shift
// animation is affordance enough.
function Column({
  col,
  itemIds,
  children,
}: {
  col: number
  itemIds: WorkspaceWidgetId[]
  children: ReactNode
}) {
  const { setNodeRef } = useDroppable({ id: `col-${col}` })
  return (
    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className="flex flex-col gap-4"
        style={{ minHeight: `${ROW_HEIGHT_PX}px` }}
      >
        {children}
      </div>
    </SortableContext>
  )
}

// DragOverlay ghost — a simplified widget-card shape with the title
// and description. Rendering the full widget component here would
// trigger fresh data fetches / re-mounts, so we use chrome-only.
function DragGhost({
  definition,
  rowSpan,
}: {
  definition: WorkspaceWidgetDefinition
  rowSpan: WidgetRowSpan
}) {
  return (
    <div
      style={{ height: `${widgetHeight(rowSpan)}px` }}
      className="widget-card bg-surface shadow-2xl ring-2 ring-gold/60 rounded-2xl overflow-hidden cursor-grabbing"
    >
      <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
        <GripVertical size={16} className="text-text-muted mt-1 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="text-section text-text truncate">{definition.title}</h3>
          <p className="mt-1 text-caption line-clamp-2">{definition.description}</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center text-caption text-text-muted/70">
        Drop to place
      </div>
    </div>
  )
}

interface WorkspacePanelProps {
  role: AppRole
  userId: string
  scope: WorkspaceScope
  definitions: WorkspaceWidgetDefinition[]
  controlsTitle?: string
  controlsDescription: string
  showControls?: boolean
}

export default function WorkspacePanel({
  role,
  userId,
  scope,
  definitions,
  controlsTitle = 'Workspace Controls',
  controlsDescription,
  showControls = true,
}: WorkspacePanelProps) {
  const definitionsById = useMemo(
    () => new Map(definitions.map((widget) => [widget.id, widget])),
    [definitions],
  )

  const {
    layout,
    visibleWidgets,
    toggleWidgetVisibility,
    moveWidgetByDropTarget,
    swapWidgets,
    resetLayout,
  } = useWorkspaceLayout({
    scope,
    role,
    userId,
    definitions,
  })

  // Floating detail modal (click widget title to expand).
  const [expandedId, setExpandedId] = useState<WorkspaceWidgetId | null>(null)
  const expandedDefinition = expandedId ? definitionsById.get(expandedId) : null
  const ExpandedComponent = expandedDefinition?.component

  // Active drag — drives the DragOverlay.
  const [activeId, setActiveId] = useState<WorkspaceWidgetId | null>(null)
  const activeWidget = activeId
    ? visibleWidgets.find((w) => w.id === activeId)
    : null
  const activeDefinition = activeId ? definitionsById.get(activeId) : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Group visible widgets by column for render.
  const widgetsByColumn = useMemo(() => {
    const map = new Map<number, WorkspaceWidgetState[]>()
    for (const col of COLUMN_IDS) map.set(col, [])
    for (const widget of visibleWidgets) {
      const list = map.get(widget.col) ?? []
      list.push(widget)
      map.set(widget.col, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order)
    return map
  }, [visibleWidgets])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as WorkspaceWidgetId)
  }

  // onDragEnd is the SINGLE commit point for cross-column moves. We
  // deliberately do NOT update state in onDragOver — updating live as
  // the cursor passes over multiple widgets caused cascading swaps
  // (every widget the cursor brushed got swapped with the active one,
  // piling up in whichever column the cursor ended in). By committing
  // only on drop, exactly one swap/move happens per drag.
  //
  // Three drop targets:
  //   - Column droppable (`col-N`) → move active into that column.
  //   - Widget in SAME column → insert + shift (list-reorder feel,
  //     handled by useSortable's live transforms during drag).
  //   - Widget in DIFFERENT column → DIRECT SWAP: active takes over's
  //     slot, over takes active's old slot. One atomic exchange.
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = active.id as WorkspaceWidgetId
    const overIdStr = typeof over.id === 'string' ? over.id : String(over.id)

    // Column droppable → move to that column's end.
    if (/^col-\d+$/.test(overIdStr)) {
      moveWidgetByDropTarget(activeId, overIdStr)
      return
    }

    // Over another widget.
    const activeWidget = visibleWidgets.find((w) => w.id === activeId)
    const overWidget = visibleWidgets.find((w) => w.id === over.id)
    if (!activeWidget || !overWidget) return

    if (activeWidget.col === overWidget.col) {
      // Same column → sortable insert + shift.
      moveWidgetByDropTarget(activeId, overIdStr)
    } else {
      // Different column → direct 1-for-1 swap.
      swapWidgets(activeId, over.id as WorkspaceWidgetId)
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  return (
    <div className="space-y-4">
      {showControls && (
        <Card flush flat>
          <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
            <div>
              <h2 className="text-section text-text">{controlsTitle}</h2>
              <p className="mt-1 text-caption">{controlsDescription}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<RotateCcw size={14} />}
              onClick={resetLayout}
            >
              Reset layout
            </Button>
          </div>
          <div className="p-5 flex flex-wrap gap-2">
            {layout.widgets
              .slice()
              .sort((a, b) => (a.col - b.col) || (a.order - b.order))
              .map((widget) => {
                const definition = definitionsById.get(widget.id)
                if (!definition) return null
                return (
                  <button
                    key={widget.id}
                    type="button"
                    onClick={() => toggleWidgetVisibility(widget.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      widget.visible
                        ? 'bg-gold/10 text-gold border-gold/30'
                        : 'bg-surface-alt text-text-muted border-border hover:text-text'
                    }`}
                  >
                    {widget.visible ? 'Hide' : 'Show'} {definition.title}
                  </button>
                )
              })}
          </div>
        </Card>
      )}

      {/* Tiny reset chip when the full controls bar is hidden, so
          users can always recover from a botched layout. */}
      {!showControls && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={resetLayout}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-text-muted hover:text-text hover:bg-surface-alt/60 transition-colors"
            title="Reset widgets to default layout"
          >
            <RotateCcw size={11} />
            Reset layout
          </button>
        </div>
      )}

      {/* 3 independent column stacks with live cross-column dragging. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {COLUMN_IDS.map((col) => {
            const list = widgetsByColumn.get(col) ?? []
            const ids = list.map((w) => w.id as WorkspaceWidgetId)
            return (
              <Column key={col} col={col} itemIds={ids}>
                {list.map((widget) => {
                  const definition = definitionsById.get(widget.id)
                  if (!definition) return null
                  const WidgetComponent = definition.component
                  return (
                    <SortableWidget
                      key={widget.id}
                      id={widget.id as WorkspaceWidgetId}
                      rowSpan={widget.rowSpan ?? 1}
                    >
                      {(dragHandleProps) => (
                        <DashboardWidgetFrame
                          title={definition.title}
                          description={definition.description}
                          visible={widget.visible}
                          dragHandleProps={dragHandleProps}
                          onExpand={() =>
                            setExpandedId(widget.id as WorkspaceWidgetId)
                          }
                        >
                          <WidgetComponent />
                        </DashboardWidgetFrame>
                      )}
                    </SortableWidget>
                  )
                })}
              </Column>
            )
          })}
        </div>

        {/* Floating ghost that tracks the cursor while dragging. */}
        <DragOverlay
          dropAnimation={{
            duration: 220,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {activeWidget && activeDefinition ? (
            <DragGhost
              definition={activeDefinition}
              rowSpan={activeWidget.rowSpan ?? 1}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Floating detail modal — renders a second instance of the
          selected widget's component, unconstrained by the grid cell
          height. Dismiss with Esc, backdrop click, or X. */}
      {expandedDefinition && ExpandedComponent && (
        <FloatingDetailModal
          title={expandedDefinition.title}
          eyebrow={expandedDefinition.description}
          onClose={() => setExpandedId(null)}
          maxWidth={720}
        >
          <ExpandedComponent />
        </FloatingDetailModal>
      )}
    </div>
  )
}
