import { useMemo } from 'react'
import { CalendarCheck2, ClipboardCheck, Clock3, Loader2, Trophy } from 'lucide-react'
import { useMemberStats } from '../../lib/queries/memberProfile'
import type { TeamMember } from '../../types'

/**
 * Stats sidebar shown to the right of a profile's main column.
 *
 * Renders three primary stats:
 *   - Member since (derived from team_members.created_at)
 *   - Sessions this month (live count from sessions table)
 *   - Tasks completed this week (live count from assigned_tasks)
 *
 * Plus a placeholder Achievements row that becomes real in Tier 2.
 *
 * Stats query lives behind react-query so cache is shared with any
 * future surface that wants the same numbers.
 */

interface StatsSidebarProps {
  member: TeamMember
}

export default function StatsSidebar({ member }: StatsSidebarProps) {
  const stats = useMemberStats(member.id)

  const memberSince = useMemo(() => {
    if (!member.created_at) return null
    const created = new Date(member.created_at)
    if (Number.isNaN(created.getTime())) return null
    const month = created.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)))
    let tenure: string
    if (days < 30) tenure = `${days} day${days === 1 ? '' : 's'}`
    else if (days < 365) {
      const months = Math.floor(days / 30)
      tenure = `${months} month${months === 1 ? '' : 's'}`
    } else {
      const years = Math.floor(days / 365)
      const remMonths = Math.floor((days % 365) / 30)
      tenure = remMonths === 0
        ? `${years} year${years === 1 ? '' : 's'}`
        : `${years}y ${remMonths}mo`
    }
    return { month, tenure }
  }, [member.created_at])

  return (
    <aside className="space-y-4">
      {/* Stats card */}
      <div className="rounded-xl border border-border bg-surface-alt/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-alt/60">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-text-light">
            Stats
          </p>
        </div>
        <ul className="divide-y divide-border/40">
          {memberSince && (
            <StatRow
              icon={<Clock3 size={14} className="text-text-light" aria-hidden="true" />}
              label="Member since"
              value={memberSince.month}
              subValue={memberSince.tenure}
            />
          )}
          <StatRow
            icon={<CalendarCheck2 size={14} className="text-text-light" aria-hidden="true" />}
            label="Sessions this month"
            value={
              stats.isLoading ? <InlineSpinner /> :
              stats.error ? '—' :
              String(stats.data?.sessionsThisMonth ?? 0)
            }
          />
          <StatRow
            icon={<ClipboardCheck size={14} className="text-text-light" aria-hidden="true" />}
            label="Tasks done · 7d"
            value={
              stats.isLoading ? <InlineSpinner /> :
              stats.error ? '—' :
              String(stats.data?.tasksCompletedThisWeek ?? 0)
            }
          />
        </ul>
      </div>

      {/* Achievements placeholder (real in Tier 2). Showing the shape
          now so the layout reads as "this is intentional" instead of
          "missing section." */}
      <div className="rounded-xl border border-border border-dashed bg-surface-alt/20 px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Trophy size={14} className="text-gold/60" aria-hidden="true" />
          <p className="text-[11px] font-semibold tracking-wider uppercase text-text-light">
            Achievements
          </p>
        </div>
        <p className="text-[12px] text-text-light italic">
          Coming soon — first booking, 100 tasks, anniversaries, and more.
        </p>
      </div>
    </aside>
  )
}

// ─── Bits ─────────────────────────────────────────────────────────

function StatRow({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  subValue?: string
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-text-muted">{label}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[13px] font-semibold text-text tabular-nums">{value}</p>
        {subValue && (
          <p className="text-[10px] text-text-light tabular-nums">{subValue}</p>
        )}
      </div>
    </li>
  )
}

function InlineSpinner() {
  return (
    <span className="inline-flex">
      <Loader2 size={11} className="animate-spin text-text-light" aria-hidden="true" />
    </span>
  )
}
