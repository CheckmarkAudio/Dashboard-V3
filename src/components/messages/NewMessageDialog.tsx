// "New message" dialog — two distinct modes:
//
//   • direct (default) — click a single teammate and you're routed
//     straight into that 1:1 DM (find_or_create_dm). No confirm step.
//   • group — opened via the "New group" toggle; multi-select teammates
//     + optional title, then "Start group" (create_group_dm).
//
// Chrome mirrors CreateChannelDialog (centered modal, gold primary).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Loader2, Search, Users, X } from 'lucide-react'
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
  const [mode, setMode] = useState<'direct' | 'group'>('direct')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Direct mode: the member row currently being opened (spinner + lock).
  const [busyId, setBusyId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [mode])
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

  // ── direct mode — click a teammate → open the 1:1 immediately ──
  const openDirect = async (memberId: string) => {
    if (busyId) return
    setBusyId(memberId)
    try {
      const channelId = await findOrCreateDm(memberId)
      onCreated(channelId)
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open the conversation', 'error')
      setBusyId(null)
    }
  }

  // ── group mode — multi-select then create ──
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const canStartGroup = selected.length >= 2 && !submitting

  const startGroup = async () => {
    if (!canStartGroup) return
    setSubmitting(true)
    try {
      const channelId = await createGroupDm(selected, title.trim() || null)
      onCreated(channelId)
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start the group', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const enterGroupMode = () => {
    setMode('group')
    setSearch('')
  }
  const backToDirect = () => {
    setMode('direct')
    setSelected([])
    setTitle('')
    setSearch('')
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
          <div className="flex items-center gap-2 min-w-0">
            {mode === 'group' && (
              <button
                type="button"
                onClick={backToDirect}
                aria-label="Back to direct message"
                className="p-1 -ml-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-ring"
              >
                <ArrowLeft size={15} aria-hidden="true" />
              </button>
            )}
            <Users size={14} className="text-gold shrink-0" aria-hidden="true" />
            <h2 id="new-message-title" className="text-[14px] font-bold text-text truncate">
              {mode === 'group' ? 'New group' : 'New message'}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {mode === 'direct' && (
              <button
                type="button"
                onClick={enterGroupMode}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-gold hover:bg-gold/10 transition-colors focus-ring"
              >
                <Users size={12} strokeWidth={2.5} aria-hidden="true" />
                New group
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-ring"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Group: selected chips + title */}
          {mode === 'group' && selectedMembers.length > 0 && (
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

          {mode === 'group' && (
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
              {mode === 'group' ? 'Add people' : 'Message'}
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
            {mode === 'direct' && (
              <p className="text-[11px] text-text-light">Tap a teammate to open the conversation.</p>
            )}
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
              if (mode === 'direct') {
                const isBusy = busyId === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => void openDirect(m.id)}
                    className="w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg text-left transition-colors hover:bg-surface-hover disabled:opacity-60 disabled:cursor-default"
                  >
                    <MemberAvatar member={m} size="sm" />
                    <span className="flex-1 min-w-0 text-[13px] font-medium text-text truncate">{m.display_name}</span>
                    {isBusy && <Loader2 size={14} className="shrink-0 animate-spin text-gold" aria-hidden="true" />}
                  </button>
                )
              }
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

        {/* Footer — only the group flow needs a confirm button; direct
            mode commits on row click. */}
        {mode === 'group' && (
          <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-surface-alt/30 shrink-0">
            <span className="text-[11px] text-text-light">
              {selected.length < 2 ? 'Pick at least 2 people' : `${selected.length} selected`}
            </span>
            <div className="flex items-center gap-2">
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
                onClick={() => void startGroup()}
                disabled={!canStartGroup}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-black text-[12px] font-bold hover:bg-gold-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
              >
                {submitting ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
                Start group
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
