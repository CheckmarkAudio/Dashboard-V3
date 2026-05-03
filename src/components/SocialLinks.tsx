import { useQuery } from '@tanstack/react-query'
import { fetchSocialSettings, socialSettingsKeys } from '../lib/queries/socialSettings'
import { DEFAULT_SOCIAL_CHANNELS, type SocialPlatform } from '../lib/socialChannels'
import { SocialIconTile } from './social/SocialIcon'

function SocialLink({
  href,
  label,
  platform,
}: {
  href: string
  label: string
  platform: SocialPlatform
}) {
  const disabled = !href
  return (
    <a
      href={href || '#'}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Checkmark Audio on ${label}`}
      title={`Checkmark Audio on ${label}`}
      className={`group shrink-0 rounded-full transition-transform focus-ring ${
        disabled ? 'opacity-45 pointer-events-none' : 'hover:-translate-y-0.5'
      }`}
    >
      <SocialIconTile platform={platform} size={30} iconSize={17} />
    </a>
  )
}

export default function SocialLinks() {
  const { data } = useQuery({
    queryKey: socialSettingsKeys.all,
    queryFn: fetchSocialSettings,
    staleTime: 60_000,
  })
  const channels = data ?? DEFAULT_SOCIAL_CHANNELS

  return (
    <div
      className="hidden md:flex items-center gap-1 px-1 rounded-xl"
      aria-label="Checkmark Audio social media"
    >
      {channels.map((channel) => (
        <SocialLink
          key={channel.platform}
          href={channel.url}
          label={channel.label}
          platform={channel.platform}
        />
      ))}
    </div>
  )
}
