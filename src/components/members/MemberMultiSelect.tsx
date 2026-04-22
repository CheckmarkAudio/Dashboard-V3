import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'

/**
 * MemberMultiSelect — shared checklist for picking one or more team
 * members. Extracted in PR #9 from the Admin Hub's AssignTaskModal so
 * the new TemplateAssignFlowModal on `/admin/templates` can reuse the
 * exact same UX (avoids drift between the two assign surfaces).
 *
 * Pattern: caller owns `selectedIds: Set<string>` + `onToggle(id)`.
 * No internal state, no controlled/uncontrolled split to reason about.
 */

interface MemberMultiSelectProps {
  selectedIds: Set<string>
  onToggle: (id: string) => void
  /** Optional label above the list. Defaults to "Recipients". */
  label?: string
  /** Max height before the list scrolls. Defaults to 12rem (h-48). */
  maxHeightClass?: string
  /** Show position pill on the right. Default true. */
  showPosition?: boolean
  /** Filter out inactive members. Default true. */
  excludeInactive?: boolean
}

export default function MemberMultiSelect({
  selectedIds,
  onToggle,
  label = 'Recipients',
  maxHeightClass = 'max-h-48',
  showPosition = true,
  excludeInactive = true,
}: MemberMultiSelectProps) {
  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const all = teamQuery.data ?? []
  const members = excludeInactive
    ? all.filter((m) => m.status?.toLowerCase() !== 'inactive')
    : all

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-light mb-2">
        {label}
        {selectedIds.size > 0 && (
          <span className="ml-2 text-gold">· {selectedIds.size} selected</span>
        )}
      </p>
      <div
        className={`${maxHeightClass} overflow-y-auto rounded-lg border border-border bg-surface-alt divide-y divide-border`}
      >
        {teamQuery.isLoading ? (
          <p className="px-3 py-4 text-[12px] text-text-light italic">Loading team…</p>
        ) : members.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-text-light italic">No members to select.</p>
        ) : (
          members.map((m) => {
            const active = selectedIds.has(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onToggle(m.id)}
                className={`w-full px-3 py-2 flex items-center gap-3 text-left text-sm transition-colors ${
                  active ? 'bg-gold/10 text-text' : 'text-text-muted hover:bg-surface-hover'
                }`}
              >
                <span
                  className={`shrink-0 w-[18px] h-[18px] rounded-md flex items-center justify-center ${
                    active
                      ? 'bg-gold border border-gold text-black'
                      : 'bg-surface border border-border-light'
                  }`}
                  aria-hidden="true"
                >
                  {active && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="flex-1 truncate">{m.display_name}</span>
                {showPosition && m.position && (
                  <span className="text-[10px] uppercase tracking-wider text-text-light">
                    {m.position}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
