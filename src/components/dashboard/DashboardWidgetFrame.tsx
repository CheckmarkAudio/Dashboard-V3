import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff } from 'lucide-react'
import { Button, Card, CardBody, CardHeader } from '../ui'

interface DashboardWidgetFrameProps {
  title: string
  description?: string
  canMoveUp?: boolean
  canMoveDown?: boolean
  visible?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  onToggleVisibility?: () => void
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
  children,
}: DashboardWidgetFrameProps) {
  return (
    // `containerType: inline-size` makes this frame a CSS containment
    // context so widget children can use `@container` queries to adapt
    // their internal layout to the widget's own width, independent of
    // viewport. Pairs with the auto-fit grid in WorkspacePanel.
    <Card flush flat className="h-full overflow-hidden" style={{ containerType: 'inline-size' }}>
      <CardHeader className="items-start !px-3 !py-2.5">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold tracking-tight text-text leading-tight">{title}</h2>
          {description && <p className="mt-0.5 text-[10px] text-text-light leading-tight">{description}</p>}
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
