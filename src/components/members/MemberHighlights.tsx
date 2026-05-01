import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import type { TeamMember } from '../../types'

function initialsFor(name: string | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

/**
 * One member tile — circular avatar with a beveled gold pill ring.
 *
 * The bevel is built from three concentric layers so it reads as a
 * physical metal pill rather than a flat ring:
 *   1. outer layer  — soft gold glow + 1px hairline ring
 *   2. middle layer — gold-on-gold gradient with inner highlight
 *   3. inner layer  — bg-bg cutout the avatar sits inside
 */
function HighlightAvatar({ member }: { member: TeamMember }) {
  const initials = initialsFor(member.display_name)
  const firstName = member.display_name?.split(' ')[0] ?? '—'

  return (
    <Link
      to={`/profile/${member.id}`}
      className="group flex flex-col items-center gap-2 shrink-0 w-[80px] focus-ring rounded-xl"
      aria-label={`View ${member.display_name}'s profile`}
    >
      {/* Outer ring — soft gold glow + hairline + thin black ink
          line so the bubble doesn't get buried against the light
          grey body in light mode (Lean 2 rev9). border-border maps
          to black in light, dark-grey in dark — both modes gain a
          defining edge without losing the gold pill character. */}
      <span
        className="relative inline-flex items-center justify-center rounded-full p-[3px] bg-gradient-to-b from-gold/85 via-gold/55 to-gold/25 ring-1 ring-gold/35 border border-border shadow-[0_2px_6px_rgba(214,170,55,0.22),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all duration-200 group-hover:from-gold group-hover:via-gold-muted group-hover:to-gold/55 group-hover:shadow-[0_3px_10px_rgba(214,170,55,0.32),inset_0_1px_0_rgba(255,255,255,0.28)]"
      >
        {/* Bevel cutout — bg-bg disk that the avatar sits on */}
        <span className="block w-[60px] h-[60px] rounded-full bg-bg p-[2px]">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt=""
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="w-full h-full rounded-full bg-surface-alt text-gold flex items-center justify-center text-[15px] font-bold">
              {initials}
            </span>
          )}
        </span>
      </span>
      <span className="text-[11px] font-medium text-text-light truncate max-w-full group-hover:text-text transition-colors">
        {firstName}
      </span>
    </Link>
  )
}

export default function MemberHighlights() {
  const { data: members = [] } = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
  })

  const active = members.filter((m) => (m.status ?? 'active') === 'active')

  if (active.length === 0) return null

  // gap-5 (20px) gives more visual breathing room between bubbles than the
  // earlier gap-3 (12px) so the gold rings don't visually merge into a row.
  return (
    <div className="flex gap-5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]">
      {active.map((member) => (
        <HighlightAvatar key={member.id} member={member} />
      ))}
    </div>
  )
}
