import type { WorkspaceLayout } from './types'

const STORAGE_PREFIX = 'checkmark-workspace'

export function getWorkspaceStorageKey(scope: WorkspaceLayout['scope'], userId: string): string {
  return `${STORAGE_PREFIX}:${scope}:${userId}`
}

export function loadWorkspaceLayout(scope: WorkspaceLayout['scope'], userId: string): WorkspaceLayout | null {
  try {
    const raw = window.localStorage.getItem(getWorkspaceStorageKey(scope, userId))
    if (!raw) return null
    return JSON.parse(raw) as WorkspaceLayout
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
