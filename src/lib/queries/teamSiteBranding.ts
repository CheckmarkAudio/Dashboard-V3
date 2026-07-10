import { supabase, withSupabaseRetry } from '../supabase'

const LOG_PREFIX = '[queries/teamSiteBranding]'
const BUCKET = 'member-media'
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export type SiteBannerFit = 'original' | 'cover' | 'contain'

export interface TeamSiteBranding {
  site_banner_url: string | null
  site_banner_fit: SiteBannerFit
  site_banner_opacity: number
}

type RawTeamSiteBranding = Partial<TeamSiteBranding> | null | undefined

export const teamSiteBrandingKeys = {
  all: ['team-site-branding'] as const,
  current: () => [...teamSiteBrandingKeys.all, 'current'] as const,
}

function normalizeBranding(row: RawTeamSiteBranding): TeamSiteBranding {
  const fit = row?.site_banner_fit
  const opacity = Number(row?.site_banner_opacity)

  return {
    site_banner_url: row?.site_banner_url ?? null,
    site_banner_fit: fit === 'original' || fit === 'contain' || fit === 'cover' ? fit : 'cover',
    site_banner_opacity: Number.isFinite(opacity) ? Math.min(100, Math.max(0, opacity)) : 100,
  }
}

function fileExtension(name: string, fallback = 'jpg'): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return fallback
  return name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || fallback
}

function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx < 0) return null
  return url.slice(idx + marker.length)
}

export async function fetchTeamSiteBranding(): Promise<TeamSiteBranding> {
  return withSupabaseRetry(async () => {
    const { data, error } = await supabase.rpc('get_team_site_branding')
    if (error) {
      console.error(`${LOG_PREFIX} fetch failed:`, error)
      throw new Error(error.message)
    }
    const row = Array.isArray(data) ? data[0] : data
    return normalizeBranding(row as RawTeamSiteBranding)
  })
}

export async function updateTeamSiteBranding(input: TeamSiteBranding): Promise<TeamSiteBranding> {
  const { data, error } = await supabase.rpc('update_team_site_branding', {
    p_site_banner_url: input.site_banner_url,
    p_site_banner_fit: input.site_banner_fit,
    p_site_banner_opacity: input.site_banner_opacity,
  })
  if (error) {
    console.error(`${LOG_PREFIX} update failed:`, error)
    throw new Error(error.message)
  }
  const row = Array.isArray(data) ? data[0] : data
  return normalizeBranding(row as RawTeamSiteBranding)
}

export async function uploadTeamSiteBanner(file: File, currentUrl?: string | null): Promise<string> {
  if (!ACCEPTED_MIME.includes(file.type)) {
    throw new Error('Use a JPEG, PNG, WEBP, or GIF.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Max file size is 5 MB.')
  }

  const ext = fileExtension(file.name)
  const path = `branding/site-banner/${Date.now()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })
  if (uploadErr) throw new Error(uploadErr.message)

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

  if (currentUrl) {
    const oldPath = pathFromPublicUrl(currentUrl)
    if (oldPath && oldPath !== path) {
      void supabase.storage.from(BUCKET).remove([oldPath])
    }
  }

  return urlData.publicUrl
}

export async function removeTeamSiteBanner(currentUrl?: string | null): Promise<void> {
  if (!currentUrl) return
  const oldPath = pathFromPublicUrl(currentUrl)
  if (!oldPath) return
  void supabase.storage.from(BUCKET).remove([oldPath])
}
