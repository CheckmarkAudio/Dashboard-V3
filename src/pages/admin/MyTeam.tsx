import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2, Mail, Phone, Shield, User, Users } from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import { PageHeader } from '../../components/ui'
import type { TeamMember } from '../../types'

/**
 * Admin Members directory — 8-column view sourced from team_members.
 *
 * Columns (approved April 2026): Member · Job Title · Department · Term
 * (start_date – end_date with "present" for indefinite) · Status · Access
 * (derived from role) · Email · Phone.
 *
 * The `department` and `end_date` columns were added to team_members in
 * the same April 2026 migration; free text + autocomplete on edit is
 * planned for TeamManager once this directory is wired. Until admins
 * populate those fields, empty cells render as em-dashes rather than
 * blank space so the table reads as intentional.
 */
export default function MyTeam() {
  useDocumentTitle('Members - Checkmark Workspace')

  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })

  const members: TeamMember[] = teamQuery.data ?? []

  // Active first, inactive last. Unknown/missing status treated as active
  // so a half-populated row still surfaces.
  const active = members.filter((m) => m.status?.toLowerCase() !== 'inactive')
  const inactive = members.filter((m) => m.status?.toLowerCase() === 'inactive')
  const rows = [...active, ...inactive]

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        icon={Users}
        title="Members"
        subtitle="The team — active and past."
        actions={
          <span className="text-caption">
            {active.length} active · {inactive.length} inactive
          </span>
        }
      />

      {teamQuery.isLoading && (
        <div className="widget-card p-10 flex items-center justify-center text-text-light">
          <Loader2 size={18} className="animate-spin mr-2" />
          Loading members…
        </div>
      )}

      {teamQuery.error && (
        <div className="widget-card p-6 flex items-start gap-2 text-amber-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Could not load members</p>
            <p className="text-xs text-text-light mt-0.5">{(teamQuery.error as Error).message}</p>
          </div>
        </div>
      )}

      {!teamQuery.isLoading && !teamQuery.error && rows.length === 0 && (
        <div className="widget-card p-10 text-center">
          <User size={22} className="text-text-light mx-auto mb-2" aria-hidden="true" />
          <p className="text-[13px] text-text-light">No members yet.</p>
        </div>
      )}

      {!teamQuery.isLoading && !teamQuery.error && rows.length > 0 && (
        <div className="widget-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <HeaderCell>Member</HeaderCell>
                  <HeaderCell>Job Title</HeaderCell>
                  <HeaderCell>Department</HeaderCell>
                  <HeaderCell>Term</HeaderCell>
                  <HeaderCell>Status</HeaderCell>
                  <HeaderCell>Access</HeaderCell>
                  <HeaderCell>Contact</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const inactive = m.status?.toLowerCase() === 'inactive'
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors ${inactive ? 'opacity-50' : ''}`}
                    >
                      {/* Member: avatar + name */}
                      <td className="px-5 py-4">
                        <Link to={`/profile/${m.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-surface-alt border-[2px] border-white/12 text-gold flex items-center justify-center text-[14px] font-bold shrink-0">
                            {initialOf(m)}
                          </div>
                          <div>
                            <p className="text-[14px] font-medium text-text tracking-tight">{m.display_name}</p>
                            <p className="text-[11px] text-text-light">{m.email}</p>
                          </div>
                        </Link>
                      </td>
                      {/* Job Title */}
                      <td className="px-5 py-4">
                        <span className="text-[13px] text-text-muted">{m.position || emDash}</span>
                      </td>
                      {/* Department */}
                      <td className="px-5 py-4">
                        <span className="text-[13px] text-text-muted">{m.department || emDash}</span>
                      </td>
                      {/* Term */}
                      <td className="px-5 py-4">
                        <span className="text-[13px] text-text-muted whitespace-nowrap">{formatTerm(m)}</span>
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1.5 text-[12px] text-text-muted">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${inactive ? 'bg-text-light' : 'bg-emerald-400'}`} />
                          {inactive ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      {/* Access */}
                      <td className="px-5 py-4">
                        <AccessBadge role={m.role} />
                      </td>
                      {/* Contact — Email + Phone icons */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {m.email && (
                            <a
                              href={`mailto:${m.email}`}
                              className="text-text-light hover:text-gold transition-colors"
                              title={m.email}
                              aria-label={`Email ${m.display_name}`}
                            >
                              <Mail size={14} />
                            </a>
                          )}
                          {m.phone && (
                            <a
                              href={`tel:${m.phone}`}
                              className="text-text-light hover:text-gold transition-colors"
                              title={m.phone}
                              aria-label={`Call ${m.display_name}`}
                            >
                              <Phone size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────────────────

const emDash = '—'

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 text-left text-label">
      {children}
    </th>
  )
}

function initialOf(m: TeamMember): string {
  return m.display_name?.charAt(0)?.toUpperCase() ?? '?'
}

/**
 * Format a date string (YYYY-MM-DD or ISO) as "Mon D, YYYY". Returns em
 * dash on empty/invalid input so the UI stays aligned.
 */
function formatDate(value?: string | null): string {
  if (!value) return emDash
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return emDash
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Term cell: "Jan 15, 2024 – present" when end_date is absent, otherwise
 * "Jan 15, 2024 – Jun 30, 2024". Returns em dash if no start_date yet.
 */
function formatTerm(m: TeamMember): string {
  const start = m.start_date ? formatDate(m.start_date) : null
  if (!start || start === emDash) return emDash
  const end = m.end_date ? formatDate(m.end_date) : 'present'
  return `${start} – ${end}`
}

/**
 * Access badge: admins + owners render "Admin" in gold; everyone else
 * renders "Standard" in neutral. Keeps permission-role language out of
 * the UI — see `role` vs `position` distinction in README notes.
 */
function AccessBadge({ role }: { role?: string }) {
  const isAdmin = role === 'admin' || role === 'owner'
  if (isAdmin) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded">
        <Shield size={10} aria-hidden="true" />
        Admin
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold text-text-muted bg-surface-alt border border-border px-2 py-0.5 rounded">
      Standard
    </span>
  )
}
