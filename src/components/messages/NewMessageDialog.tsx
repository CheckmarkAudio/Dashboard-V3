// "New message" dialog — start a 1:1 DM or a group thread.
//
// Mirrors CreateChannelDialog's chrome (centered modal, gold primary
// action). The user searches + multi-selects teammates:
//   • exactly 1 selected → find_or_create_dm (idempotent 1:1)
//   • 2+ selected        → create_group_dm (+ optional title)
// On success it hands the resulting channel_id back to the caller, which
// navigates into the Forum DM view.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2, Search, Users, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import { createGroupDm, findOrCreateDm } from '../../lib/queries/dms'
import MemberAvatar from '../members/MemberAvatar'
import { useToast } from '../Toast'

interface NewMessageDialogProps {
  onClose: () => void
  /** Called with the DM/group channel_id once it's opened/created. */
  onCreated: (channelId: string) => void
}

export default function NewMessageDialog({ onClose, onCreated }: NewMessageDialogProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const teamQuery = useQuery({ queryKey: teamMemberKeys.list(), queryFn: fetchTeamMembers })

  // Selectable = active members other than me.
  const candidates = useMemo(() => {
    const all = (teamQuery.data ?? []).filter(
      (m) => m.id !== profile?.id && m.status?.toLowerCase() !== 'inactive',
    )
    const q = search.trim().toLowerCase()
    const filtered = q ? all.filter((m) => m.display_name.toLowerCase().includes(q)) : all
    return [...filtered].sort((a, b) => a.display_name.localeCompare(b.display_name))
  }, [teamQuery.data, profile?.id, search])

  const selectedMembers = useMemo(
    () => (teamQuery.data ?? []).filter((m) => selected.includes(m.id)),
    [teamQuery.data, selected],
  )

  const isGroup = selected.length > 1
  const canSubmit = selected.length >= 1 && !submitting

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const channelId = isGroup
        ? await createGroupDm(selected, title.trim() || null)
        : await findOrCreateDm(selected[0]!)
      onCreated(channelId)
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start the conversation', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-message-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4 bg-surface rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-gold" aria-hidden="true" />
            <h2 id="new-message-title" className="text-[14px] font-bold text-text">New message</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-ring"
          >
            <X size={14} />
          </button>
        </header>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Selected chips */}
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-gold/12 border border-gold/25 text-[12px] font-medium text-text hover:bg-gold/20 transition-colors"
                  title={`Remove ${m.display_name}`}
                >
                  <MemberAvatar member={m} size="xs" />
                  {m.display_name.split(' ')[0]}
                  <X size={11} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {/* Group title (only when 2+ selected) */}
          {isGroup && (
            <div className="space-y-1.5">
              <label htmlFor="group-title" className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Group name (optional)
              </label>
              <input
                id="group-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mix Crew"
                maxLength={80}
                className="w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-[13px] text-text placeholder:text-text-light focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
          )}

          {/* Member search */}
          <div className="space-y-1.5">
            <label htmlFor="member-search" className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              To
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light" aria-hidden="true" />
              <input
                id="member-search"
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teammates…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-alt border border-border text-[13px] text-text placeholder:text-text-light focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
          </div>

          {/* Member list */}
          <div className="space-y-0.5 max-h-[260px] overflow-y-auto -mx-1">
            {teamQuery.isLoading && (
              <p className="text-[12px] text-text-light px-1 py-2">Loading teammates…</p>
            )}
            {!teamQuery.isLoading && candidates.length === 0 && (
              <p className="text-[12px] text-text-light px-1 py-2">No teammates match “{search}”.</p>
            )}
            {candidates.map((m) => {
              const isSel = selected.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg text-left transition-colors ${
                    isSel ? 'bg-gold/10' : 'hover:bg-surface-hover'
                  }`}
                >
                  <MemberAvatar member={m} size="sm" />
                  <span className="flex-1 min-w-0 text-[13px] font-medium text-text truncate">{m.display_name}</span>
                  <span
                    className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-[5px] border transition-colors ${
                      isSel ? 'bg-gold border-gold text-black' : 'border-border text-transparent'
                    }`}
                    aria-hidden="true"
                  >
                    <Check size={11} strokeWidth={3} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-surface-alt/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-2 rounded-lg text-[12px] font-semibold text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-black text-[12px] font-bold hover:bg-gold-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
            {isGroup ? 'Start group' : 'Message'}
          </button>
        </footer>
      </div>
    </div>
  )
}
