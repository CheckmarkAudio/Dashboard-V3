import { OVERVIEW_WIDGET_DEFINITIONS } from '../../components/dashboard/overviewWidgets'
import type { AppRole } from '../permissions'
import type {
  WorkspaceLayout,
  WorkspaceWidgetState,
} from './types'

function buildDefaultWidgetState(
  defs: Pick<(typeof OVERVIEW_WIDGET_DEFINITIONS)[number], 'id' | 'defaultSpan'>[],
): WorkspaceWidgetState[] {
  return defs.map((widget, index) => ({
    id: widget.id,
    order: index,
    visible: true,
    span: widget.defaultSpan,
  }))
}

export function getDefaultOverviewLayout(role: AppRole): WorkspaceLayout {
  const allowedWidgets = OVERVIEW_WIDGET_DEFINITIONS
    .filter((widget) => widget.allowedRoles.includes(role))

  return {
    scope: role === 'owner' || role === 'admin' ? 'admin_overview' : 'member_overview',
    version: 1,
    widgets: buildDefaultWidgetState(allowedWidgets),
  }
}
