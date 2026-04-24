import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useWorkspaceLayout } from '../../hooks/useWorkspaceLayout'
import type { AppRole } from '../../domain/permissions'
import type {
  WorkspaceScope,
  WorkspaceWidgetDefinition,
  WorkspaceWidgetId,
  WidgetSpan,
  WidgetRowSpan,
} from '../../domain/workspaces/types'
import DashboardWidgetFrame, { type DragHandleProps } from './DashboardWidgetFrame'
import FloatingDetailModal from '../FloatingDetailModal'
import { Button, Card } from '../ui'

/**
 * Manual-placement widget grid (PR #32).
 *
 * Every widget has an explicit (col, row) anchor. The CSS grid renders
 * with `gridColumn` + `gridRow` assignments — no auto-flow, no
 * compaction. Empty cells stay empty until the user drags a widget
 * onto them.
 *
 * Drop targets: every unoccupied (col, row) cell is a `useDroppable`.
 * The dragged widget moves to the cell it's dropped on. Dropping onto
 * an occupied cell is a no-op (we don't swap — user moves widgets one
 * at a time to keep behavior predictable).
 *
 * One spare empty row always renders below the bottom-most widget so
 * users can always drop "further down."
 */
const ROW_HEIGHT_PX = 340
const ROW_GAP_PX = 16
const GRID_COLS = 3

function widgetGridStyle(
  col: number,
  row: number,
  span: WidgetSpan,
  rowSpan: WidgetRowSpan = 1,
): CSSProperties {
  return {
    gridColumn: `${col} / span ${span}`,
    gridRow: `${row} / span ${rowSpan}`,
    maxHeight: `${rowSpan * ROW_HEIGHT_PX + (rowSpan - 1) * ROW_GAP_PX}px`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  }
}

// Draggable widget wrapper. Uses dnd-kit's `useDraggable` (not
// `useSortable`) so drop targets are explicit cells rather than
// neighboring widgets.
function DraggableWidget({
  id,
  col,
  row,
  span,
  rowSpan,
  children,
}: {
  id: WorkspaceWidgetId
  col: number
  row: number
  span: WidgetSpan
  rowSpan: WidgetRowSpan
  children: (dragHandleProps: DragHandleProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style: CSSProperties = {
    ...widgetGridStyle(col, row, span, rowSpan),
    transform: CSS.Translate.toString(transform),
    // Drag transform uses translate; no `transition` so drops feel
    // immediate. While dragging, lift above other widgets.
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

// Empty cell droppable. Only visible (as a dashed outline) while a
// drag is active — otherwise it's invisible space in the grid.
function DropCell({
  col,
  row,
  isDragActive,
}: {
  col: number
  row: number
  isDragActive: boolean
}) {
  const id = `cell-${col}-${row}`
  const { setNodeRef, isOver } = useDroppable({ id })
  const style: CSSProperties = {
    gridColumn: `${col} / span 1`,
    gridRow: `${row} / span 1`,
    minHeight: `${ROW_HEIGHT_PX}px`,
  }
  // Invisible when idle; subtle dashed gold outline during drag;
  // brighter fill when the cursor is directly over this cell.
  const className = !isDragActive
    ? ''
    : isOver
      ? 'rounded-2xl border-2 border-dashed border-gold/70 bg-gold/5 transition-colors'
      : 'rounded-2xl border-2 border-dashed border-border/60 transition-colors'
  return <div ref={setNodeRef} style={style} className={className} aria-hidden={!isDragActive} />
}

// Parse a droppable id of the form `cell-{col}-{row}` back into coords.
function parseCellId(id: string | number | null | undefined): { col: number; row: number } | null {
  if (typeof id !== 'string') return null
  const match = /^cell-(\d+)-(\d+)$/.exec(id)
  if (!match) return null
  return { col: Number(match[1]), row: Number(match[2]) }
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
    moveWidgetToCell,
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

  // Active drag id — drives visual affordance on empty cells. Null when
  // nothing is being dragged.
  const [activeId, setActiveId] = useState<WorkspaceWidgetId | null>(null)

  // dnd-kit sensors. Require a small pointer move before activating so
  // plain clicks on buttons/links inside the widget still pass through.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // Compute occupancy + max row. A widget at (col, row, rowSpan=N)
  // occupies rows [row..row+N-1] in that column.
  const { maxRow, occupied } = useMemo(() => {
    const occ = new Set<string>()
    let rowMax = 1
    for (const widget of visibleWidgets) {
      const col = widget.col
      const top = widget.row
      const bottom = top + ((widget.rowSpan ?? 1) - 1)
      for (let r = top; r <= bottom; r++) {
        occ.add(`${col}:${r}`)
      }
      if (bottom > rowMax) rowMax = bottom
    }
    return { maxRow: rowMax, occupied: occ }
  }, [visibleWidgets])

  // Total grid rows = content rows + 1 spare empty row so users can
  // always drop "further down."
  const totalRows = maxRow + 1

  // Empty cells are every (col, row) that isn't occupied by a widget.
  const emptyCells = useMemo(() => {
    const cells: { col: number; row: number }[] = []
    for (let row = 1; row <= totalRows; row++) {
      for (let col = 1; col <= GRID_COLS; col++) {
        if (!occupied.has(`${col}:${row}`)) {
          cells.push({ col, row })
        }
      }
    }
    return cells
  }, [occupied, totalRows])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as WorkspaceWidgetId)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const cell = parseCellId(over.id as string)
    if (!cell) return // Dropped on a widget (not an empty cell) — no-op.
    moveWidgetToCell(active.id as WorkspaceWidgetId, cell.col, cell.row)
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
              .sort((a, b) => a.order - b.order)
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

      {/* Tiny reset chip — surfaces even when the full controls bar is
          hidden so users can always recover from a botched layout.
          Right-aligned, small, low-contrast until hover. */}
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

      {/* Manual-placement grid. Fixed 3 columns; rows expand to fit the
          bottom-most widget + 1 spare. Every non-occupied (col, row) is
          a droppable cell; widgets render at their (col, row) anchor via
          explicit `gridColumn` + `gridRow` CSS. */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${totalRows}, ${ROW_HEIGHT_PX}px)`,
          }}
        >
          {emptyCells.map(({ col, row }) => (
            <DropCell
              key={`cell-${col}-${row}`}
              col={col}
              row={row}
              isDragActive={activeId !== null}
            />
          ))}
          {visibleWidgets.map((widget) => {
            const definition = definitionsById.get(widget.id)
            if (!definition) return null
            const WidgetComponent = definition.component
            return (
              <DraggableWidget
                key={widget.id}
                id={widget.id as WorkspaceWidgetId}
                col={widget.col}
                row={widget.row}
                span={widget.span}
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
              </DraggableWidget>
            )
          })}
        </div>
      </DndContext>

      {/* Floating detail modal — renders a second instance of the
          selected widget's component, unconstrained by the grid's cell
          max-height so all its content is visible. Dismiss with Esc,
          backdrop click, or the X button in the top-right corner. */}
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

