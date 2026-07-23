import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Plus, Search, Users } from 'lucide-react'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import MemberAvatar from './MemberAvatar'

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName
}

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
  /** Compact horizontal chips for modal headers. Default is list. */
  layout?: 'list' | 'chips'
}

export default function MemberMultiSelect({
  selectedIds,
  onToggle,
  label = 'Recipients',
  maxHeightClass = 'max-h-48',
  showPosition = true,
  excludeInactive = true,
  layout = 'list',
}: MemberMultiSelectProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const all = teamQuery.data ?? []
  const members = excludeInactive
    ? all.filter((m) => m.status?.toLowerCase() !== 'inactive')
    : all

  if (layout === 'chips') {
    const selectedMembers = members.filter((member) => selectedIds.has(member.id))
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const filteredMembers = normalizedSearch
      ? members.filter((member) =>
          `${member.display_name} ${member.position ?? ''}`
            .toLowerCase()
            .includes(normalizedSearch),
        )
      : members
    const selectedSummary =
      selectedMembers.length === 0
        ? 'Choose people'
        : selectedMembers.length <= 2
          ? selectedMembers.map((member) => firstName(member.display_name)).join(', ')
          : `${firstName(selectedMembers[0]!.display_name)} +${selectedMembers.length - 1}`

    return (
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light mb-1.5">
          {label}
          {selectedIds.size > 0 && (
            <span className="ml-2 text-gold">· {selectedIds.size} selected</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-surface border border-border text-left hover:bg-surface-hover transition-colors focus-ring"
        >
          <span className="min-w-0 flex items-center gap-2.5">
            {selectedMembers.length > 0 ? (
              <span className="flex shrink-0 -space-x-2">
                {selectedMembers.slice(0, 3).map((member) => (
                  <MemberAvatar
                    key={member.id}
                    member={member}
                    size="sm"
                    alt=""
                    className="ring-2 ring-surface"
                  />
                ))}
              </span>
            ) : (
              <span className="w-7 h-7 rounded-full bg-surface-alt border border-border flex items-center justify-center text-text-muted">
                <Users size={14} aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-bold text-text">
                {selectedSummary}
              </span>
              <span className="block text-[10px] text-text-light">
                {selectedMembers.length === 0
                  ? 'Select one or more teammates'
                  : `${selectedMembers.length} assigned`}
              </span>
            </span>
          </span>
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-text-muted">
            <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
            {selectedMembers.length === 0 ? 'Add' : 'Change'}
          </span>
        </button>

        {pickerOpen && (
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_10px_24px_rgba(20,20,20,0.12)]">
            <div className="p-2 border-b border-border">
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-surface-alt border border-border">
                <Search size={13} className="shrink-0 text-text-light" aria-hidden="true" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search people"
                  className="w-full min-w-0 bg-transparent text-[12px] text-text placeholder:text-text-light outline-none"
                />
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto p-1.5">
            {teamQuery.isLoading ? (
              <p className="px-2 py-3 text-[12px] text-text-light italic">Loading team…</p>
            ) : filteredMembers.length === 0 ? (
              <p className="px-2 py-3 text-[12px] text-text-light italic">
                No members available.
              </p>
            ) : (
              filteredMembers.map((member) => {
                const active = selectedIds.has(member.id)
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => onToggle(member.id)}
                    aria-pressed={active}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                      active
                        ? 'bg-[#e2e2de] dark:bg-white/10 text-text'
                        : 'text-text-muted hover:text-text hover:bg-surface-hover'
                    }`}
                  >
                    <span className="relative shrink-0">
                      <MemberAvatar member={member} size="sm" alt="" />
                      {active && (
                        <span
                          className="absolute inset-0 rounded-full bg-[#3f403e]/80 flex items-center justify-center text-white ring-2 ring-white/80"
                          aria-hidden="true"
                        >
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-bold">
                        {firstName(member.display_name)}
                      </span>
                      {member.position && (
                        <span className="block truncate text-[10px] text-text-light">
                          {member.position}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })
            )}
            </div>

            <div className="p-2 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-[#3f403e] text-white text-[11px] font-bold hover:bg-[#30312f] transition-colors"
              >
                Done
              </button>
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
                aria-pressed={active}
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
