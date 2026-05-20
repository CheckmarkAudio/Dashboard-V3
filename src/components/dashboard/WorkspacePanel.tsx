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
import { useSessionExpand } from '../../hooks/useSessionExpand'
import type { AppRole } from '../../domain/permissions'
import type {
  WorkspaceScope,
  WorkspaceWidgetDefinition,
  WorkspaceWidgetId,
  WidgetRowSpan,
} from '../../domain/workspaces/types'
import DashboardWidgetFrame, { type DragHandleProps } from './DashboardWidgetFrame'
import { Button, Card } from '../ui'
import {
  packPagedWidgets,
  packedPageForWidget,
  packedTotalPages,
} from '../../lib/carousel/packPagedWidgets'

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
// 2026-05-20 — dropped from 600 → 450ms per user feedback on
// cross-page drag difficulty. Tight enough to feel responsive when
// the user lands on the edge intentionally, slow enough that a
// glancing pass doesn't trigger a phantom page advance.
const EDGE_AUTO_ADVANCE_MS = 450

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
  isExpanded,
  children,
}: {
  id: WorkspaceWidgetId
  width: string
  height: number
  isExpanded: boolean
  children: (dragHandleProps: DragHandleProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  // Combine the dnd-kit transform transition with our own flex-basis
  // transition so the width grow + drag transform feel of-a-piece.
  // Same easing as the carousel translate (320ms cubic-bezier) so the
  // expand grow and the carousel page-scroll land together as one
  // motion — same pattern as MemberActivitySection.
  const combinedTransition = [
    transition ?? '',
    'flex-basis 320ms cubic-bezier(0.16, 1, 0.3, 1)',
    'box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1)',
  ]
    .filter(Boolean)
    .join(', ')
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: combinedTransition,
    flex: `0 0 ${width}`,
    width,
    height: `${height}px`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
    opacity: isDragging ? 0.35 : 1,
    boxShadow: isExpanded
      ? '0 18px 40px -16px rgba(201, 168, 76, 0.32), 0 0 0 1px rgba(201, 168, 76, 0.25)'
      : 'none',
    borderRadius: isExpanded ? 16 : 0,
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

// Edge auto-advance droppable. Only mounts during drag (saves DOM
// noise otherwise). When the dragged widget hovers this zone for
// EDGE_AUTO_ADVANCE_MS, the carousel pages in that direction.
//
// 2026-05-20 — bumped width 64 → 112px + added a persistent (low
// alpha) tint and a chevron icon hint so the hot zone is visible the
// moment a drag starts, not only on hover. User feedback: "I am
// having trouble moving around widgets on the next page" — root
// cause was the zone being too narrow + invisible until landed on.
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
    width: '112px',
    height: `${height}px`,
    pointerEvents: 'auto',
    zIndex: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
    paddingLeft: side === 'left' ? '12px' : 0,
    paddingRight: side === 'right' ? '12px' : 0,
    // Always-visible low-alpha tint during drag so the user sees the
    // hot zone exists. Brightens + saturates on hover to confirm the
    // landing.
    background: isOver
      ? 'linear-gradient(' +
        (side === 'left' ? '90deg' : '270deg') +
        ', rgba(214,170,55,0.32), transparent)'
      : 'linear-gradient(' +
        (side === 'left' ? '90deg' : '270deg') +
        ', rgba(214,170,55,0.08), transparent)',
    transition: 'background 140ms ease-out',
  }
  if (!active) return null
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <div ref={setNodeRef} style={style} aria-hidden>
      <Icon
        size={28}
        strokeWidth={2.5}
        className={`text-gold transition-all duration-150 ${
          isOver ? 'opacity-100 scale-110' : 'opacity-60'
        }`}
      />
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
    swapWidgets,
    resetLayout,
  } = useWorkspaceLayout({
    scope,
    role,
    userId,
    definitions,
  })

  // 2026-05-17 — `expandedId` now drives INLINE expansion (the
  // expanded widget grows to 2 slots wide on the current page,
  // pushing other widgets across the carousel) rather than opening a
  // FloatingDetailModal. Same pattern shipped on MemberActivitySection
  // in PR #199. Click the chevron again to collapse. Auto-collapses
  // on drag start, on viewport-driven pageSize change (a 2-slot
  // widget doesn't make sense on a 1-up page), and on layout reset.
  //
  // 2026-05-17 (Persist widget expansion PR) — backed by
  // `useSessionExpand` so the choice survives page navigations + page
  // reloads for the rest of the session, then clears on logout (via
  // `clearSessionExpandState` in AuthContext.signOut). Keyed by
  // `scope` so each page (Overview / Hub / Tasks / Assign) remembers
  // its own expansion independently, and by `userId` so an account
  // swap in the same tab doesn't bleed state across users.
  const [expandedId, setExpandedId] = useSessionExpand<WorkspaceWidgetId>(scope, userId)

  const pageSize = useViewportPageSize()

  // pageSize=1 (phone): widget already takes the full page, so the
  // "expand to 2 slots" affordance is meaningless. Auto-collapse + hide
  // the expand chevron entirely on phone. Also auto-collapse if the
  // currently expanded widget gets hidden via the controls (it
  // disappears from `visibleWidgets`).
  useEffect(() => {
    if (pageSize === 1 && expandedId !== null) setExpandedId(null)
  }, [pageSize, expandedId])
  useEffect(() => {
    if (!expandedId) return
    const stillVisible = visibleWidgets.some((w) => w.id === expandedId)
    if (!stillVisible) setExpandedId(null)
  }, [visibleWidgets, expandedId])

  const orderedIds = useMemo(
    () => visibleWidgets.map((w) => w.id as WorkspaceWidgetId),
    [visibleWidgets],
  )

  // Pack widgets into pages with the expansion-aware slot algorithm.
  // Each widget has weight=1 (normal) or weight=2 (expanded). When an
  // expanded widget would otherwise span a page boundary, the helper
  // inserts invisible spacer placeholders to fill the orphan slots on
  // the current page and pushes the wide widget to the start of the
  // next page — keeps the carousel's translateX page-snap math clean.
  // Named `packedLayout` to avoid colliding with `layout` from
  // `useWorkspaceLayout` (which is the persisted widget-order data).
  const packedLayout = useMemo(
    () =>
      packPagedWidgets(
        orderedIds,
        (id) => (id === expandedId ? 2 : 1),
        pageSize,
      ),
    [orderedIds, expandedId, pageSize],
  )
  const totalPages = packedTotalPages(packedLayout)

  const [currentPage, setCurrentPage] = useState(0)

  // Reset page when layout/page-size changes leave us out of bounds.
  useEffect(() => {
    if (currentPage > totalPages - 1) setCurrentPage(Math.max(0, totalPages - 1))
  }, [currentPage, totalPages])

  // When a widget expands, auto-navigate to the page it now sits on
  // so the click ALWAYS shows visible motion (otherwise the expanded
  // widget could end up on a different page and feel like "nothing
  // happened"). Smooth transition handled by the carousel translate.
  useEffect(() => {
    if (!expandedId) return
    const page = packedPageForWidget(packedLayout, expandedId)
    if (page !== null) setCurrentPage(page)
  }, [expandedId, packedLayout])

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
    // Collapse any expansion before drag begins — a 2-slot widget mid-
    // drag would orphan its spacer placeholder and break the page-pack
    // math. User can re-expand after the drop if they want.
    setExpandedId(null)
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

  // onDragEnd is the single commit point. Four outcomes:
  //   - drop on another widget → swap order
  //   - drop on edge sensor (2026-05-20) → swap with the widget at
  //     the matching end of the carousel so the user lands on the
  //     new page they auto-paged to. Previously this was a no-op +
  //     widget snapped back, which is what the user hit as "can't
  //     move widgets between carousel pages."
  //   - drop on self / no target → no-op.
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    clearEdgeTimer()
    const { active, over } = event
    if (!over || active.id === over.id) return

    const aId = active.id as WorkspaceWidgetId

    // Drop-on-edge handling. Pick the widget at the relevant END of
    // the visible-widgets array as the swap target. Combined with
    // the auto-page advance during drag, this gives the user a
    // simple model: "hold widget at right edge → page advances →
    // release → widget moves to the end of the carousel." (Same
    // mirror semantics for left edge → moves to the start.)
    if (over.id === 'edge-left' || over.id === 'edge-right') {
      if (visibleWidgets.length < 2) return
      const targetWidget =
        over.id === 'edge-right'
          ? visibleWidgets[visibleWidgets.length - 1]
          : visibleWidgets[0]
      if (!targetWidget || targetWidget.id === aId) return
      swapWidgets(aId, targetWidget.id as WorkspaceWidgetId)
      return
    }

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

  // Carousel sizing. Normal widget width = (100% - (pageSize-1) * gap) / pageSize.
  // Expanded widget = two normal widths plus the gap between them (so
  // a 2-slot widget spans exactly the visual footprint of two normal
  // widgets sitting side by side). Row height = max widget height in
  // the visible set so every widget on every page sits on the same
  // baseline.
  const normalWidgetWidth = `calc((100% - ${(pageSize - 1) * PAGE_GAP_PX}px) / ${pageSize})`
  const expandedWidgetWidth = `calc(2 * ((100% - ${(pageSize - 1) * PAGE_GAP_PX}px) / ${pageSize}) + ${PAGE_GAP_PX}px)`
  const rowHeight = useMemo(() => {
    if (visibleWidgets.length === 0) return ROW_HEIGHT_PX
    const heights = visibleWidgets.map((w) => widgetHeight(w.rowSpan ?? 1))
    return Math.max(...heights)
  }, [visibleWidgets])

  const showArrows = totalPages > 1
  const showDots = totalPages > 1
  // Suppress the expand chevron on phone (pageSize=1): a single-up
  // page is already full width, so "expand to 2 slots" has nothing
  // to expand into.
  const allowExpand = pageSize > 1
  const toggleExpand = (id: WorkspaceWidgetId) =>
    setExpandedId((prev) => (prev === id ? null : id))

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

      {/* 2026-05-06 — standalone "Reset layout" link removed from
          the no-controls variant (Dashboard + Hub) per user direction.
          Reset functionality stays in code (resetLayout) and remains
          surfaced via the controls Card for any consumer that opts
          in via showControls={true}. */}

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
                  transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'transform',
                }}
              >
                {packedLayout.map((item) => {
                  if (item.type === 'spacer') {
                    // Invisible placeholder that holds an orphan slot
                    // when an expanded widget bumps to the next page.
                    // Width matches a normal widget so the flex row's
                    // page rhythm stays intact.
                    return (
                      <div
                        key={item.key}
                        aria-hidden="true"
                        style={{
                          flex: `0 0 ${normalWidgetWidth}`,
                          height: `${rowHeight}px`,
                          transition: 'flex-basis 320ms cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                    )
                  }
                  const widget = visibleWidgets.find((w) => w.id === item.id)
                  const definition = widget ? definitionsById.get(widget.id) : null
                  if (!widget || !definition) return null
                  const WidgetComponent = definition.component
                  const isExpanded = expandedId === item.id
                  return (
                    <SortableWidget
                      key={widget.id}
                      id={widget.id as WorkspaceWidgetId}
                      width={isExpanded ? expandedWidgetWidth : normalWidgetWidth}
                      height={rowHeight}
                      isExpanded={isExpanded}
                    >
                      {(dragHandleProps) => (
                        <DashboardWidgetFrame
                          title={definition.title}
                          description={definition.description}
                          hideTitle={definition.hideTitle}
                          visible={widget.visible}
                          dragHandleProps={dragHandleProps}
                          onExpand={
                            allowExpand
                              ? () => toggleExpand(widget.id as WorkspaceWidgetId)
                              : undefined
                          }
                          isExpanded={isExpanded}
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
              width={normalWidgetWidth}
              height={rowHeight}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
