import { WORKSPACE_LAYOUT_VERSION } from './registry'
import type { WorkspaceLayout } from './types'

const STORAGE_PREFIX = 'checkmark-workspace'

export function getWorkspaceStorageKey(scope: WorkspaceLayout['scope'], userId: string): string {
  return `${STORAGE_PREFIX}:${scope}:${userId}`
}

// Saved layouts whose version mismatches the current
// `WORKSPACE_LAYOUT_VERSION` are treated as absent — the caller falls
// back to the default layout, giving every user the fresh ordering when
// the default rearranges.
export function loadWorkspaceLayout(scope: WorkspaceLayout['scope'], userId: string): WorkspaceLayout | null {
  try {
    const raw = window.localStorage.getItem(getWorkspaceStorageKey(scope, userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkspaceLayout
    if (parsed.version !== WORKSPACE_LAYOUT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export function saveWorkspaceLayout(layout: WorkspaceLayout, userId: string): void {
  try {
    window.localStorage.setItem(
      getWorkspaceStorageKey(layout.scope, userId),
      JSON.stringify(layout),
    )
  } catch {
    // localStorage may be unavailable; ignore
  }
}
