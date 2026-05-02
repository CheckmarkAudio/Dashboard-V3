import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { ChevronLeft, ChevronRight, GripVertical, RotateCcw } from 'lucide-react'
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
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
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
  WorkspaceWidgetState,
  WidgetRowSpan,
} from '../../domain/workspaces/types'
import DashboardWidgetFrame, { type DragHandleProps } from './DashboardWidgetFrame'
import FloatingDetailModal from '../FloatingDetailModal'
import { Button, Card } from '../ui'

/**
 * Lean 3 — single-row carousel widget grid.
 *
 * One horizontal row. No vertical drag, no falling down the page.
 * Page size derives from viewport: 1 / 2 / 3 widgets per page (phone /
 * tablet / desktop). When more widgets than fit, arrow buttons + page
 * dots page through. During drag, holding a widget against the row's
 * right (or left) edge for ~600ms auto-advances the carousel so cross-
 * page swaps are possible.
 *
 * Drag commits ONLY in onDragEnd — same invariant PR #34 locked in. The
 * `onDragOver` handler exists but only updates which edge sensor is
 * "warm" (for the auto-advance timer); it never mutates widget order.
 */

const ROW_HEIGHT_PX = 340
const ROW_GAP_PX = 16
const PAGE_GAP_PX = 16
const EDGE_AUTO_ADVANCE_MS = 600

function widgetHeight(rowSpan: WidgetRowSpan = 1): number {
  const base = rowSpan * ROW_HEIGHT_PX
  return rowSpan >= 1 ? base + (rowSpan - 1) * ROW_GAP_PX : base
}

// Page-size breakpoints align with Tailwind's `sm` (640) and `lg` (1024).
function pageSizeForViewport(width: number): number {
  if (width < 640) return 1
  if (width < 1024) return 2
  return 3
}

function useViewportPageSize(): number {
  const [size, setSize] = useState(() =>
    typeof window === 'undefined' ? 3 : pageSizeForViewport(window.innerWidth),
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setSize(pageSizeForViewport(window.innerWidth)))
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [])
  return size
}

// One widget slot inside the carousel. Width is set from the parent so
// it's pageSize-aware. Height matches the row's max rowSpan so all
// widgets in a page sit on the same baseline.
function SortableWidget({
  id,
  width,
  height,
  children,
}: {
  id: WorkspaceWidgetId
  width: string
  height: number
  children: (dragHandleProps: DragHandleProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    flex: `0 0 ${width}`,
    width,
    height: `${height}px`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
    opacity: isDragging ? 0.35 : 1,
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

// DragOverlay ghost — chrome-only so we don't remount the live widget
// (which would re-fetch data, etc.).
function DragGhost({
  definition,
  width,
  height,
}: {
  definition: WorkspaceWidgetDefinition
  width: string
  height: number
}) {
  return (
    <div
      style={{ width, height: `${height}px` }}
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

// Edge auto-advance droppable. Only mounts during drag (saves DOM noise
// otherwise). When the dragged widget hovers this zone for 600ms, the
// carousel pages in that direction.
function EdgeSensor({
  side,
  height,
  active,
}: {
  side: 'left' | 'right'
  height: number
  active: boolean
}) {
  const id = side === 'left' ? 'edge-left' : 'edge-right'
  const { setNodeRef, isOver } = useDroppable({ id })
  const style: CSSProperties = {
    position: 'absolute',
    top: 0,
    [side]: 0,
    width: '64px',
    height: `${height}px`,
    pointerEvents: 'auto',
    zIndex: 5,
    background: isOver
      ? 'linear-gradient(' +
        (side === 'left' ? '90deg' : '270deg') +
        ', rgba(214,170,55,0.18), transparent)'
      : 'transparent',
    transition: 'background 120ms ease-out',
  }
  if (!active) return null
  return <div ref={setNodeRef} style={style} aria-hidden />
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
    swapWidgets,
    resetLayout,
  } = useWorkspaceLayout({
    scope,
    role,
    userId,
    definitions,
  })

  const [expandedId, setExpandedId] = useState<WorkspaceWidgetId | null>(null)
  const expandedDefinition = expandedId ? definitionsById.get(expandedId) : null
  const ExpandedComponent = expandedDefinition?.component

  const pageSize = useViewportPageSize()
  const widgetCount = visibleWidgets.length
  const totalPages = Math.max(1, Math.ceil(widgetCount / pageSize))

  const [currentPage, setCurrentPage] = useState(0)

  // Reset page when layout/page-size changes leave us out of bounds.
  useEffect(() => {
    if (currentPage > totalPages - 1) setCurrentPage(Math.max(0, totalPages - 1))
  }, [currentPage, totalPages])

  const goPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1))
  }, [])
  const goNext = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
  }, [totalPages])

  // Active drag tracking + auto-advance timer.
  const [activeId, setActiveId] = useState<WorkspaceWidgetId | null>(null)
  const activeWidget = activeId
    ? visibleWidgets.find((w) => w.id === activeId)
    : null
  const activeDefinition = activeId ? definitionsById.get(activeId) : null

  const edgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const edgeSideRef = useRef<'left' | 'right' | null>(null)

  const clearEdgeTimer = useCallback(() => {
    if (edgeTimerRef.current) {
      clearTimeout(edgeTimerRef.current)
      edgeTimerRef.current = null
    }
    edgeSideRef.current = null
  }, [])

  // Schedule a page step after EDGE_AUTO_ADVANCE_MS. Re-arms itself on
  // success so a sustained hold pages continuously through the carousel.
  const scheduleEdgeAdvance = useCallback(
    (side: 'left' | 'right') => {
      if (edgeSideRef.current === side && edgeTimerRef.current) return
      clearEdgeTimer()
      edgeSideRef.current = side
      const tick = () => {
        let advanced = false
        setCurrentPage((p) => {
          if (side === 'right' && p < totalPages - 1) {
            advanced = true
            return p + 1
          }
          if (side === 'left' && p > 0) {
            advanced = true
            return p - 1
          }
          return p
        })
        if (advanced && edgeSideRef.current === side) {
          edgeTimerRef.current = setTimeout(tick, EDGE_AUTO_ADVANCE_MS)
        } else {
          clearEdgeTimer()
        }
      }
      edgeTimerRef.current = setTimeout(tick, EDGE_AUTO_ADVANCE_MS)
    },
    [clearEdgeTimer, totalPages],
  )

  // Cancel the edge timer if the user releases or the drag ends.
  useEffect(() => () => clearEdgeTimer(), [clearEdgeTimer])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as WorkspaceWidgetId)
  }

  // onDragOver only manages the auto-advance edge timer. It NEVER
  // mutates widget order — that lesson was paid for in PR #34
  // (cascading-swap bug). Edge sensors are the only droppables this
  // handler watches.
  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id
    if (overId === 'edge-right' && currentPage < totalPages - 1) {
      scheduleEdgeAdvance('right')
    } else if (overId === 'edge-left' && currentPage > 0) {
      scheduleEdgeAdvance('left')
    } else {
      clearEdgeTimer()
    }
  }

  // onDragEnd is the single commit point. Three outcomes:
  //   - drop on another widget → swap order (cross-page works because
  //     the dragged widget stays in DOM regardless of which page is
  //     visible; cursor coords pick the target).
  //   - drop on edge sensor / no target → no-op, widget snaps back.
  //   - drop on self → no-op.
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    clearEdgeTimer()
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (over.id === 'edge-left' || over.id === 'edge-right') return

    const aId = active.id as WorkspaceWidgetId
    const bId = over.id as WorkspaceWidgetId
    const aWidget = visibleWidgets.find((w) => w.id === aId)
    const bWidget = visibleWidgets.find((w) => w.id === bId)
    if (!aWidget || !bWidget) return

    swapWidgets(aId, bId)
  }

  const handleDragCancel = () => {
    setActiveId(null)
    clearEdgeTimer()
  }

  // Carousel sizing. Widget width = (100% - (pageSize-1) * gap) / pageSize.
  // Row height = max widget height in the visible set so every widget on
  // every page sits on the same baseline.
  const widgetWidth = `calc((100% - ${(pageSize - 1) * PAGE_GAP_PX}px) / ${pageSize})`
  const rowHeight = useMemo(() => {
    if (visibleWidgets.length === 0) return ROW_HEIGHT_PX
    const heights = visibleWidgets.map((w) => widgetHeight(w.rowSpan ?? 1))
    return Math.max(...heights)
  }, [visibleWidgets])

  const orderedIds = useMemo(
    () => visibleWidgets.map((w) => w.id as WorkspaceWidgetId),
    [visibleWidgets],
  )

  const showArrows = totalPages > 1
  const showDots = totalPages > 1

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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="relative">
          {/* Carousel viewport — overflow-hidden so off-page widgets
              are clipped; inner row translates by transform. */}
          <div
            className="overflow-hidden"
            style={{ height: `${rowHeight}px` }}
          >
            <SortableContext items={orderedIds} strategy={horizontalListSortingStrategy}>
              <div
                className="flex"
                style={{
                  gap: `${PAGE_GAP_PX}px`,
                  transform: `translateX(calc(${-currentPage * 100}% - ${currentPage * PAGE_GAP_PX}px))`,
                  transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'transform',
                }}
              >
                {visibleWidgets.map((widget) => {
                  const definition = definitionsById.get(widget.id)
                  if (!definition) return null
                  const WidgetComponent = definition.component
                  return (
                    <SortableWidget
                      key={widget.id}
                      id={widget.id as WorkspaceWidgetId}
                      width={widgetWidth}
                      height={rowHeight}
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
              </div>
            </SortableContext>

            {/* Edge sensors — only mount while a drag is active. The
                user can drag a widget into the edge zone to auto-page. */}
            <EdgeSensor
              side="left"
              height={rowHeight}
              active={!!activeId && currentPage > 0}
            />
            <EdgeSensor
              side="right"
              height={rowHeight}
              active={!!activeId && currentPage < totalPages - 1}
            />
          </div>

          {/* Arrow buttons. Hidden when there's only 1 page. */}
          {showArrows && (
            <>
              <button
                type="button"
                onClick={goPrev}
                disabled={currentPage === 0}
                aria-label="Previous page"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-surface border border-border shadow-md text-text hover:bg-surface-alt hover:text-gold disabled:opacity-30 disabled:hover:bg-surface disabled:hover:text-text disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={currentPage >= totalPages - 1}
                aria-label="Next page"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-surface border border-border shadow-md text-text hover:bg-surface-alt hover:text-gold disabled:opacity-30 disabled:hover:bg-surface disabled:hover:text-text disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {/* Page dots. */}
        {showDots && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentPage(i)}
                aria-label={`Go to page ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === currentPage
                    ? 'w-6 bg-gold'
                    : 'w-2 bg-text-muted/40 hover:bg-text-muted/70'
                }`}
              />
            ))}
          </div>
        )}

        <DragOverlay
          dropAnimation={{
            duration: 220,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {activeWidget && activeDefinition ? (
            <DragGhost
              definition={activeDefinition}
              width={widgetWidth}
              height={rowHeight}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

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
