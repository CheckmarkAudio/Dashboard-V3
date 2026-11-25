import type { ProjectStatus } from '../../lib/queries/projects'

export type ProjectListFilter = 'all' | 'active' | 'completed'

export const PROJECT_LIST_FILTERS: { id: ProjectListFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
]

export function matchesProjectFilter(status: ProjectStatus, filter: ProjectListFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'completed') return status === 'completed'
  return status !== 'completed' && status !== 'archived'
}
