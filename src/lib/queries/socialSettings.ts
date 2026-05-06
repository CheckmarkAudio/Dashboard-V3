import { supabase } from '../supabase'
import {
  DEFAULT_SOCIAL_CHANNELS,
  type SocialChannelSetting,
  type SocialPlatform,
} from '../socialChannels'

export const socialSettingsKeys = {
  all: ['social-settings'] as const,
}

function normalizeChannel(row: Partial<SocialChannelSetting>): SocialChannelSetting | null {
  const platform = row.platform
  if (
    platform !== 'facebook' &&
    platform !== 'instagram' &&
    platform !== 'youtube' &&
    platform !== 'tiktok'
  ) return null
  const fallback = DEFAULT_SOCIAL_CHANNELS.find((c) => c.platform === platform)
  return {
    platform,
    label: fallback?.label ?? platform,
    url: typeof row.url === 'string' ? row.url : (fallback?.url ?? ''),
    follower_count:
      typeof row.follower_count === 'number'
        ? row.follower_count
        : (fallback?.follower_count ?? 0),
  }
}

export async function fetchSocialSettings(): Promise<SocialChannelSetting[]> {
  const { data, error } = await supabase.rpc('get_team_social_settings')
  if (error) {
    console.error('[queries/socialSettings] fetchSocialSettings failed:', error)
    return DEFAULT_SOCIAL_CHANNELS
  }
  if (!Array.isArray(data)) return DEFAULT_SOCIAL_CHANNELS
  const normalized = data
    .map((row) => normalizeChannel(row as Partial<SocialChannelSetting>))
    .filter(Boolean) as SocialChannelSetting[]
  if (normalized.length === 0) return DEFAULT_SOCIAL_CHANNELS
  const byPlatform = new Map<SocialPlatform, SocialChannelSetting>()
  for (const channel of DEFAULT_SOCIAL_CHANNELS) byPlatform.set(channel.platform, channel)
  for (const channel of normalized) byPlatform.set(channel.platform, channel)
  return DEFAULT_SOCIAL_CHANNELS.map((channel) => byPlatform.get(channel.platform) ?? channel)
}

export async function updateSocialSettings(
  settings: SocialChannelSetting[],
): Promise<SocialChannelSetting[]> {
  const payload = settings.map((setting) => ({
    platform: setting.platform,
    url: setting.url.trim(),
    follower_count: Math.max(0, Math.floor(setting.follower_count || 0)),
  }))
  const { error } = await supabase.rpc('admin_update_team_social_settings', {
    p_settings: payload,
  })
  if (error) {
    console.error('[queries/socialSettings] updateSocialSettings failed:', error)
    throw new Error(error.message)
  }
  return fetchSocialSettings()
}
