import type { HTMLAttributes, ReactNode } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical } from 'lucide-react'
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
  // When present, the header shows a grip icon and the ENTIRE title area
  // becomes a drag zone. Action buttons on the right (eye, move-arrows)
  // stay clickable since the PointerSensor has a 6px activation distance
  // so plain clicks don't trigger a drag.
  dragHandleProps?: DragHandleProps
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
  children,
}: DashboardWidgetFrameProps) {
  // Bind drag attributes/listeners to the whole title zone so the user
  // can grab anywhere on the top bar — not just the grip dot. Action
  // buttons opt out via stopPropagation in their own handlers.
  const dragZoneProps = dragHandleProps
    ? { ...(dragHandleProps.attributes ?? {}), ...(dragHandleProps.listeners ?? {}) }
    : undefined

  return (
    // `widget-card` is defined in src/index.css and matches the v1
    // mockup (gradient, 22px radius, hairline border, inner highlight).
    // `containerType: inline-size` lets widget children use @container
    // queries to adapt to widget width independent of viewport.
    <div
      className="widget-card h-full flex flex-col overflow-hidden group/widget"
      style={{ containerType: 'inline-size' }}
    >
      {/* ─── Header ──────────────────────────────────────────────────
          The entire title area is a drag zone when dragHandleProps is
          present. Visual grip icon anchors the interaction for users
          who haven't learned the convention yet. */}
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

      {/* ─── Body ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 px-4 py-4 flex flex-col">{children}</div>
    </div>
  )
}
