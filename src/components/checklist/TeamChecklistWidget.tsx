// 2026-05-19 — Team Maintenance Checklist widget on /daily.
//
// User direction: "a 'Check List' This will be different from Tasks
// in that it is a list to ensure by the end of the day / week / month
// that these tasks are taken care of. It is a maintenance list so to
// speak to make sure these things are all done or maintained if they
// are already complete... Visible to the team for everyone to partake
// in ensuring the checklist gets looked at"
//
// Display rules (matches MyTasksCard / AssignmentBoardBody chrome):
//   * inset-panel + divide-theme row stack
//   * Each row: round checkbox · title · "by {Name} · {relTime}" meta
//   * Sections grouped by cadence: Daily → Weekly → Monthly
//   * Admin-only inline "+ Add item" form pinned below the list
//   * Realtime subscription to both maintenance tables so a teammate's
//     check appears immediately on every other open client
//
// State semantics:
//   * `checked_at != null` for the current period → "checked" visual
//   * Toggle: optimistic flip → RPC → realtime echo invalidates cache

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, Check, Edit2, Inbox, Loader2, Plus, Repeat, Trash2, User, Users, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import {
  adminArchiveMaintenanceItem,
  adminCreateMaintenanceItem,
  adminUpdateMaintenanceItem,
  fetchMaintenanceList,
  maintenanceKeys,
  toggleMaintenanceCheck,
  type MaintenanceCadence,
  type MaintenanceClaimType,
  type MaintenanceItem,
} from '../../lib/queries/teamMaintenance'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import MemberAvatar from '../members/MemberAvatar'
import type { TeamMember } from '../../types'

const CADENCE_LABEL: Record<MaintenanceCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

// Section ordering — daily first, then weekly, then monthly. The RPC
// orders rows the same way, but we re-bucket client-side so we can
// render section headers between groups.
const CADENCE_ORDER: readonly MaintenanceCadence[] = ['daily', 'weekly', 'monthly'] as const

function relativeTimeShort(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - then)
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function TeamChecklistWidget() {
  const { profile, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const itemsQuery = useQuery({
    queryKey: maintenanceKeys.list(),
    queryFn: fetchMaintenanceList,
    refetchInterval: 60_000,
    enabled: Boolean(profile?.id),
  })

  // 2026-05-25 (PR B) — active team members for the avatar-checkbox
  // strip on "everyone" items. Cached at the page level via the
  // shared teamMemberKeys.list() query so every widget that lists
  // members reuses the same fetch.
  const membersQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
    enabled: Boolean(profile?.id),
  })
  const activeMembers = useMemo(
    () =>
      (membersQuery.data ?? [])
        .filter((m) => m.display_name && m.status !== 'inactive')
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [membersQuery.data],
  )

  // Realtime — subscribe to BOTH tables so a check-toggle by a
  // teammate updates this widget instantly (no 60s wait). Per-mount
  // channel name keeps the bell dropdown + Overview widget + Tasks
  // page from colliding if they ever mount this in parallel.
  const channelRef = useRef(`team-maintenance:${crypto.randomUUID()}`)
  useEffect(() => {
    if (!profile?.id) return
    const sub = supabase
      .channel(channelRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_maintenance_items' }, () => {
        void queryClient.invalidateQueries({ queryKey: maintenanceKeys.list() })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_maintenance_completions' }, () => {
        void queryClient.invalidateQueries({ queryKey: maintenanceKeys.list() })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(sub)
    }
  }, [profile?.id, queryClient])

  const toggleMutation = useMutation({
    mutationFn: ({ itemId, check }: { itemId: string; check: boolean }) =>
      toggleMaintenanceCheck(itemId, check),
    onMutate: async ({ itemId, check }) => {
      // Optimistic update — flip the caller's entry in the
      // completions array so the check flips instantly. Behavior
      // differs by claim_type:
      //   anyone   + check   → replace completions with [{me}]
      //   anyone   + uncheck → clear completions
      //   everyone + check   → append {me} (de-dupe)
      //   everyone + uncheck → remove {me}
      await queryClient.cancelQueries({ queryKey: maintenanceKeys.list() })
      const previous = queryClient.getQueryData<MaintenanceItem[]>(maintenanceKeys.list())
      queryClient.setQueryData<MaintenanceItem[]>(maintenanceKeys.list(), (curr) => {
        if (!curr) return curr
        const myId = profile?.id
        const myName = profile?.display_name ?? 'You'
        const nowIso = new Date().toISOString()
        return curr.map((row) => {
          if (row.id !== itemId) return row
          if (!myId) return row
          if (check) {
            const meEntry = { checked_by: myId, checked_by_name: myName, checked_at: nowIso }
            const next =
              row.claim_type === 'anyone'
                ? [meEntry]
                : [...row.completions.filter((c) => c.checked_by !== myId), meEntry]
            return { ...row, completions: next }
          }
          // uncheck — drop my entry (anyone-mode: drop everything;
          // simpler than checking who currently owns it since the
          // RPC only allows uncheck of own row).
          const next =
            row.claim_type === 'anyone'
              ? []
              : row.completions.filter((c) => c.checked_by !== myId)
          return { ...row, completions: next }
        })
      })
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(maintenanceKeys.list(), ctx.previous)
      toast(err instanceof Error ? err.message : 'Failed to toggle check', 'error')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: maintenanceKeys.list() })
    },
  })

  // Group items by cadence for sectioned render. Empty buckets are
  // hidden — no "no daily items yet" label clutter.
  const grouped = useMemo(() => {
    const buckets = new Map<MaintenanceCadence, MaintenanceItem[]>()
    for (const k of CADENCE_ORDER) buckets.set(k, [])
    for (const item of itemsQuery.data ?? []) {
      const bucket = buckets.get(item.cadence)
      if (bucket) bucket.push(item)
    }
    return buckets
  }, [itemsQuery.data])

  const totalItems = (itemsQuery.data ?? []).length
  // 2026-05-25 (PR B) — counter treats an item as fully verified
  // when:
  //   anyone   → at least one completion exists
  //   everyone → every active member has a completion
  // Mixed math: members hashed by id so we don't penalize stale rows
  // for inactive teammates.
  const totalChecked = useMemo(() => {
    const activeIds = new Set(activeMembers.map((m) => m.id))
    return (itemsQuery.data ?? []).filter((i) => {
      if (i.claim_type === 'anyone') return i.completions.length > 0
      // everyone: all active members must have a completion
      if (activeIds.size === 0) return false
      const completedIds = new Set(i.completions.map((c) => c.checked_by))
      for (const id of activeIds) if (!completedIds.has(id)) return false
      return true
    }).length
  }, [itemsQuery.data, activeMembers])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Counter strip — mirrors the SubmitBar's prominence on
          MyTasksCard so the widget hierarchy is consistent. */}
      <div className="shrink-0 mb-2 inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl bg-surface-alt/40 border border-border text-[12px] text-text-muted font-semibold">
        <Check size={12} className="text-gold" aria-hidden="true" />
        {totalItems === 0
          ? 'No checklist items yet'
          : `${totalChecked} of ${totalItems} verified`}
      </div>

      {/* List body — same `inset-panel` + `divide-y divide-theme` as
          MyTasksCard for visual parity. */}
      <div className="flex-1 min-h-0 inset-panel">
        <div className="h-full overflow-y-auto divide-y divide-theme">
          {itemsQuery.isLoading ? (
            <div className="h-full flex items-center justify-center text-text-light py-6">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : itemsQuery.error ? (
            <div className="flex items-start gap-2 text-[13px] text-amber-300 px-2 py-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{(itemsQuery.error as Error).message}</span>
            </div>
          ) : totalItems === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-surface-alt ring-1 ring-border mb-2">
                <Inbox size={18} className="text-text-light" aria-hidden="true" />
              </div>
              <p className="text-[14px] font-medium text-text">No maintenance checks yet</p>
              <p className="text-[12px] text-text-light mt-0.5 max-w-[28ch]">
                {isAdmin
                  ? 'Add the first item below — "Cables organized", "Console wiped down"…'
                  : 'An admin will add items here. Check them off as you verify.'}
              </p>
            </div>
          ) : (
            CADENCE_ORDER.map((cadence) => {
              const bucket = grouped.get(cadence) ?? []
              if (bucket.length === 0) return null
              return (
                <SectionGroup
                  key={cadence}
                  cadence={cadence}
                  items={bucket}
                  isAdmin={isAdmin}
                  currentUserId={profile?.id ?? ''}
                  activeMembers={activeMembers}
                  onToggle={(item, check) => toggleMutation.mutate({ itemId: item.id, check })}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Admin-only inline "Add item" form pinned below the list.
          Member view shows nothing (the curated-list spirit means
          members verify; they don't add). */}
      {isAdmin && <AddItemForm />}
    </div>
  )
}

function SectionGroup({
  cadence,
  items,
  isAdmin,
  currentUserId,
  activeMembers,
  onToggle,
}: {
  cadence: MaintenanceCadence
  items: MaintenanceItem[]
  isAdmin: boolean
  currentUserId: string
  activeMembers: TeamMember[]
  onToggle: (item: MaintenanceItem, check: boolean) => void
}) {
  // Section eyebrow — matches the Studio Tasks per-room header style
  // for visual parity.
  return (
    <section>
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-alt/40">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-gold/70">
          {CADENCE_LABEL[cadence]}
        </h3>
        <span className="tabular-nums text-[10px] font-bold text-text-light/70 px-1.5 py-0.5 rounded-full bg-surface ring-1 ring-border">
          {items.length}
        </span>
      </div>
      <div className="divide-y divide-theme">
        {items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            activeMembers={activeMembers}
            onToggle={(check) => onToggle(item, check)}
          />
        ))}
      </div>
    </section>
  )
}

function ChecklistRow({
  item,
  isAdmin,
  currentUserId,
  activeMembers,
  onToggle,
}: {
  item: MaintenanceItem
  isAdmin: boolean
  currentUserId: string
  activeMembers: TeamMember[]
  onToggle: (check: boolean) => void
}) {
  // 2026-05-25 (PR B) — item is "checked" if the caller has a
  // completion. For anyone-items this matches "any completion exists
  // and it's mine". For everyone-items this is "I've ticked my
  // avatar." UI shape splits below.
  const myCompletion = item.completions.find((c) => c.checked_by === currentUserId)
  const checked = !!myCompletion
  // For anyone-items, attribution shows the single (possibly-other-
  // person's) checker. For everyone-items, attribution is per-avatar
  // so this is unused.
  const attribCompletion = item.claim_type === 'anyone' ? item.completions[0] : undefined
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [confirmArchive, setConfirmArchive] = useState(false)
  // 2026-05-23 — inline edit (admin-only). Pencil click swaps the
  // title into an editable input; Enter or Save commits, Esc cancels.
  // Same flow as the daily task list's row-level Edit.
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(item.title)
  const archiveMutation = useMutation({
    mutationFn: () => adminArchiveMaintenanceItem(item.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: maintenanceKeys.list() })
      toast('Item archived.', 'success')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Archive failed', 'error'),
  })
  const editMutation = useMutation({
    mutationFn: () => adminUpdateMaintenanceItem(item.id, { title: editTitle.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: maintenanceKeys.list() })
      toast('Item updated.', 'success')
      setEditing(false)
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  })

  function startEdit() {
    setEditTitle(item.title)
    setEditing(true)
  }

  function cancelEdit() {
    setEditTitle(item.title)
    setEditing(false)
  }

  function submitEdit() {
    const t = editTitle.trim()
    if (!t) {
      toast('Title can\'t be empty', 'error')
      return
    }
    if (t === item.title) {
      setEditing(false)
      return
    }
    editMutation.mutate()
  }

  // ── Anyone-items: existing single-checkbox row + last-claimer
  // attribution. ── Everyone-items: leading "people" icon + the
  // avatar strip lives BELOW the title (so long titles + many
  // members both have room to breathe). The leading checkbox slot
  // gets a Users icon instead of a clickable square.
  const isEveryone = item.claim_type === 'everyone'
  const completedIds = useMemo(
    () => new Set(item.completions.map((c) => c.checked_by)),
    [item.completions],
  )
  const everyoneFullyChecked =
    isEveryone &&
    activeMembers.length > 0 &&
    activeMembers.every((m) => completedIds.has(m.id))

  return (
    <div className="group/maintrow grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-3 py-2 rounded-md hover:bg-surface-hover hover:-translate-y-[1px] hover:shadow-sm transition-all duration-150 ease-out">
      {/* Leading slot — anyone: clickable checkbox. everyone: read-
          only Users icon (each individual avatar in the strip below
          IS the checkbox for that member). */}
      {isEveryone ? (
        <div
          className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-[5px] flex items-center justify-center ${
            everyoneFullyChecked
              ? 'bg-gold/30 ring-1 ring-gold text-gold'
              : 'text-text-light/60'
          }`}
          title="Everyone has to do this"
          aria-label="Everyone item"
        >
          <Users size={11} strokeWidth={2.5} aria-hidden="true" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onToggle(!checked)}
          aria-pressed={checked}
          aria-label={checked ? `Uncheck ${item.title}` : `Mark ${item.title} as verified`}
          className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors ${
            checked
              ? 'bg-gold/30 border-gold text-gold'
              : 'checkbox-empty hover:border-gold/50'
          }`}
        >
          {checked && <Check size={11} strokeWidth={3} aria-hidden="true" />}
        </button>
      )}

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {editing ? (
            <input
              type="text"
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitEdit()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelEdit()
                }
              }}
              onBlur={() => {
                // Treat blur as cancel UNLESS the Save button is the
                // next focus target — handled by Save's onMouseDown
                // firing before blur completes. Simple heuristic that
                // avoids racing against the mutation.
                if (!editMutation.isPending) cancelEdit()
              }}
              className="flex-1 min-w-0 text-[14px] leading-snug bg-surface-alt border border-gold/40 rounded px-1.5 py-0.5 outline-none focus:border-gold"
              aria-label="Edit item title"
            />
          ) : (
            <p
              className={`text-[14px] leading-snug truncate ${
                (isEveryone ? everyoneFullyChecked : checked) ? 'line-through text-text-light' : 'text-text'
              }`}
            >
              {item.title}
            </p>
          )}
          {isEveryone && !editing && (
            <span
              className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-text-light/80 px-1.5 py-0.5 rounded-full bg-surface-alt ring-1 ring-border"
              title="Each team member checks off their own"
            >
              <Users size={9} aria-hidden="true" />
              Everyone
            </span>
          )}
        </div>
        {/* Sub-meta:
              everyone → "X of Y done" + avatar strip beneath
              anyone   → "by Name · time" attribution OR description */}
        {!editing && (
          isEveryone ? (
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-text-muted tabular-nums">
                {item.completions.length} of {activeMembers.length} done
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {activeMembers.map((m) => {
                  const isMine = m.id === currentUserId
                  const memberChecked = completedIds.has(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isMine) return // members only toggle their own
                        onToggle(!memberChecked)
                      }}
                      disabled={!isMine}
                      aria-pressed={memberChecked}
                      aria-label={
                        isMine
                          ? memberChecked
                            ? `Uncheck your completion`
                            : `Mark as done for yourself`
                          : `${m.display_name} ${memberChecked ? 'has' : 'has not'} checked this`
                      }
                      title={
                        isMine
                          ? memberChecked
                            ? 'Uncheck your completion'
                            : 'Mark as done'
                          : `${m.display_name} · ${memberChecked ? 'Done' : 'Pending'}`
                      }
                      className={`relative inline-flex items-center justify-center rounded-full transition-all ${
                        isMine ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                      } ${
                        memberChecked
                          ? 'ring-2 ring-gold'
                          : 'ring-1 ring-border opacity-50 hover:opacity-80'
                      }`}
                    >
                      <MemberAvatar member={m} size="xs" />
                      {memberChecked && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center w-3 h-3 rounded-full bg-gold text-black ring-1 ring-surface"
                          aria-hidden="true"
                        >
                          <Check size={8} strokeWidth={3.5} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : attribCompletion ? (
            <p className="text-[10px] text-text-light mt-0.5">
              by {attribCompletion.checked_by_name ?? 'a teammate'} · {relativeTimeShort(attribCompletion.checked_at)}
            </p>
          ) : item.description ? (
            <p className="text-[10px] text-text-light/80 mt-0.5 truncate">{item.description}</p>
          ) : null
        )}
      </div>

      {/* Right column: admin-only Edit (pencil) + Archive (trash).
          Both hover-revealed at rest, persistent while editing/
          confirming so the action target stays clickable. Edit lives
          BEFORE Archive so the row reads left→right as the safer
          action first, destructive action second. */}
      {isAdmin && (
        <div className="shrink-0 flex items-center gap-0.5">
          {editing ? (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={submitEdit}
                disabled={editMutation.isPending}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white bg-gold hover:brightness-110"
              >
                {editMutation.isPending ? '…' : 'Save'}
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={cancelEdit}
                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-text-light hover:text-text"
              >
                Cancel
              </button>
            </span>
          ) : confirmArchive ? (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white bg-rose-500/80 hover:brightness-110"
              >
                {archiveMutation.isPending ? '…' : 'Delete?'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmArchive(false)}
                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-text-light hover:text-text"
              >
                Keep
              </button>
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={startEdit}
                title="Edit item"
                aria-label="Edit item"
                className="inline-flex items-center justify-center w-6 h-6 rounded text-text-light/50 opacity-0 group-hover/maintrow:opacity-100 hover:text-gold hover:bg-gold/10 transition-all"
              >
                <Edit2 size={12} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmArchive(true)}
                title="Delete item"
                aria-label="Delete item"
                className="inline-flex items-center justify-center w-6 h-6 rounded text-text-light/50 opacity-0 group-hover/maintrow:opacity-100 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function AddItemForm() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [cadence, setCadence] = useState<MaintenanceCadence>('daily')
  // 2026-05-25 (PR B) — claim_type defaults to 'anyone' (the legacy
  // behavior — first checker claims for the team). Admin flips to
  // 'everyone' for items each team member individually owes (e.g.
  // "Drop your media to Dropbox today").
  const [claimType, setClaimType] = useState<MaintenanceClaimType>('anyone')

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateMaintenanceItem({ title: title.trim(), cadence, claim_type: claimType }),
    onSuccess: () => {
      setTitle('')
      setClaimType('anyone')
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: maintenanceKeys.list() })
      toast('Item added.', 'success')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Add failed', 'error'),
  })

  if (!open) {
    return (
      <div className="shrink-0 mt-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl border-2 border-gold-muted bg-gold/12 text-gold text-[13px] font-bold tracking-tight hover:bg-gold/20 hover:border-gold transition-colors focus-ring"
          aria-label="Add a maintenance check item"
        >
          <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
          Add Item
        </button>
      </div>
    )
  }

  return (
    <div className="shrink-0 mt-2 p-3 rounded-xl border border-gold/30 bg-gold/5 space-y-2 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gold">New item</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle('') }}
          className="p-1 rounded text-text-muted hover:text-text"
          aria-label="Cancel"
        >
          <X size={13} />
        </button>
      </div>
      <input
        type="text"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) {
            e.preventDefault()
            createMutation.mutate()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            setOpen(false)
            setTitle('')
          }
        }}
        placeholder="e.g. Cables organized"
        className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[13px] text-text focus:outline-none focus:border-gold/50"
      />
      <div className="flex items-center gap-2 flex-wrap">
        {/* Cadence picker — 3-pill segmented control. */}
        <div className="inline-flex gap-1 rounded-lg bg-surface-alt p-1 ring-1 ring-border">
          {(['daily', 'weekly', 'monthly'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCadence(c)}
              aria-pressed={cadence === c}
              className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${
                cadence === c
                  ? 'bg-gold/20 text-gold ring-1 ring-gold/40'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <Repeat size={10} aria-hidden="true" />
              {CADENCE_LABEL[c]}
            </button>
          ))}
        </div>
        {/* 2026-05-25 (PR B) — Claim-type picker. Anyone = first to
            check claims for the team (cables organized). Everyone =
            each member checks their own avatar (drop your media to
            dropbox). Icons signal the difference at a glance. */}
        <div
          className="inline-flex gap-1 rounded-lg bg-surface-alt p-1 ring-1 ring-border"
          role="radiogroup"
          aria-label="Who does this checklist item?"
        >
          <button
            type="button"
            onClick={() => setClaimType('anyone')}
            aria-pressed={claimType === 'anyone'}
            title="One person checks it off for the whole team"
            className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${
              claimType === 'anyone'
                ? 'bg-gold/20 text-gold ring-1 ring-gold/40'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <User size={10} aria-hidden="true" />
            Anyone
          </button>
          <button
            type="button"
            onClick={() => setClaimType('everyone')}
            aria-pressed={claimType === 'everyone'}
            title="Every team member must check it off individually"
            className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${
              claimType === 'everyone'
                ? 'bg-gold/20 text-gold ring-1 ring-gold/40'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <Users size={10} aria-hidden="true" />
            Everyone
          </button>
        </div>
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !title.trim()}
          className="ml-auto inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-gold text-black text-[12px] font-bold hover:bg-gold-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
        >
          {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
          Add
        </button>
      </div>
    </div>
  )
}

// Unused locally but exported for symmetry with the other Tasks-page
// widget components — keeps the import surface consistent.
export type { MaintenanceItem }
