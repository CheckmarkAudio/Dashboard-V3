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
  AlertCircle, Check, Inbox, Loader2, Plus, Repeat, Trash2, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import {
  adminArchiveMaintenanceItem,
  adminCreateMaintenanceItem,
  fetchMaintenanceList,
  maintenanceKeys,
  toggleMaintenanceCheck,
  type MaintenanceCadence,
  type MaintenanceItem,
} from '../../lib/queries/teamMaintenance'

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
      // Optimistic update so the check flips instantly.
      await queryClient.cancelQueries({ queryKey: maintenanceKeys.list() })
      const previous = queryClient.getQueryData<MaintenanceItem[]>(maintenanceKeys.list())
      queryClient.setQueryData<MaintenanceItem[]>(maintenanceKeys.list(), (curr) => {
        if (!curr) return curr
        return curr.map((row) =>
          row.id === itemId
            ? {
                ...row,
                checked_at: check ? new Date().toISOString() : null,
                checked_by: check ? (profile?.id ?? null) : null,
                checked_by_name: check ? (profile?.display_name ?? 'You') : null,
              }
            : row,
        )
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
  const totalChecked = useMemo(
    () => (itemsQuery.data ?? []).filter((i) => i.checked_at !== null).length,
    [itemsQuery.data],
  )

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
  onToggle,
}: {
  cadence: MaintenanceCadence
  items: MaintenanceItem[]
  isAdmin: boolean
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
  onToggle,
}: {
  item: MaintenanceItem
  isAdmin: boolean
  onToggle: (check: boolean) => void
}) {
  const checked = item.checked_at !== null
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [confirmArchive, setConfirmArchive] = useState(false)
  const archiveMutation = useMutation({
    mutationFn: () => adminArchiveMaintenanceItem(item.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: maintenanceKeys.list() })
      toast('Item archived.', 'success')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Archive failed', 'error'),
  })

  return (
    <div className="group/maintrow grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-3 py-2 hover:bg-surface-hover transition-colors">
      {/* Checkbox — flips check state via the toggle RPC. Optimistic
          flip in the parent's mutation keeps it feeling instant. */}
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

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={`text-[14px] leading-snug truncate ${
              checked ? 'line-through text-text-light' : 'text-text'
            }`}
          >
            {item.title}
          </p>
        </div>
        {/* Sub-meta: who verified + when. Falls back to description
            (when present + unchecked) so admins can encode a quick
            "what good looks like" hint. */}
        {checked ? (
          <p className="text-[10px] text-text-light mt-0.5">
            by {item.checked_by_name ?? 'a teammate'} · {relativeTimeShort(item.checked_at)}
          </p>
        ) : item.description ? (
          <p className="text-[10px] text-text-light/80 mt-0.5 truncate">{item.description}</p>
        ) : null}
      </div>

      {/* Right column: admin-only archive (with two-tap confirm). */}
      {isAdmin && (
        <div className="shrink-0 flex items-center">
          {confirmArchive ? (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white bg-rose-500/80 hover:brightness-110"
              >
                {archiveMutation.isPending ? '…' : 'Archive?'}
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
            <button
              type="button"
              onClick={() => setConfirmArchive(true)}
              title="Archive item"
              aria-label="Archive item"
              className="inline-flex items-center justify-center w-5 h-5 rounded text-text-light/40 opacity-0 group-hover/maintrow:opacity-100 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
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

  const createMutation = useMutation({
    mutationFn: () => adminCreateMaintenanceItem({ title: title.trim(), cadence }),
    onSuccess: () => {
      setTitle('')
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
      <div className="flex items-center gap-2">
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
