import { useQuery } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import MemberAvatar from './MemberAvatar'

/**
 * MemberMultiSelect — shared checklist for picking one or more team
 * members. Extracted in PR #9 from the Admin Hub's AssignTaskModal so
 * the new TemplateAssignFlowModal on `/admin/templates` can reuse the
 * exact same UX (avoids drift between the two assign surfaces).
 *
 * Pattern: caller owns `selectedIds: Set<string>` + `onToggle(id)`.
 * No internal state, no controlled/uncontrolled split to reason about.
 *
 * `variant="grid"` (2026-07-11, task-popup redesign) renders photo
 * cards instead of list rows — opt-in so the four existing list-style
 * callers are untouched. New callers can pick whichever fits their
 * layout.
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
  /** 'list' (default, existing look) or 'grid' (photo cards). */
  variant?: 'list' | 'grid'
}

export default function MemberMultiSelect({
  selectedIds,
  onToggle,
  label = 'Recipients',
  maxHeightClass = 'max-h-48',
  showPosition = true,
  excludeInactive = true,
  variant = 'list',
}: MemberMultiSelectProps) {
  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const all = teamQuery.data ?? []
  const members = excludeInactive
    ? all.filter((m) => m.status?.toLowerCase() !== 'inactive')
    : all

  const countSuffix = selectedIds.size > 0 && (
    <span className="ml-2 text-gold">· {selectedIds.size} selected</span>
  )

  if (variant === 'grid') {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-light mb-2">
          {label}
          {countSuffix}
        </p>
        {teamQuery.isLoading ? (
          <p className="px-3 py-4 text-[12px] text-text-light italic">Loading team…</p>
        ) : members.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-text-light italic">No members to select.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {members.map((m) => {
              const active = selectedIds.has(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onToggle(m.id)}
                  aria-pressed={active}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left transition-colors focus-ring ${
                    active
                      ? 'border-gold bg-gold/10'
                      : 'border-border bg-surface-alt/50 hover:border-gold/40 hover:bg-surface-hover'
                  }`}
                >
                  <MemberAvatar member={m} size="md" className="shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-text truncate">
                      {m.display_name}
                    </span>
                    {m.position && (
                      <span className="block text-[11px] text-text-light truncate">
                        {m.position.replace(/_/g, ' ')}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
            {/* Decorative parity with the reference mockup — every real
                member already has a card above (small teams fit on
                screen without a search field), so this communicates
                "that's everyone" rather than opening a picker. */}
            <div
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-dashed border-border text-text-light"
              aria-hidden="true"
            >
              <Plus size={16} />
              <span className="text-[12px] font-medium">That's everyone</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-light mb-2">
        {label}
        {countSuffix}
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
                  className={`shrink-0 w-[18px] h-[18px] rounded-md border-[1.5px] flex items-center justify-center transition-colors ${
                    active
                      ? 'bg-gold border-gold text-black'
                      : 'checkbox-empty'
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
