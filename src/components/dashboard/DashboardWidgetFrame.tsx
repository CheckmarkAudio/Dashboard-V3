import type { HTMLAttributes, ReactNode } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Maximize2 } from 'lucide-react'
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
  // Expand — click the title to open this widget as a floating modal
  // (see WorkspacePanel). The frame only emits the intent; the panel
  // owns the modal state and renders the overlay.
  onExpand?: () => void
  /**
   * Hide the frame's title bar (title text + description), leaving
   * only the corner controls (drag handle, expand, visibility,
   * reorder). Use for widgets whose body provides its own bold
   * title via `<ListPanel>` — avoids the "title within a title"
   * redundancy and lets the inner panel's header carry the
   * hierarchy. The drag/expand affordances stay reachable in the
   * top-right corner.
   */
  hideTitle?: boolean
  children: ReactNode
}

export default function DashboardWidgetFrame({
  title,
  // `description` intentionally omitted from destructure — sitewide
  // subtitle suppression (skin pass 2026-05-06). The prop stays on
  // the type and is still consumed when the widget is expanded into
  // the FloatingDetailModal (rendered there as the modal eyebrow,
  // not as a subtitle under the title).
  canMoveUp = false,
  canMoveDown = false,
  visible = true,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  dragHandleProps,
  onExpand,
  hideTitle = false,
  children,
}: DashboardWidgetFrameProps) {
  // Bind drag attributes/listeners to the grip element only — NOT the
  // title, since the title itself is a click target for the modal.
  const gripProps = dragHandleProps
    ? { ...(dragHandleProps.attributes ?? {}), ...(dragHandleProps.listeners ?? {}) }
    : undefined

  return (
    <div
      className="widget-card h-full flex flex-col overflow-hidden group/widget relative"
      style={{ containerType: 'inline-size' }}
    >
      {/* ─── Header ───────────────────────────────────────────────
          When `hideTitle` is true the bar collapses: no bold title,
          no bottom border, lower vertical padding. The drag handle
          + corner controls stay visible (top-right) so the widget
          can still be reordered, expanded, hidden. The body's own
          `<ListPanel>` header carries the title hierarchy in that
          case. */}
      <div
        className={[
          'px-4 flex items-start justify-between gap-3',
          hideTitle ? 'py-1.5' : 'py-3 border-b border-white/5',
        ].join(' ')}
      >
        <div className="min-w-0 flex-1 flex items-start gap-2">
          {dragHandleProps && (
            <button
              type="button"
              {...(gripProps ?? {})}
              aria-label={`Drag to reorder ${title}`}
              className="shrink-0 mt-0.5 -ml-1 p-1 rounded-md text-gold/50 hover:text-gold hover:bg-gold/10 cursor-grab active:cursor-grabbing touch-none transition-colors focus-ring"
            >
              <GripVertical size={14} aria-hidden="true" />
            </button>
          )}
          {/* Title is the click target that opens the floating detail
              modal. Clicking anywhere on the text (title or description)
              expands. Hover state previews the affordance in gold.
              In `hideTitle` mode we render nothing here — the corner
              expand button (right side) is the only expand
              affordance. */}
          {/* Skin pass 2026-05-06 — `description` no longer renders
              under the widget title. Sitewide policy: titles only,
              no decorative subtitle/description text. The
              `description` prop is kept (used for accessibility
              labels on drag/expand buttons + as the modal eyebrow
              when the widget is expanded), but it does not appear
              as a `<p>` under the title in the in-grid header. */}
          {!hideTitle && (onExpand ? (
            <button
              type="button"
              onClick={onExpand}
              aria-label={`Expand ${title}`}
              className="min-w-0 text-left -m-1 p-1 rounded-lg hover:bg-white/[0.03] transition-colors focus-ring group/title"
            >
              <h2 className="text-[15px] font-bold tracking-tight text-text group-hover/title:text-gold transition-colors leading-tight">
                {title}
              </h2>
            </button>
          ) : (
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold tracking-tight text-text leading-tight">{title}</h2>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              aria-label={`Expand ${title}`}
              className="p-1.5 rounded-md text-gold/50 hover:text-gold hover:bg-gold/10 transition-colors focus-ring"
            >
              <Maximize2 size={13} />
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

      {/* ─── Body ─────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 px-4 py-4 flex flex-col">{children}</div>
    </div>
  )
}
