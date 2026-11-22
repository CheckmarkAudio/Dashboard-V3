export const PROJECTS_PATH = '/projects'

function copySearch(search?: URLSearchParams | string): URLSearchParams {
  return new URLSearchParams(typeof search === 'string' ? search : search ?? undefined)
}

/** Deep link into a project workspace, keeping preview flags like sample=1. */
export function projectDetailPath(
  projectId: string,
  search?: URLSearchParams | string,
  extras?: { task?: string | null },
): string {
  const params = copySearch(search)
  params.delete('project')
  if (extras && 'task' in extras) {
    if (extras.task) params.set('task', extras.task)
    else params.delete('task')
  }
  const query = params.toString()
  return `${PROJECTS_PATH}/${encodeURIComponent(projectId)}${query ? `?${query}` : ''}`
}

/** Projects gallery, dropping a selected project or task deep link. */
export function projectsListPath(search?: URLSearchParams | string): string {
  const params = copySearch(search)
  params.delete('project')
  params.delete('task')
  const query = params.toString()
  return `${PROJECTS_PATH}${query ? `?${query}` : ''}`
}

/** Map the legacy ?project= query to the project workspace route. */
export function legacyProjectSearchRedirect(search: string): string | null {
  const params = new URLSearchParams(search)
  const projectId = params.get('project')
  if (!projectId) return null
  return projectDetailPath(projectId, params)
}
