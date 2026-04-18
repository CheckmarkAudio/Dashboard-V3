import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
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
import { Button, Card } from '../ui'

/**
 * Fluid span sizing for a CSS-Grid layout.
 *
 * Columns: `grid-cols-3` on desktop (stacks to 2 then 1 at narrower widths).
 * Rows: `auto-rows-min` — each row sizes to its content so a short
 * widget doesn't leave vertical padding.
 *
 * `maxHeight` caps a collapsed widget. When the user clicks the bottom
 * chevron ("drop-down" affordance), SortableWidget removes the cap and
 * the widget grows to show all its content — no side-scrollbars.
 */
const ROW_HEIGHT_PX = 340
const ROW_GAP_PX = 16

function widgetGridStyle(
  span: WidgetSpan,
  rowSpan: WidgetRowSpan = 1,
  expanded = false,
): CSSProperties {
  return {
    gridColumn: `span ${span}`,
    gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined,
    maxHeight: expanded ? 'none' : `${rowSpan * ROW_HEIGHT_PX + (rowSpan - 1) * ROW_GAP_PX}px`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  }
}

// Individual sortable widget wrapper. Owns its local expand state —
// each widget expands/collapses independently. When expanded, the
// outer cell's max-height is dropped so the widget grows to fit all
// of its content rather than clipping or scrolling internally.
function SortableWidget({
  id,
  span,
  rowSpan,
  children,
}: {
  id: WorkspaceWidgetId
  span: WidgetSpan
  rowSpan: WidgetRowSpan
  children: (args: {
    dragHandleProps: DragHandleProps
    isExpanded: boolean
    onToggleExpand: () => void
  }) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const [isExpanded, setIsExpanded] = useState(false)

  const style: CSSProperties = {
    ...widgetGridStyle(span, rowSpan, isExpanded),
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'ring-2 ring-gold/60 rounded-2xl shadow-2xl' : ''}>
      {children({
        dragHandleProps: {
          attributes: attributes as DragHandleProps['attributes'],
          listeners: listeners as DragHandleProps['listeners'],
          isDragging,
        },
        isExpanded,
        onToggleExpand: () => setIsExpanded((prev) => !prev),
      })}
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
    reorderWidgets,
    resetLayout,
  } = useWorkspaceLayout({
    scope,
    role,
    userId,
    definitions,
  })

  // dnd-kit sensors. Require a small pointer move before activating so
  // plain clicks on buttons/links inside the widget still pass through.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const visibleIds = useMemo(
    () => visibleWidgets.map((w) => w.id as WorkspaceWidgetId),
    [visibleWidgets],
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = visibleIds.indexOf(active.id as WorkspaceWidgetId)
    const newIndex = visibleIds.indexOf(over.id as WorkspaceWidgetId)
    if (oldIndex === -1 || newIndex === -1) return
    const nextIds = arrayMove(visibleIds, oldIndex, newIndex)
    reorderWidgets(nextIds)
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

      {/* 3-col grid with auto-rows-min so every widget hugs its content.
          Wrapped in dnd-kit's DndContext so each widget is draggable
          via the grip handle in its header. */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
            {visibleWidgets.map((widget) => {
              const definition = definitionsById.get(widget.id)
              if (!definition) return null
              const WidgetComponent = definition.component
              return (
                <SortableWidget
                  key={widget.id}
                  id={widget.id as WorkspaceWidgetId}
                  span={widget.span}
                  rowSpan={widget.rowSpan ?? definition.defaultRowSpan ?? 1}
                >
                  {({ dragHandleProps, isExpanded, onToggleExpand }) => (
                    <DashboardWidgetFrame
                      title={definition.title}
                      description={definition.description}
                      visible={widget.visible}
                      dragHandleProps={dragHandleProps}
                      isExpanded={isExpanded}
                      onToggleExpand={onToggleExpand}
                    >
                      <WidgetComponent />
                    </DashboardWidgetFrame>
                  )}
                </SortableWidget>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
