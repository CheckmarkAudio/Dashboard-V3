import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  DndContext,
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
 * Column-snap widget grid (PR #32).
 *
 * Three independent vertical stacks (cols 1, 2, 3). Within a column,
 * widgets auto-arrange top-to-bottom and dragging reorders them via
 * standard sortable shift semantics (drop A onto B → B shifts aside).
 * Dragging a widget into a different column assigns it to that column;
 * nothing ever slides across the whole page on its own.
 *
 * `rowSpan` still controls widget HEIGHT inside its column (rs=1 →
 * 340px, rs=2 → 696px).
 */
const ROW_HEIGHT_PX = 340
const ROW_GAP_PX = 16
const COLUMN_IDS = [1, 2, 3] as const

function widgetHeight(rowSpan: WidgetRowSpan = 1): number {
  return rowSpan * ROW_HEIGHT_PX + (rowSpan - 1) * ROW_GAP_PX
}

// Sortable widget inside a column. Uses dnd-kit's vertical sortable so
// drops shift siblings up/down inside the same column automatically.
// Cross-column drops are handled by the parent `DndContext` via
// `closestCorners`, which tracks the nearest item across all
// SortableContexts.
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
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.85 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'ring-2 ring-gold/60 rounded-2xl shadow-2xl' : ''}
    >
      {children({
        attributes: attributes as DragHandleProps['attributes'],
        listeners: listeners as DragHandleProps['listeners'],
        isDragging,
      })}
    </div>
  )
}

// A droppable column. Registers the column's id + its sortable items
// so cross-column drags land correctly. Empty columns still register
// so you can drop the first widget into an empty stack.
function Column({
  col,
  itemIds,
  isDragActive,
  children,
}: {
  col: number
  itemIds: WorkspaceWidgetId[]
  isDragActive: boolean
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${col}` })
  return (
    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={[
          'flex flex-col gap-4 rounded-2xl transition-colors',
          `min-h-[${ROW_HEIGHT_PX}px]`,
          isDragActive
            ? isOver
              ? 'bg-gold/5 outline outline-2 outline-dashed outline-gold/60'
              : 'outline outline-2 outline-dashed outline-border/60'
            : '',
        ].join(' ')}
        style={{ minHeight: `${ROW_HEIGHT_PX}px` }}
      >
        {children}
      </div>
    </SortableContext>
  )
}

// Parse a droppable id of the form `col-{N}` back into a column number.
function parseColumnId(id: string | number | null | undefined): number | null {
  if (typeof id !== 'string') return null
  const match = /^col-(\d+)$/.exec(id)
  if (!match) return null
  return Number(match[1])
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
    moveWidgetToColumn,
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

  // Active drag — drives visual affordance on the column containers.
  const [activeId, setActiveId] = useState<WorkspaceWidgetId | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Group visible widgets by column, sorted by their intra-column order.
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

  // Find the column + in-column index for a given widget id.
  const locateWidget = (id: WorkspaceWidgetId): { col: number; index: number } | null => {
    for (const col of COLUMN_IDS) {
      const list = widgetsByColumn.get(col) ?? []
      const idx = list.findIndex((w) => w.id === id)
      if (idx !== -1) return { col, index: idx }
    }
    return null
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as WorkspaceWidgetId)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    if (active.id === over.id) return

    const activeId = active.id as WorkspaceWidgetId
    const source = locateWidget(activeId)
    if (!source) return

    // Determine destination column + index. Two shapes of `over.id`:
    //   1. another widget id → same/other column, slot next to that widget
    //   2. `col-N` (droppable wrapper) → append to column N
    const columnTarget = parseColumnId(over.id as string)
    let destCol: number
    let destIndex: number

    if (columnTarget !== null) {
      destCol = columnTarget
      destIndex = (widgetsByColumn.get(destCol) ?? []).length
    } else {
      const overLoc = locateWidget(over.id as WorkspaceWidgetId)
      if (!overLoc) return
      destCol = overLoc.col
      destIndex = overLoc.index
      // When reordering within the same column past the current slot,
      // dnd-kit's arrayMove expects the target index unchanged; our
      // insert-remove approach handles this correctly because removing
      // the source first shifts the remaining indices down.
    }

    // No-op if the result is identical to the source position.
    if (destCol === source.col && destIndex === source.index) return

    moveWidgetToColumn(activeId, destCol, destIndex)
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

      {/* Tiny reset chip above the grid when the full controls bar is
          hidden — so users can always recover from a botched layout. */}
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

      {/* 3 independent column stacks. Dnd-kit's `closestCorners` is the
          multi-container recommendation — it tracks the nearest item
          across all SortableContexts so cross-column drops land in the
          right slot. */}
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
              <Column
                key={col}
                col={col}
                itemIds={ids}
                isDragActive={activeId !== null}
              >
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
                          onExpand={() => setExpandedId(widget.id as WorkspaceWidgetId)}
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
      </DndContext>

      {/* Floating detail modal — renders a second instance of the
          selected widget's component, unconstrained by the grid cell
          max-height. Dismiss with Esc, backdrop click, or X. */}
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
