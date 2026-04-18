import {
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Maximize2, Minimize2 } from 'lucide-react'
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
  // Click-to-expand: when present, clicking anywhere on the widget's
  // body (but NOT on an interactive element inside) toggles the cell's
  // max-height cap. No chevron strip, no extra chrome — the body
  // itself is the click target.
  isExpanded?: boolean
  onToggleExpand?: () => void
  children: ReactNode
}

// Walk up from the click target looking for an element that should
// absorb the click on its own (button / link / input / etc.). If we
// find one before reaching the widget body root, the body's own
// expand-toggle listener should bail out so the child's handler runs
// alone. Mirrors how CSS `:has` or event delegation would behave.
function isClickOnInteractiveChild(target: EventTarget | null, root: HTMLElement): boolean {
  let node = target as HTMLElement | null
  while (node && node !== root) {
    const tag = node.tagName
    if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'LABEL') {
      return true
    }
    if (node.getAttribute?.('role') === 'button') return true
    node = node.parentElement
  }
  return false
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

  // Detect real overflow so the click-to-expand affordance is only
  // interactive when there's actually something hidden below the fold.
  // When the widget fits, clicking the body does nothing.
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
    Array.from(el.children).forEach((child) => ro.observe(child))
    return () => ro.disconnect()
  }, [children, isExpanded])

  const canExpand = !!onToggleExpand && (hasOverflow || isExpanded)

  const handleBodyClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!canExpand || !onToggleExpand) return
    const root = bodyRef.current
    if (!root) return
    if (isClickOnInteractiveChild(event.target, root)) return
    onToggleExpand()
  }

  return (
    // `widget-card` — mockup-matched gradient + 22px radius + hairline
    // border. `containerType: inline-size` lets widget children use
    // @container queries to adapt to widget width.
    <div
      className="widget-card h-full flex flex-col overflow-hidden group/widget relative"
      style={{ containerType: 'inline-size' }}
    >
      {/* ─── Header (draggable) ────────────────────────────────── */}
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
        <div className="flex items-center gap-1 shrink-0">
          {/* Expand / collapse indicator — shown when there's real
              overflow, OR when the user has manually expanded. Acts as
              both a state hint and a backup button for users who
              haven't discovered the click-the-body interaction. */}
          {canExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
              aria-expanded={isExpanded}
              className="p-1.5 rounded-md text-gold/60 hover:text-gold hover:bg-gold/10 transition-colors focus-ring"
            >
              {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
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
      </div>

      {/* ─── Body (click to expand) ─────────────────────────────── */}
      <div
        ref={bodyRef}
        onClick={handleBodyClick}
        className={[
          'flex-1 min-h-0 px-4 py-4 flex flex-col relative',
          canExpand ? 'cursor-pointer' : '',
        ].join(' ')}
      >
        {children}

        {/* Gentle fade at the bottom of a collapsed widget to imply
            "there's more below — click to expand." Disappears when
            expanded. Pointer-events-none so it doesn't intercept
            clicks meant for the body. */}
        {canExpand && !isExpanded && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-[rgba(16,17,23,0.95)]"
          />
        )}
      </div>
    </div>
  )
}
