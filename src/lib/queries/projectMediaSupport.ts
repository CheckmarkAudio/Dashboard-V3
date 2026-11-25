// Shared project-media helpers with no Supabase client import, so tests can load them in Node.
export const PROJECT_MEDIA_BUCKET = 'project-media'
export const PROJECT_MEDIA_MAX_BYTES = 5 * 1024 * 1024
export const PROJECT_MEDIA_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export const projectMediaKeys = {
  inspo: (projectId: string) => ['project-inspo', projectId] as const,
}

export interface ProjectInspoImage {
  id: string
  project_id: string
  title: string
  public_url: string
  storage_path: string
  created_at: string
}

export interface ProjectInspoList {
  available: boolean
  images: ProjectInspoImage[]
}

export const PROJECT_MEDIA_UNAVAILABLE =
  'Image uploads will be available after the project media update is applied.'

export function isMissingProjectMediaSchema(error: { code?: string | null; message?: string | null; status?: number } | null | undefined): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  const message = String(error.message ?? '').toLowerCase()
  if (['42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)) return true
  if (error.status === 404) return true
  return (
    message.includes('schema cache')
    || message.includes('does not exist')
    || message.includes('could not find the table')
    || message.includes('could not find the function')
    || message.includes('bucket not found')
    || (message.includes('project-media') && message.includes('not found'))
    || message.includes('project_inspo_images') && (message.includes('not find') || message.includes('does not exist'))
  )
}

export function assertProjectImageFile(file: File): void {
  const type = file.type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.type.toLowerCase()
  if (!(PROJECT_MEDIA_MIME as readonly string[]).includes(type)) {
    throw new Error('Use a JPEG, PNG, WEBP, or GIF image.')
  }
  if (file.size > PROJECT_MEDIA_MAX_BYTES) {
    throw new Error('Images must be 5 MB or smaller.')
  }
}

function safeFileName(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return base || 'image'
}

function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

export function buildProjectMediaPath(input: {
  teamId: string
  projectId: string
  kind: 'covers' | 'inspo'
  userId: string
  file: File
}): string {
  const stamp = Date.now()
  return `${input.teamId}/${input.projectId}/${input.kind}/${input.userId}/${stamp}-${safeFileName(input.file.name) || 'image'}.${extensionFor(input.file)}`
}

