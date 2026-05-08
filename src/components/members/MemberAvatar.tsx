import { useMemo, useState } from 'react'
import type { TeamMember } from '../../types'

/**
 * Canonical member avatar.
 *
 * Renders `member.avatar_url` as a circular `<img>` when set,
 * falling back to the existing initial-circle pattern (same colors,
 * same border, same typography) when missing or after a load error.
 *
 * Centralized so when we ever want to add presence dots, hover
 * cards, status rings, etc., there's exactly one place to do it.
 *
 * `size` accepts a tailwind size token (`xs|sm|md|lg|xl`) which maps
 * to a square px footprint + matching font-size for the initial.
 *
 * Pass either a full `TeamMember` (preferred — gives us the avatar
 * URL) or just `displayName` + `avatarUrl` for places that don't
 * have a TeamMember in scope.
 */

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<AvatarSize, { box: string; text: string }> = {
  xs: { box: 'w-6 h-6',   text: 'text-[10px]' },
  sm: { box: 'w-7 h-7',   text: 'text-[11px]' },
  md: { box: 'w-9 h-9',   text: 'text-[13px]' },
  lg: { box: 'w-12 h-12', text: 'text-[16px]' },
  xl: { box: 'w-20 h-20', text: 'text-[28px]' },
}

export interface MemberAvatarProps {
  member?: Pick<TeamMember, 'display_name' | 'avatar_url'> | null
  /** Override when a full `member` isn't handy. */
  displayName?: string | null
  /** Override when a full `member` isn't handy. */
  avatarUrl?: string | null
  size?: AvatarSize
  /** Extra classes appended to the wrapper. */
  className?: string
  /** Decorative override — defaults to display name for screen readers. */
  alt?: string
}

export default function MemberAvatar({
  member,
  displayName,
  avatarUrl,
  size = 'md',
  className,
  alt,
}: MemberAvatarProps) {
  const url = avatarUrl ?? member?.avatar_url ?? null
  const name = displayName ?? member?.display_name ?? ''
  const [errored, setErrored] = useState(false)

  const initial = useMemo(() => {
    const c = name.trim().charAt(0)
    return c ? c.toUpperCase() : '?'
  }, [name])

  const showImage = Boolean(url) && !errored
  const sizeCls = SIZE_CLASSES[size]
  const wrapperCls = [
    sizeCls.box,
    'rounded-full overflow-hidden shrink-0 flex items-center justify-center',
    showImage
      ? 'bg-surface'
      : 'bg-surface-alt border border-border-light text-gold font-bold',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={wrapperCls} aria-hidden={alt === undefined ? undefined : false}>
      {showImage && url ? (
        <img
          src={url}
          alt={alt ?? name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <span className={sizeCls.text} aria-hidden="true">
          {initial}
        </span>
      )}
    </span>
  )
}
