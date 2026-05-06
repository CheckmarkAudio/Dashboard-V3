export type SocialPlatform = 'facebook' | 'instagram' | 'youtube' | 'tiktok'

export interface SocialChannelSetting {
  platform: SocialPlatform
  label: string
  url: string
  follower_count: number
}

export const DEFAULT_SOCIAL_CHANNELS: SocialChannelSetting[] = [
  {
    platform: 'facebook',
    label: 'Facebook',
    url: 'https://www.facebook.com/checkmarkaudio',
    follower_count: 9,
  },
  {
    platform: 'instagram',
    label: 'Instagram',
    url: 'https://www.instagram.com/checkmark_audio',
    follower_count: 502,
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    url: 'https://www.tiktok.com/@checkmarkaudio',
    follower_count: 28,
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    url: 'https://www.youtube.com/@checkmarkAudio',
    follower_count: 8,
  },
]

export function formatSocialCount(n: number): string {
  if (n <= 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K'
  return n.toLocaleString()
}
