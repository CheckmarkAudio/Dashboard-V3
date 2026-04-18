import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Eye, EyeOff, GripVertical } from 'lucide-react'
import { Button } from '../ui'

// Drag-handle props are exactly what @dnd-kit hands out from
// useSortable — we wrap them in a lightweight object so the frame
// doesn't need to import dnd-kit itself.
export interface DragHandleProps {
  attributes?: HTMLAttributes<HTMLElement>
  listeners?: Record<string, (event: Event) => void>
  isDragging?: boolean
}

interface DashboardWidgetFrameProps {
  title: string
  description?: string
  canMoveUp?: boolean
  canMoveDown?: boolean
  visible?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  onToggleVisibility?: () => void
  dragHandleProps?: DragHandleProps
  // Expand / collapse — when `onToggleExpand` is present, the frame
  // renders a chevron strip on its bottom border that the user can
  // click to reveal content hidden by the cell's max-height cap.
  isExpanded?: boolean
  onToggleExpand?: () => void
  children: ReactNode
}

export default function DashboardWidgetFrame({
  title,
  description,
  canMoveUp = false,
  canMoveDown = false,
  visible = true,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  dragHandleProps,
  isExpanded = false,
  onToggleExpand,
  children,
}: DashboardWidgetFrameProps) {
  // Bind drag attributes/listeners to the whole title zone so the user
  // can grab anywhere on the top bar. Action buttons on the right opt
  // out thanks to the 6px sensor activation distance.
  const dragZoneProps = dragHandleProps
    ? { ...(dragHandleProps.attributes ?? {}), ...(dragHandleProps.listeners ?? {}) }
    : undefined

  // Detect real overflow so the expand affordance only renders when
  // there's actually something hidden below the fold. Compares the
  // content's full scrollHeight against its rendered clientHeight +
  // re-checks on resize (ResizeObserver). When the widget fits, the
  // chevron strip stays off.
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const check = () => {
      setHasOverflow(el.scrollHeight > el.clientHeight + 1)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    // Also observe children so nested content changes (e.g. data
    // arriving after loading) re-trigger the check.
    Array.from(el.children).forEach((child) => ro.observe(child))
    return () => ro.disconnect()
  }, [children, isExpanded])

  const showChevron = !!onToggleExpand && (hasOverflow || isExpanded)

  return (
    // `widget-card` — mockup-matched gradient + 22px radius + hairline
    // border. `containerType: inline-size` lets widget children use
    // @container queries to adapt to widget width.
    <div
      className="widget-card h-full flex flex-col overflow-hidden group/widget"
      style={{ containerType: 'inline-size' }}
    >
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-white/5 flex items-start justify-between gap-3">
        <div
          {...(dragZoneProps ?? {})}
          className={[
            'min-w-0 flex-1 flex items-start gap-2',
            dragHandleProps
              ? 'cursor-grab active:cursor-grabbing touch-none select-none -m-1 p-1 rounded-lg hover:bg-white/[0.03] transition-colors'
              : '',
          ].join(' ')}
          aria-label={dragHandleProps ? `Drag to reorder ${title}` : undefined}
          role={dragHandleProps ? 'button' : undefined}
        >
          {dragHandleProps && (
            <span
              className="shrink-0 mt-0.5 text-gold/50 group-hover/widget:text-gold/80 transition-colors"
              aria-hidden="true"
            >
              <GripVertical size={14} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-tight text-text leading-tight">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[12px] text-text-muted leading-snug">{description}</p>
            )}
          </div>
        </div>
        {(onMoveUp || onMoveDown || onToggleVisibility) && (
          <div className="flex items-center gap-1 shrink-0">
            {onMoveUp && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                aria-label={`Move ${title} up`}
                iconLeft={<ArrowUp size={13} />}
              />
            )}
            {onMoveDown && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                aria-label={`Move ${title} down`}
                iconLeft={<ArrowDown size={13} />}
              />
            )}
            {onToggleVisibility && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleVisibility}
                aria-label={`${visible ? 'Hide' : 'Show'} ${title}`}
                iconLeft={visible ? <EyeOff size={13} /> : <Eye size={13} />}
              />
            )}
          </div>
        )}
      </div>

      {/* ─── Body ───────────────────────────────────────────────── */}
      <div ref={bodyRef} className="flex-1 min-h-0 px-4 py-4 flex flex-col">
        {children}
      </div>

      {/* ─── Drop-down affordance ───────────────────────────────────
          Only rendered when there's actual overflow or the widget is
          currently expanded. Click the strip to toggle the cell's
          max-height cap on SortableWidget. */}
      {showChevron && (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={isExpanded ? `Collapse ${title}` : `Show more ${title}`}
          aria-expanded={isExpanded}
          className="relative shrink-0 h-6 w-full border-t border-white/5 text-gold/50 hover:text-gold hover:bg-gold/5 transition-colors flex items-center justify-center focus-ring"
        >
          {/* Gentle fade hint when collapsed — implies more content
              below the fold without adding any text label. */}
          {!isExpanded && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-b from-transparent to-[rgba(16,17,23,0.95)]"
            />
          )}
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
    </div>
  )
}
