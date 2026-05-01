import { Instagram, Youtube } from 'lucide-react'

/**
 * SocialLinks — Instagram / TikTok / YouTube icons for the top app bar.
 *
 * Frontend-only for now (PR #65). Backend will eventually surface real
 * follower counts / latest-post previews via these handles, but for
 * the moment the icons just link out to the public profiles. Empty
 * `href`s render as disabled-looking anchors so we never ship a broken
 * link.
 *
 * TikTok isn't in the lucide-react icon set so we inline a minimal
 * stroke SVG that matches lucide's visual weight (24×24 viewBox,
 * `currentColor`, 2px stroke). Sized via the parent's font-size like
 * the lucide icons do.
 */

const HANDLES = {
  instagram: '', // e.g. 'https://instagram.com/checkmarkaudio'
  tiktok: '',
  youtube: '',
}

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  )
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  const disabled = !href
  const className =
    'shrink-0 p-1.5 rounded-lg text-text-muted hover:text-gold hover:bg-white/[0.04] transition-colors focus-ring ' +
    (disabled ? 'opacity-50 pointer-events-none' : '')
  return (
    <a
      href={href || '#'}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={className}
    >
      {children}
    </a>
  )
}

export default function SocialLinks() {
  return (
    <div
      className="hidden md:flex items-center gap-0.5 px-1 rounded-xl"
      aria-label="Checkmark Audio social media"
    >
      <SocialLink href={HANDLES.instagram} label="Checkmark Audio on Instagram">
        <Instagram size={16} strokeWidth={2} />
      </SocialLink>
      <SocialLink href={HANDLES.tiktok} label="Checkmark Audio on TikTok">
        <TikTokIcon size={16} />
      </SocialLink>
      <SocialLink href={HANDLES.youtube} label="Checkmark Audio on YouTube">
        <Youtube size={16} strokeWidth={2} />
      </SocialLink>
    </div>
  )
}
