import type { AppRole } from '../permissions'
import { getDefaultWorkspaceLayout, getWorkspaceScopeForRole } from './registry'
import type { WorkspaceLayout } from './types'

export function getDefaultOverviewLayout(role: AppRole): WorkspaceLayout {
  return getDefaultWorkspaceLayout(getWorkspaceScopeForRole(role), role)
}
