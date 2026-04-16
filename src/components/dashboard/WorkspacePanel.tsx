import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { useWorkspaceLayout } from '../../hooks/useWorkspaceLayout'
import type { AppRole } from '../../domain/permissions'
import type { WorkspaceScope, WorkspaceWidgetDefinition, WidgetSpan } from '../../domain/workspaces/types'
import DashboardWidgetFrame from './DashboardWidgetFrame'
import { Button, Card } from '../ui'

function spanClass(span: WidgetSpan): string {
  if (span === 3) return 'lg:col-span-3'
  if (span === 2) return 'lg:col-span-2'
  return 'lg:col-span-1'
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
    moveWidget,
    toggleWidgetVisibility,
    resetLayout,
  } = useWorkspaceLayout({
    scope,
    role,
    userId,
    definitions,
  })

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch auto-rows-[minmax(260px,auto)]">
        {visibleWidgets.map((widget, index) => {
          const definition = definitionsById.get(widget.id)
          if (!definition) return null
          const WidgetComponent = definition.component
          return (
            <div key={widget.id} className={spanClass(widget.span)}>
              <DashboardWidgetFrame
                title={definition.title}
                description={definition.description}
                canMoveUp={index > 0}
                canMoveDown={index < visibleWidgets.length - 1}
                visible={widget.visible}
                onMoveUp={() => moveWidget(widget.id, 'up')}
                onMoveDown={() => moveWidget(widget.id, 'down')}
                onToggleVisibility={() => toggleWidgetVisibility(widget.id)}
              >
                <WidgetComponent />
              </DashboardWidgetFrame>
            </div>
          )
        })}
      </div>
    </div>
  )
}
