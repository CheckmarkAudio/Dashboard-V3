import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import { fetchSocialSettings, socialSettingsKeys } from '../../lib/queries/socialSettings'
import { DEFAULT_SOCIAL_CHANNELS, formatSocialCount, type SocialChannelSetting } from '../../lib/socialChannels'
import { SocialIconTile } from '../social/SocialIcon'
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
 * Social links and follower counts come from the team-scoped social
 * settings table, with defaults as a loading fallback.
 */

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
 * SocialStat — compact social snapshot. Each entry is a dark circular
 * brand glyph with the follower count underneath. Platform label is
 * intentionally omitted — the glyph IS the label.
 *
 * Distinct from member pills: members are bordered chips with
 * inverse anatomy (avatar visible, name beside); social stats are
 * filled tiles + count, no border, no platform name.
 */
function SocialStat({ channel }: { channel: SocialChannelSetting }) {
  const count = formatSocialCount(channel.follower_count)
  return (
    <a
      href={channel.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex w-12 shrink-0 flex-col items-center gap-1 rounded-xl py-0.5 focus-ring transition-colors"
      aria-label={`${channel.label} — ${count} followers`}
      title={`${channel.label} — ${count} followers`}
    >
      <SocialIconTile platform={channel.platform} size={40} iconSize={23} />
      <span className="text-[11px] font-bold text-text-muted group-hover:text-gold transition-colors tabular-nums whitespace-nowrap leading-none">
        {count}
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
  const { data: socialChannels = DEFAULT_SOCIAL_CHANNELS } = useQuery({
    queryKey: socialSettingsKeys.all,
    queryFn: fetchSocialSettings,
    staleTime: 60_000,
  })

  // Render even with zero active members — the social snapshot is
  // useful on its own. Only short-circuit if the strip would be
  // entirely empty (would never happen as long as SOCIAL_CHANNELS
  // is non-empty).
  if (active.length === 0 && socialChannels.length === 0) return null

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Members — left side, scrolls horizontally if the team grows */}
      <div className="flex gap-2 overflow-x-auto min-w-0 flex-1 pb-1 -mx-1 px-1 [scrollbar-width:thin]">
        {active.map((member) => (
          <MemberPill key={member.id} member={member} />
        ))}
      </div>

      {/* Social snapshot — compact icon/count tiles, right-aligned.
          gap-3 between tiles + pr-1 buffer so even with hover
          transitions and font measurement quirks the rightmost
          tile content stays comfortably inside the rightmost
          widget's right edge — no bleed at any viewport. */}
      <div
        className="flex items-center gap-3 shrink-0 pl-2 pr-1"
        aria-label="Checkmark Audio social media snapshot"
      >
        {socialChannels.map((channel) => (
          <SocialStat key={channel.platform} channel={channel} />
        ))}
      </div>
    </div>
  )
}
