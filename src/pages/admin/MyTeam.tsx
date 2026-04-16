import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { TEAM } from '../../data/team'
import { ExternalLink, Mail, Globe } from 'lucide-react'

export default function MyTeam() {
  useDocumentTitle('Members - Checkmark Audio')

  const active = TEAM.filter(m => m.status === 'Active')
  const inactive = TEAM.filter(m => m.status === 'Inactive')

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[28px] font-extrabold tracking-tight text-text">Members</h1>
        <span className="text-[12px] text-text-light">{active.length} active · {inactive.length} inactive</span>
      </div>

      {/* Members table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-text-light uppercase tracking-wider">Member</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-text-light uppercase tracking-wider">Position</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-text-light uppercase tracking-wider">Date Joined</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-text-light uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-text-light uppercase tracking-wider">Contact</th>
              </tr>
            </thead>
            <tbody>
              {[...active, ...inactive].map(m => (
                <tr key={m.id} className={`border-b border-border/20 last:border-0 hover:bg-white/[0.02] transition-colors ${m.status === 'Inactive' ? 'opacity-50' : ''}`}>
                  {/* Member: avatar + name */}
                  <td className="px-5 py-3.5">
                    <Link to={`/profile/${m.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                      <div className="w-9 h-9 rounded-full bg-surface-alt border border-border-light text-gold flex items-center justify-center text-[13px] font-bold shrink-0">
                        {m.initial}
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-text tracking-tight">{m.name}</p>
                        <p className="text-[11px] text-text-light">{m.role}</p>
                      </div>
                    </Link>
                  </td>
                  {/* Position tags */}
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1 flex-wrap">
                      {m.positions.map(p => (
                        <span key={p} className="text-[10px] font-semibold text-gold/70 bg-gold/5 border border-gold/15 px-1.5 py-0.5 rounded">{p}</span>
                      ))}
                    </div>
                  </td>
                  {/* Date Joined */}
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] text-text-muted">{m.dateJoined}</span>
                  </td>
                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-[12px] text-text-muted">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${m.status === 'Active' ? 'bg-emerald-400' : 'bg-text-light'}`} />
                      {m.status}
                    </span>
                  </td>
                  {/* Contact */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <a href={`mailto:${m.email}`} className="text-text-light hover:text-gold transition-colors" title={m.email}>
                        <Mail size={14} />
                      </a>
                      {m.website && (
                        <a href={m.website} target="_blank" rel="noopener noreferrer" className="text-text-light hover:text-gold transition-colors" title={m.website}>
                          <Globe size={14} />
                        </a>
                      )}
                      {m.socials?.[0] && (
                        <a href={m.socials[0].url} target="_blank" rel="noopener noreferrer" className="text-text-light hover:text-gold transition-colors" title={m.socials[0].platform}>
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
