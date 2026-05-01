import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Instagram, Youtube } from 'lucide-react'
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

// TikTok isn't in lucide-react. Minimal stroke SVG matching lucide's
// 24×24 viewBox + currentColor + 2px weight. Duplicated from
// `SocialLinks.tsx` (top-bar) so this strip can stand alone; if a
// third surface ever needs it, hoist to `components/icons/`.
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

function PlatformIcon({ platform, size = 16 }: { platform: SocialChannel['platform']; size?: number }) {
  if (platform === 'instagram') return <Instagram size={size} strokeWidth={2} />
  if (platform === 'youtube') return <Youtube size={size} strokeWidth={2} />
  return <TikTokIcon size={size} />
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
      className="group inline-flex items-center gap-2 shrink-0 px-1 py-0.5 -mx-1 rounded-md focus-ring transition-colors"
      aria-label={`${channel.label} — ${formatCount(channel.count)} followers`}
      title={`${channel.label} — ${formatCount(channel.count)} followers`}
    >
      <span className="text-text group-hover:text-gold transition-colors shrink-0">
        <PlatformIcon platform={channel.platform} size={26} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[18px] font-bold text-text group-hover:text-gold transition-colors tabular-nums whitespace-nowrap">
          {formatCount(channel.count)}
        </span>
        <span className="text-[9px] text-text-light whitespace-nowrap uppercase tracking-[0.12em] mt-0.5">
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
