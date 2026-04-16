import { useMemo } from 'react'
import { LayoutDashboard, RotateCcw } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { useOverviewWorkspace } from '../hooks/useOverviewWorkspace'
import { OVERVIEW_WIDGET_DEFINITIONS } from '../components/dashboard/overviewWidgets'
import DashboardWidgetFrame from '../components/dashboard/DashboardWidgetFrame'
import { Button, PageHeader, Card } from '../components/ui'

function spanClass(span: 1 | 2 | 3): string {
  if (span === 3) return 'lg:col-span-3'
  if (span === 2) return 'lg:col-span-2'
  return 'lg:col-span-1'
}

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Audio')
  const { profile, appRole } = useAuth()

  const definitionsById = useMemo(
    () => new Map(OVERVIEW_WIDGET_DEFINITIONS.map((widget) => [widget.id, widget])),
    [],
  )

  const {
    layout,
    visibleWidgets,
    moveWidget,
    toggleWidgetVisibility,
    resetLayout,
  } = useOverviewWorkspace({
    role: appRole,
    userId: profile?.id ?? 'guest',
    definitions: OVERVIEW_WIDGET_DEFINITIONS,
  })

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
        subtitle="Your personalized studio workspace. Reorder panels now; richer widget controls come next."
        actions={(
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<RotateCcw size={14} />}
            onClick={resetLayout}
          >
            Reset layout
          </Button>
        )}
      />

      <Card flush flat>
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-section text-text">Workspace Controls</h2>
          <p className="mt-1 text-caption">
            This is the start of the widget system. Widgets are now registered, persisted per user, and ready for deeper customization.
          </p>
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
