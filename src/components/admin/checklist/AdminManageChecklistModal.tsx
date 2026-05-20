// 2026-05-19 — Admin "Manage Checklist" modal.
//
// Opens from the +Checklist tile in `AdminAssignWidget` on /admin
// (the admin Hub Assign widget). Lets admins add, rename, change
// cadence on, and archive maintenance items in one focused surface
// (vs the cramped inline +Add form on the /daily widget itself).
//
// Member-visible widget is `<TeamChecklistWidget>` on /daily —
// changes here propagate live via the realtime subscription both
// surfaces share on `team_maintenance_items`.

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, Inbox, Loader2, Plus, Repeat, Trash2, X } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import {
  adminArchiveMaintenanceItem,
  adminCreateMaintenanceItem,
  adminUpdateMaintenanceItem,
  fetchMaintenanceList,
  maintenanceKeys,
  type MaintenanceCadence,
  type MaintenanceItem,
} from '../../../lib/queries/teamMaintenance'

const CADENCE_LABEL: Record<MaintenanceCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

const CADENCE_ORDER: readonly MaintenanceCadence[] = ['daily', 'weekly', 'monthly'] as const

export default function AdminManageChecklistModal({ onClose }: { onClose: () => void }) {
  return (
    <FloatingDetailModal
      title="Checklist"
      eyebrow="Maintenance items — visible to the whole team"
      onClose={onClose}
      maxWidth={620}
    >
      <TeamMaintenanceManager />
    </FloatingDetailModal>
  )
}

/**
 * 2026-05-20 — extracted from AdminManageChecklistModal's body so the
 * exact same manager UI can render inline in the Assign page's
 * left-rail "Checklist" tab. Both surfaces share state via the
 * `maintenanceKeys.list()` React Query cache + the realtime
 * subscription on `<TeamChecklistWidget>` (any open client gets
 * invalidated on writes, so an admin editing here and a member
 * checking on /daily stay in sync live).
 */
export function TeamMaintenanceManager() {
  const { toast } = useToast()
  const itemsQuery = useQuery({
    queryKey: maintenanceKeys.list(),
    queryFn: fetchMaintenanceList,
  })
  const items = itemsQuery.data ?? []

  const grouped = useMemo(() => {
    const buckets = new Map<MaintenanceCadence, MaintenanceItem[]>()
    for (const k of CADENCE_ORDER) buckets.set(k, [])
    for (const item of items) {
      const bucket = buckets.get(item.cadence)
      if (bucket) bucket.push(item)
    }
    return buckets
  }, [items])

  return (
    <div className="flex flex-col gap-4">
      {/* Inline +Add form, pinned to the top so admins can capture
          an item without scrolling past the existing list. */}
      <AddItemSection onAdded={(item) => toast(`Added "${item.title}".`, 'success')} />

      {/* Existing items — grouped by cadence, with inline rename +
          cadence-pill + archive. */}
      {itemsQuery.isLoading ? (
        <div className="py-10 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-text-muted" />
        </div>
      ) : itemsQuery.error ? (
        <div className="flex items-center gap-2 text-[13px] text-amber-300 py-4">
          <AlertCircle size={16} />
          <span>{(itemsQuery.error as Error).message}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-surface-alt ring-1 ring-border mb-2">
            <Inbox size={18} className="text-text-light" aria-hidden="true" />
          </div>
          <p className="text-[14px] font-medium text-text">No checklist items yet</p>
          <p className="text-[12px] text-text-light mt-0.5 max-w-[34ch]">
            Add maintenance checks above — e.g. "Cables organized", "Console wiped down".
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {CADENCE_ORDER.map((cadence) => {
            const bucket = grouped.get(cadence) ?? []
            if (bucket.length === 0) return null
            return (
              <section key={cadence} className="border-b border-border last:border-b-0">
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-alt/40">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-gold/70">
                    {CADENCE_LABEL[cadence]}
                  </h3>
                  <span className="tabular-nums text-[10px] font-bold text-text-light/70 px-1.5 py-0.5 rounded-full bg-surface ring-1 ring-border">
                    {bucket.length}
                  </span>
                </div>
                <div className="divide-y divide-theme">
                  {bucket.map((item) => (
                    <EditableRow key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── +Add form ──────────────────────────────────────────────────────

function AddItemSection({ onAdded }: { onAdded: (item: MaintenanceItem) => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [cadence, setCadence] = useState<MaintenanceCadence>('daily')

  const createMutation = useMutation({
    mutationFn: () => adminCreateMaintenanceItem({ title: title.trim(), cadence }),
    onSuccess: (item) => {
      setTitle('')
      void queryClient.invalidateQueries({ queryKey: maintenanceKeys.list() })
      onAdded(item)
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Add failed', 'error'),
  })

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gold">Add a check</p>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) {
            e.preventDefault()
            createMutation.mutate()
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
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !title.trim()}
          className="ml-auto inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-gold text-black text-[12px] font-bold hover:bg-gold-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
        >
          {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={3} />}
          Add
        </button>
      </div>
    </div>
  )
}

// ─── Existing-item row with inline edit ─────────────────────────────

function EditableRow({ item }: { item: MaintenanceItem }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [cadence, setCadence] = useState<MaintenanceCadence>(item.cadence)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const saveMutation = useMutation({
    mutationFn: () =>
      adminUpdateMaintenanceItem(item.id, {
        title: title.trim() !== item.title ? title.trim() : undefined,
        cadence: cadence !== item.cadence ? cadence : undefined,
      }),
    onSuccess: () => {
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: maintenanceKeys.list() })
      toast('Item updated.', 'success')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  })

  const archiveMutation = useMutation({
    mutationFn: () => adminArchiveMaintenanceItem(item.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: maintenanceKeys.list() })
      toast('Item archived.', 'success')
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Archive failed', 'error'),
  })

  if (editing) {
    return (
      <div className="px-3 py-2.5 bg-gold/5 space-y-2">
        <input
          type="text"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && title.trim()) {
              e.preventDefault()
              saveMutation.mutate()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setEditing(false)
              setTitle(item.title)
              setCadence(item.cadence)
            }
          }}
          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-gold/30 text-[13px] text-text focus:outline-none focus:border-gold/60"
        />
        <div className="flex items-center gap-2 flex-wrap">
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
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setEditing(false); setTitle(item.title); setCadence(item.cadence) }}
              className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium text-text-light hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !title.trim()}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-gold text-black text-[11px] font-bold hover:bg-gold-muted disabled:opacity-50 transition-colors focus-ring"
            >
              {saveMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} strokeWidth={3} />}
              Save
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group/row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-w-0 text-left rounded-md py-0.5 focus-ring"
      >
        <p className="text-[13px] font-semibold text-text truncate">{item.title}</p>
        {item.description && (
          <p className="text-[11px] text-text-light truncate">{item.description}</p>
        )}
      </button>
      <div className="shrink-0 flex items-center gap-1">
        {confirmArchive ? (
          <>
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
              <X size={10} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmArchive(true)}
            title="Archive item"
            aria-label="Archive item"
            className="inline-flex items-center justify-center w-6 h-6 rounded text-text-light/40 opacity-0 group-hover/row:opacity-100 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
