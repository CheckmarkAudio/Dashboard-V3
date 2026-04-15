import { useParams, Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getTeamMember, TEAM } from '../data/team'
import { ChevronLeft, Mail, Globe, ExternalLink } from 'lucide-react'

export default function Profile() {
  const { memberId } = useParams<{ memberId: string }>()
  const member = getTeamMember(memberId ?? '')

  useDocumentTitle(member ? `${member.name} - Checkmark Audio` : 'Profile - Checkmark Audio')

  if (!member) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center animate-fade-in">
        <p className="text-[16px] text-text-muted">Profile not found.</p>
        <Link to="/" className="text-[13px] text-gold hover:underline mt-3 inline-block">Back to Overview</Link>
      </div>
    )
  }

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
              {member.initial}
            </div>
            <div>
              <h1 className="text-[24px] font-extrabold text-text tracking-tight">{member.name}</h1>
              <p className="text-[14px] text-text-muted mt-0.5">{member.role}</p>
              {member.positions.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {member.positions.map(p => (
                    <span key={p} className="text-[10px] font-semibold text-gold bg-gold/8 border border-gold/20 px-2 py-0.5 rounded">{p}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-6">
          {/* Bio */}
          <div>
            <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-2">About</h2>
            <p className="text-[14px] text-text-muted leading-relaxed">{member.bio}</p>
          </div>

          {/* Contact */}
          <div>
            <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-3">Contact</h2>
            <div className="space-y-2">
              <a href={`mailto:${member.email}`} className="flex items-center gap-3 text-[14px] text-text-muted hover:text-gold transition-colors">
                <Mail size={15} className="text-text-light" />
                {member.email}
              </a>
              {member.website && (
                <a href={member.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[14px] text-text-muted hover:text-gold transition-colors">
                  <Globe size={15} className="text-text-light" />
                  {member.website.replace('https://', '')}
                </a>
              )}
            </div>
          </div>

          {/* Social links */}
          {member.socials && member.socials.length > 0 && (
            <div>
              <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-3">Social</h2>
              <div className="space-y-2">
                {member.socials.map(s => (
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[14px] text-text-muted hover:text-gold transition-colors">
                    <ExternalLink size={14} className="text-text-light" />
                    {s.platform}
                  </a>
                ))}
              </div>
            </div>
          )}
          {/* Team */}
          <div>
            <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-3">Team</h2>
            <div className="space-y-0">
              {TEAM.filter(m => m.id !== member.id).map(m => (
                <Link key={m.id} to={`/profile/${m.id}`} className="flex items-center gap-2.5 py-2 border-b border-border/20 last:border-0 hover:opacity-80 transition-opacity">
                  <div className="w-7 h-7 rounded-full bg-surface-alt border border-border-light text-gold flex items-center justify-center text-[11px] font-bold shrink-0">
                    {m.initial}
                  </div>
                  <span className="text-[13px] text-text-muted tracking-tight">{m.name}</span>
                  <span className="text-[11px] text-text-light ml-auto">{m.role}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
