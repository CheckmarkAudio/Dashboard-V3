import { getDefaultWorkspaceLayout } from './registry'
import type { WorkspaceLayout, WorkspaceScope } from './types'

// Role no longer picks the scope — each page hardcodes its scope via
// Dashboard.tsx / Hub.tsx. Callers of this helper should pass in the
// scope of whichever surface they're seeding (member_overview for `/`,
// admin_overview for `/admin`).
export function getDefaultOverviewLayout(scope: WorkspaceScope): WorkspaceLayout {
  return getDefaultWorkspaceLayout(scope)
}
