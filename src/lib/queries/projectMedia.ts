import { supabase } from '../supabase'
import { isSampleMode } from '../../preview/sampleMode'
import type { Project } from './projects'
import { PROJECT_MEDIA_BUCKET, PROJECT_MEDIA_UNAVAILABLE, assertProjectImageFile, buildProjectMediaPath, isMissingProjectMediaSchema, type ProjectInspoImage, type ProjectInspoList } from './projectMediaSupport'

export {
  PROJECT_MEDIA_BUCKET,
  PROJECT_MEDIA_MAX_BYTES,
  PROJECT_MEDIA_MIME,
  PROJECT_MEDIA_UNAVAILABLE,
  assertProjectImageFile,
  buildProjectMediaPath,
  isMissingProjectMediaSchema,
  projectMediaKeys,
} from './projectMediaSupport'
export type { ProjectInspoImage, ProjectInspoList } from './projectMediaSupport'

async function uploadToBucket(path: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from(PROJECT_MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (error) {
    if (isMissingProjectMediaSchema(error)) throw new Error(PROJECT_MEDIA_UNAVAILABLE)
    throw new Error(error.message)
  }
  const { data } = supabase.storage.from(PROJECT_MEDIA_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function removeUploaded(path: string) {
  try { await supabase.storage.from(PROJECT_MEDIA_BUCKET).remove([path]) } catch { /* Best-effort cleanup. */ }
}

function missingAsUnavailable(error: { code?: string | null; message?: string | null } | null): never {
  if (error && isMissingProjectMediaSchema(error)) throw new Error(PROJECT_MEDIA_UNAVAILABLE)
  throw new Error(error?.message || 'Could not update project media.')
}

export async function fetchProjectInspo(projectId: string): Promise<ProjectInspoList> {
  const { data, error } = await supabase
    .from('project_inspo_images')
    .select('id, project_id, title, public_url, storage_path, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingProjectMediaSchema(error)) return { available: false, images: [] }
    throw new Error(error.message)
  }
  return { available: true, images: (data ?? []) as ProjectInspoImage[] }
}

export async function uploadProjectInspo(input: {
  projectId: string
  teamId: string
  userId: string
  file: File
}): Promise<ProjectInspoImage> {
  assertProjectImageFile(input.file)
  const title = input.file.name.replace(/\.[^.]+$/, '').trim() || 'Inspiration'
  if (import.meta.env.DEV && isSampleMode()) {
    const { sampleUploadInspo } = await import('../../preview/projectMediaSample')
    return sampleUploadInspo({ projectId: input.projectId, title, file: input.file, userId: input.userId })
  }
  const path = buildProjectMediaPath({ ...input, kind: 'inspo' })
  let publicUrl = ''
  try {
    publicUrl = await uploadToBucket(path, input.file)
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error(PROJECT_MEDIA_UNAVAILABLE)
  }
  const { data, error } = await supabase.rpc('add_project_inspo_image', {
    p_project_id: input.projectId,
    p_title: title.slice(0, 160),
    p_storage_path: path,
    p_public_url: publicUrl,
  })
  if (error || !data) {
    await removeUploaded(path)
    missingAsUnavailable(error)
  }
  return data as ProjectInspoImage
}

export async function deleteProjectInspo(image: ProjectInspoImage): Promise<void> {
  if (import.meta.env.DEV && isSampleMode()) {
    const { sampleDeleteInspo } = await import('../../preview/projectMediaSample')
    sampleDeleteInspo(image.id)
    return
  }
  const { error } = await supabase.rpc('delete_project_inspo_image', { p_image_id: image.id })
  if (error) missingAsUnavailable(error)
  if (image.storage_path) await removeUploaded(image.storage_path)
}

export async function setProjectCover(input: {
  projectId: string
  teamId: string
  userId: string
  file: File | null
  currentUrl?: string | null
}): Promise<Project> {
  if (import.meta.env.DEV && isSampleMode()) {
    const { sampleSetCover } = await import('../../preview/projectMediaSample')
    return sampleSetCover({ projectId: input.projectId, file: input.file })
  }
  let coverUrl: string | null = null
  let newPath: string | null = null
  if (input.file) {
    assertProjectImageFile(input.file)
    newPath = buildProjectMediaPath({ teamId: input.teamId, projectId: input.projectId, userId: input.userId, kind: 'covers', file: input.file })
    try {
      coverUrl = await uploadToBucket(newPath, input.file)
    } catch (error) {
      if (error instanceof Error) throw error
      throw new Error(PROJECT_MEDIA_UNAVAILABLE)
    }
  }
  const { data, error } = await supabase.rpc('set_project_cover', {
    p_project_id: input.projectId,
    p_cover_url: coverUrl,
  })
  if (error || !data) {
    if (newPath) await removeUploaded(newPath)
    missingAsUnavailable(error)
  }
  if (input.currentUrl && input.currentUrl !== coverUrl) {
    const marker = `/storage/v1/object/public/${PROJECT_MEDIA_BUCKET}/`
    const idx = input.currentUrl.indexOf(marker)
    if (idx >= 0) await removeUploaded(input.currentUrl.slice(idx + marker.length))
  }
  return data as Project
}
