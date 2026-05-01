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
 * Horizontal member-pill chip — clean redesign (Lean 2 rev12) of
 * the previous gold-bevel circle that user described as "blurri
 * and chunky". Each pill is a clickable Link to the member's
 * profile, laid out as [avatar] + [first name] inside a bordered
 * surface chip. Uses semantic tokens so it adapts to both themes.
 */
function MemberPill({ member }: { member: TeamMember }) {
  const initials = initialsFor(member.display_name)
  const firstName = member.display_name?.split(' ')[0] ?? '—'

  return (
    <Link
      to={`/profile/${member.id}`}
      className="group flex items-center gap-2.5 shrink-0 pl-1.5 pr-4 py-1.5 rounded-2xl border border-border bg-surface hover:bg-surface-hover transition-colors focus-ring"
      aria-label={`View ${member.display_name}'s profile`}
    >
      {/* Avatar circle — small, thin border for definition */}
      <span className="block w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 ring-border">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-surface-alt text-text text-[13px] font-bold">
            {initials}
          </span>
        )}
      </span>
      {/* First name */}
      <span className="text-[13px] font-medium text-text whitespace-nowrap">
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

  // gap-2 keeps pills tight but breathable; pb-1 reserves space for
  // the (thin) horizontal scrollbar on overflow.
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]">
      {active.map((member) => (
        <MemberPill key={member.id} member={member} />
      ))}
    </div>
  )
}
