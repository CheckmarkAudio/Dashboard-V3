import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import type { TeamMember } from '../../types'

/**
 * MemberHighlights + social snapshot — horizontal pill strip.
 *
 * Left side : one pill per active team member (avatar + first name).
 * Right side: one pill per Checkmark Audio social channel — clickable
 *             link plus a follower-count snapshot, justified to the
 *             right edge so the rail reads as
 *             "people on the left, brand presence on the right."
 *
 * Follower counts are currently hardcoded constants (see
 * `SOCIAL_CHANNELS` below). Update them manually as the numbers
 * grow until we wire the strip to real platform APIs (deferred —
 * Instagram + TikTok + YouTube each require OAuth + token refresh
 * to read counts; not worth building until the dashboard sees more
 * employee traffic).
 */

// ─── Social channels ────────────────────────────────────────────────
//
// Update follower counts here when the brand grows. The icon circle
// + count format mirrors the member pill so the two reads as a single
// pill rail rather than separate widgets.

type SocialChannel = {
  platform: 'instagram' | 'tiktok' | 'youtube'
  label: string
  href: string
  /** Follower / subscriber count. Manual until APIs wire up. */
  count: number
}

const SOCIAL_CHANNELS: SocialChannel[] = [
  {
    platform: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/checkmark_audio',
    count: 1240,
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    href: 'https://www.tiktok.com/@checkmarkaudio',
    count: 560,
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/@checkmarkAudio',
    count: 95,
  },
]

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K'
  return n.toLocaleString()
}

// Filled brand glyphs — Simple-Icons-style filled SVG paths so the
// social stat blocks read with visual weight ("less skinny, more
// meat" per user feedback). Each is a single <path> drawn with the
// official brand silhouette at 24×24 viewBox, painted in
// `currentColor` so theme tokens drive the tint.

function InstagramGlyph({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  )
}

function TikTokGlyph({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z"/>
    </svg>
  )
}

function YoutubeGlyph({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

function PlatformIcon({ platform, size = 32 }: { platform: SocialChannel['platform']; size?: number }) {
  if (platform === 'instagram') return <InstagramGlyph size={size} />
  if (platform === 'youtube') return <YoutubeGlyph size={size} />
  return <TikTokGlyph size={size} />
}

// ─── Member pill ────────────────────────────────────────────────────

function initialsFor(name: string | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

function MemberPill({ member }: { member: TeamMember }) {
  const initials = initialsFor(member.display_name)
  const firstName = member.display_name?.split(' ')[0] ?? '—'

  return (
    <Link
      to={`/profile/${member.id}`}
      className="group flex items-center gap-2.5 shrink-0 pl-1.5 pr-4 py-1.5 rounded-2xl border border-border bg-surface hover:bg-surface-hover transition-colors focus-ring"
      aria-label={`View ${member.display_name}'s profile`}
    >
      <span className="block w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 ring-border">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-surface-alt text-text text-[13px] font-bold">
            {initials}
          </span>
        )}
      </span>
      <span className="text-[13px] font-medium text-text whitespace-nowrap">{firstName}</span>
    </Link>
  )
}

// ─── Social pill ────────────────────────────────────────────────────

/**
 * SocialStat — borderless follower-snapshot block. Each instance is
 * a clickable link that reads as a quick "platform · count · label"
 * stat rather than a bordered pill. Visually distinct from the
 * member pills so the rail reads as
 *   [pills (people)] | [stats (audience)]
 *
 * Layout: large outlined icon on the left, then a tight two-line
 * stack on the right (bold count over tiny uppercase platform).
 * Hover: icon + count shift to marigold for a tactile cue.
 */
function SocialStat({ channel }: { channel: SocialChannel }) {
  return (
    <a
      href={channel.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2.5 shrink-0 rounded-md focus-ring transition-colors"
      aria-label={`${channel.label} — ${formatCount(channel.count)} followers`}
      title={`${channel.label} — ${formatCount(channel.count)} followers`}
    >
      <span className="text-text group-hover:text-gold transition-colors shrink-0">
        <PlatformIcon platform={channel.platform} size={32} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[22px] font-bold text-text group-hover:text-gold transition-colors tabular-nums whitespace-nowrap">
          {formatCount(channel.count)}
        </span>
        <span className="text-[10px] text-text-light whitespace-nowrap uppercase tracking-[0.12em] mt-1">
          {channel.label}
        </span>
      </span>
    </a>
  )
}

// ─── Strip ──────────────────────────────────────────────────────────

export default function MemberHighlights() {
  const { data: members = [] } = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
  })

  const active = members.filter((m) => (m.status ?? 'active') === 'active')

  // Render even with zero active members — the social snapshot is
  // useful on its own. Only short-circuit if the strip would be
  // entirely empty (would never happen as long as SOCIAL_CHANNELS
  // is non-empty).
  if (active.length === 0 && SOCIAL_CHANNELS.length === 0) return null

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Members — left side, scrolls horizontally if the team grows */}
      <div className="flex gap-2 overflow-x-auto min-w-0 flex-1 pb-1 -mx-1 px-1 [scrollbar-width:thin]">
        {active.map((member) => (
          <MemberPill key={member.id} member={member} />
        ))}
      </div>

      {/* Social snapshot — borderless stat blocks, right-aligned.
          Larger gap between stats so each reads as its own entity
          rather than a connected pill rail. */}
      <div
        className="flex items-center gap-5 shrink-0 pl-2"
        aria-label="Checkmark Audio social media snapshot"
      >
        {SOCIAL_CHANNELS.map((channel) => (
          <SocialStat key={channel.platform} channel={channel} />
        ))}
      </div>
    </div>
  )
}
