import type { Project } from '../lib/queries/projects.ts'
import type { ProjectInspoImage } from '../lib/queries/projectMedia.ts'
import { sampleProjects, sampleTables } from './fixtures.ts'

function rows(): Record<string, unknown>[] {
  return (sampleTables.project_inspo_images ??= [])
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
}

export async function sampleUploadInspo(input: {
  projectId: string
  title: string
  file: File
  userId: string
}): Promise<ProjectInspoImage> {
  if (!sampleProjects.some((project) => project.id === input.projectId)) {
    throw new Error('Unknown sample project')
  }
  const public_url = await readAsDataUrl(input.file)
  const row: ProjectInspoImage = {
    id: crypto.randomUUID(),
    project_id: input.projectId,
    title: input.title.slice(0, 160),
    public_url,
    storage_path: `sample-team/${input.projectId}/inspo/${input.userId}/${Date.now()}-${input.file.name || 'image'}`,
    created_at: new Date().toISOString(),
  }
  rows().push(row as unknown as Record<string, unknown>)
  return row
}

export function sampleDeleteInspo(imageId: string): void {
  const list = rows()
  const index = list.findIndex((row) => row.id === imageId)
  if (index >= 0) list.splice(index, 1)
}

export async function sampleSetCover(input: { projectId: string; file: File | null }): Promise<Project> {
  const project = sampleProjects.find((entry) => entry.id === input.projectId)
  if (!project) throw new Error('Unknown sample project')
  const cover_url = input.file ? await readAsDataUrl(input.file) : null
  Object.assign(project, { cover_url, updated_at: new Date().toISOString() })
  const table = sampleTables.projects
  const row = table?.find((entry) => entry.id === input.projectId)
  if (row) Object.assign(row, { cover_url, updated_at: project.updated_at })
  return project as unknown as Project
}

export function sampleProjectMediaRpc(rpc: string, args: Record<string, unknown>): { body: unknown; status: number } | null {
  if (rpc === 'delete_project_inspo_image') {
    const id = String(args.p_image_id ?? '')
    const before = rows().length
    sampleDeleteInspo(id)
    if (rows().length === before) return { body: { message: 'Inspiration image not found', code: '42501' }, status: 403 }
    return { body: id, status: 200 }
  }
  if (rpc === 'add_project_inspo_image') {
    if (!sampleProjects.some((project) => project.id === args.p_project_id)) {
      return { body: { message: 'Unknown sample project', code: '42501' }, status: 403 }
    }
    const row: ProjectInspoImage = {
      id: crypto.randomUUID(),
      project_id: String(args.p_project_id),
      title: String(args.p_title ?? 'Inspiration').slice(0, 160),
      public_url: String(args.p_public_url ?? ''),
      storage_path: String(args.p_storage_path ?? ''),
      created_at: new Date().toISOString(),
    }
    rows().push(row as unknown as Record<string, unknown>)
    return { body: row, status: 200 }
  }
  if (rpc === 'set_project_cover') {
    const project = sampleProjects.find((entry) => entry.id === args.p_project_id)
    if (!project) return { body: { message: 'Unknown sample project', code: '42501' }, status: 403 }
    const cover_url = args.p_cover_url ? String(args.p_cover_url) : null
    Object.assign(project, { cover_url, updated_at: new Date().toISOString() })
    return { body: project, status: 200 }
  }
  return null
}
