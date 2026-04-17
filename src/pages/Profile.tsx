import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronLeft, Loader2, Mail } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { fetchTeamMembers, teamMemberKeys } from '../lib/queries/teamMembers'
import type { TeamMember } from '../types'

/**
 * Member profile page.
 *
 * Data source is the shared `intern_users` react-query cache, so a
 * click from the Overview Team widget or the admin Members directory
 * hits a warm cache with no refetch. Sections for bio / website /
 * socials are conditional — those columns don't exist on
 * `intern_users` today, so we render nothing rather than empty
 * scaffolding. When they're added the sections light up automatically.
 */
export default function Profile() {
  const { memberId } = useParams<{ memberId: string }>()

  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const members: TeamMember[] = teamQuery.data ?? []
  const member = members.find((m) => m.id === memberId)

  useDocumentTitle(member ? `${member.display_name} - Checkmark Audio` : 'Profile - Checkmark Audio')

  if (teamQuery.isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex items-center justify-center text-text-light">
        <Loader2 size={18} className="animate-spin mr-2" />
        Loading profile…
      </div>
    )
  }

  if (teamQuery.error) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex items-start gap-2 text-amber-300">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Could not load profile</p>
          <p className="text-xs text-text-light mt-0.5">{(teamQuery.error as Error).message}</p>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center animate-fade-in">
        <p className="text-[16px] text-text-muted">Profile not found.</p>
        <Link to="/" className="text-[13px] text-gold hover:underline mt-3 inline-block">
          Back to Overview
        </Link>
      </div>
    )
  }

  const initial = member.display_name?.charAt(0)?.toUpperCase() ?? '?'
  const otherMembers = members.filter((m) => m.id !== member.id)

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Back link */}
      <Link to="/" className="flex items-center gap-1 text-[12px] text-text-light hover:text-gold transition-colors mb-6">
        <ChevronLeft size={14} /> Back to Dashboard
      </Link>

      {/* Profile card */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        {/* Header / hero area */}
        <div className="bg-surface-alt px-8 pt-8 pb-6">
          <div className="flex items-center gap-5">
            {/* Profile photo placeholder */}
            <div className="w-20 h-20 rounded-full bg-surface border-2 border-border-light text-gold flex items-center justify-center text-[28px] font-bold shrink-0">
              {initial}
            </div>
            <div>
              <h1 className="text-[24px] font-extrabold text-text tracking-tight">{member.display_name}</h1>
              {member.position && (
                <p className="text-[14px] text-text-muted mt-0.5">{member.position}</p>
              )}
              {member.department && (
                <p className="text-[12px] text-text-light mt-0.5">{member.department}</p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-6">
          {/* Contact */}
          <div>
            <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-3">Contact</h2>
            <div className="space-y-2">
              <a
                href={`mailto:${member.email}`}
                className="flex items-center gap-3 text-[14px] text-text-muted hover:text-gold transition-colors"
              >
                <Mail size={15} className="text-text-light" />
                {member.email}
              </a>
            </div>
          </div>

          {/* Team — other members, clickable to their profiles */}
          {otherMembers.length > 0 && (
            <div>
              <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-3">Team</h2>
              <div className="space-y-0">
                {otherMembers.map((m) => (
                  <Link
                    key={m.id}
                    to={`/profile/${m.id}`}
                    className="flex items-center gap-2.5 py-2 border-b border-border/20 last:border-0 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-7 h-7 rounded-full bg-surface-alt border border-border-light text-gold flex items-center justify-center text-[11px] font-bold shrink-0">
                      {m.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-[13px] text-text-muted tracking-tight">{m.display_name}</span>
                    {m.position && (
                      <span className="text-[11px] text-text-light ml-auto">{m.position}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
