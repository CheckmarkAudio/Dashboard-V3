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
    <Card flush flat className="h-full overflow-hidden">
      <CardHeader className="items-start">
        <div className="min-w-0">
          <h2 className="text-section text-text">{title}</h2>
          {description && <p className="mt-1 text-caption">{description}</p>}
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
      <CardBody className="h-full">{children}</CardBody>
    </Card>
  )
}
