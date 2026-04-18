import type { HTMLAttributes, ReactNode } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical } from 'lucide-react'
import { Button, Card, CardBody, CardHeader } from '../ui'

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
  // When present, the header shows a grip icon the user can grab to
  // drag-reorder the widget. Omitting it hides the handle entirely.
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
  return (
    // `containerType: inline-size` makes this frame a CSS containment
    // context so widget children can use `@container` queries to adapt
    // their internal layout to the widget's own width, independent of
    // viewport. Pairs with the auto-fit grid in WorkspacePanel.
    <Card flush flat className="h-full overflow-hidden group/widget" style={{ containerType: 'inline-size' }}>
      <CardHeader className="items-start !px-3 !py-2.5">
        <div className="min-w-0 flex items-start gap-2">
          {dragHandleProps && (
            <button
              type="button"
              aria-label={`Drag to reorder ${title}`}
              className="shrink-0 -ml-1 mt-0.5 p-0.5 rounded-md text-text-light/50 opacity-0 group-hover/widget:opacity-100 hover:text-gold hover:bg-surface-hover transition-all cursor-grab active:cursor-grabbing touch-none"
              {...(dragHandleProps.attributes ?? {})}
              {...(dragHandleProps.listeners ?? {})}
            >
              <GripVertical size={14} aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold tracking-tight text-text leading-tight">{title}</h2>
            {description && <p className="mt-0.5 text-[10px] text-text-light leading-tight">{description}</p>}
          </div>
        </div>
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
      </CardHeader>
      <CardBody className="h-full !px-3 !py-3 flex flex-col min-h-0">{children}</CardBody>
    </Card>
  )
}
