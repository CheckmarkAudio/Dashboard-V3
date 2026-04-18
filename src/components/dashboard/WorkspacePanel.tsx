import { useMemo, type CSSProperties } from 'react'
import { RotateCcw } from 'lucide-react'
import { useWorkspaceLayout } from '../../hooks/useWorkspaceLayout'
import type { AppRole } from '../../domain/permissions'
import type {
  WorkspaceScope,
  WorkspaceWidgetDefinition,
  WidgetSpan,
  WidgetRowSpan,
} from '../../domain/workspaces/types'
import DashboardWidgetFrame from './DashboardWidgetFrame'
import { Button, Card } from '../ui'

/**
 * Fluid span sizing for a CSS-Grid layout.
 *
 * Columns: `grid-cols-3` on desktop (stacks to 2 then 1 at narrower widths).
 * Rows: `auto-rows-[340px]` — a widget with `rowSpan = 2` occupies two
 * adjacent rows (~680px + gap) and other widgets flow around it. Row
 * spans are what give us the "two big rectangles on the left + three
 * smaller widgets on the right" pattern on the admin Hub.
 *
 * When a widget asks for `span 3` on a grid where only 2 tracks fit,
 * browsers clamp the span to the available tracks, so we can express
 * both spans as simple integers without overflow concerns.
 */
function widgetGridStyle(span: WidgetSpan, rowSpan: WidgetRowSpan = 1): CSSProperties {
  return {
    gridColumn: `span ${span}`,
    gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined,
  }
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

      {/* 3-col grid at desktop with mixed widget sizes (still all clean
          rectangles — no L-shapes, no irregular packing). Hero widgets
          take 2 cols; KPI widgets take 1 col. Fixed row height keeps
          widgets perfectly aligned. Stacks responsively on smaller widths. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[340px]">
        {visibleWidgets.map((widget) => {
          const definition = definitionsById.get(widget.id)
          if (!definition) return null
          const WidgetComponent = definition.component
          return (
            <div key={widget.id} style={widgetGridStyle(widget.span, widget.rowSpan ?? definition.defaultRowSpan ?? 1)}>
              <DashboardWidgetFrame
                title={definition.title}
                description={definition.description}
                visible={widget.visible}
                /*
                 * Per-widget reorder/hide controls intentionally omitted for
                 * the cleaner v1.0 design. Drag-and-drop reordering + a small
                 * gear menu for show/hide are scheduled for the next session.
                 */
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
