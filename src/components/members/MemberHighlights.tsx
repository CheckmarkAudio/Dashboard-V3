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

function HighlightAvatar({ member }: { member: TeamMember }) {
  const initials = initialsFor(member.display_name)
  const firstName = member.display_name?.split(' ')[0] ?? '—'

  return (
    <Link
      to={`/profile/${member.id}`}
      className="group flex flex-col items-center gap-1.5 shrink-0 w-[72px] focus-ring rounded-xl"
      aria-label={`View ${member.display_name}'s profile`}
    >
      <span className="relative inline-flex items-center justify-center p-[2px] rounded-full bg-gradient-to-tr from-gold via-gold-muted to-gold/40 group-hover:from-gold group-hover:to-gold transition-colors">
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

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]">
      {active.map((member) => (
        <HighlightAvatar key={member.id} member={member} />
      ))}
    </div>
  )
}
