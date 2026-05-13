import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowRightLeft, Check, Inbox, Loader2, Plus } from 'lucide-react'
import TaskRequestModal from './requests/TaskRequestModal'
import { useAuth } from '../../contexts/AuthContext'
import {
  completeAssignedTask,
  fetchStudioAssignedTasks,
  fetchTeamAssignedTasks,
} from '../../lib/queries/assignments'
import {
  cancelTaskReassignment,
  fetchMyOutgoingPendingReassignRequests,
  requestTaskReassignment,
  taskReassignKeys,
} from '../../lib/queries/taskReassign'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import { supabase } from '../../lib/supabase'
import type { AssignedTask } from '../../types/assignments'
import type { TeamMember } from '../../types'
import {
  CompletedToggle,
  SubmitBar,
  formatDueShort,
  formatShortName,
  rolePositionFor,
} from './shared'

// These boards are ONLY rendered inside a `DashboardWidgetFrame`
// (studio_tasks / team_board widget slots on the /daily Tasks page).
// The frame already provides the widget-card chrome + title +
// description, so we render body-only here — no inner Card wrapper,
// no duplicate heading. Previously both rendered their own chrome
// which created a visible "double box" (outer widget card + inner
// widget-style card with a bolder heading inside it).

export function TeamAssignedTasksCard() {
  return (
    <AssignmentBoardBody
      emptyTitle="No team tasks"
      emptyBody="Once team-task reads are wired, everyone will show up here."
      queryKeyPrefix="team-assigned-tasks"
      queryFn={fetchTeamAssignedTasks}
    />
  )
}

export function StudioAssignedTasksCard() {
  return (
    <AssignmentBoardBody
      emptyTitle="No studio tasks yet"
      emptyBody="Add room-tagged tasks from Assign → Studio. They'll group here under Control Room · Studio A · Studio B."
      queryKeyPrefix="studio-assigned-tasks"
      queryFn={fetchStudioAssignedTasks}
      sectionedByStudioSpace
    />
  )
}

// PR #102 follow-up — Studio variant on /daily groups visible rows
// under per-room section headers (Control Room · Studio A · Studio B
// + an optional "(no space set)" bucket for legacy untagged rows),
// matching the admin Studio pane. Team Board passes nothing here and
// renders the flat list as before.
const STUDIO_SECTION_KEYS = ['Control Room', 'Studio A', 'Studio B'] as const
const NO_SPACE_KEY = '__no_space__'

function AssignmentBoardBody({
  emptyTitle,
  emptyBody,
  queryKeyPrefix,
  queryFn,
  sectionedByStudioSpace = false,
}: {
  emptyTitle: string
  emptyBody: string
  queryKeyPrefix: string
  queryFn: (userId: string, opts?: { includeCompleted?: boolean }) => Promise<AssignedTask[]>
  sectionedByStudioSpace?: boolean
}) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [showCompleted, setShowCompleted] = useState(false)
  // 2026-05-13 — Studio Tasks widget gets the same "+ New Task"
  // affordance as MyTasksCard (member-side request flow). Only
  // mounted on the Studio variant so the Team Board doesn't sprout
  // a request CTA it doesn't yet support.
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const cacheKey = [queryKeyPrefix, profile?.id ?? 'none', showCompleted ? 'all' : 'open'] as const

  // PR #69 — team_members lookup so each row can show the assignee's
  // role tag. Same cache key the rest of the app uses; deduped.
  const membersQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
  })
  const memberMap = useMemo(() => {
    const m = new Map<string, TeamMember>()
    for (const member of membersQuery.data ?? []) m.set(member.id, member)
    return m
  }, [membersQuery.data])

  const tasksQuery = useQuery({
    queryKey: cacheKey,
    queryFn: () => queryFn(profile!.id, { includeCompleted: true }),
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
  })

  // 2026-05-02 — realtime sync. MyTasksCard already had a per-user
  // subscription; the team + studio boards relied on the 60s
  // refetchInterval, which let an admin's delete-from-AssignAdmin
  // sit stale for up to a minute on every other open client.
  // Listen to ALL DML on assigned_tasks (no filter — both boards
  // show team-wide rows, so any change can affect the visible
  // list) and invalidate the cache. Requires assigned_tasks to be
  // in supabase_realtime publication with REPLICA IDENTITY FULL —
  // shipped in migration 20260502180000_realtime_task_sync.sql.
  const realtimeTopicRef = useRef(`board-${queryKeyPrefix}-${crypto.randomUUID()}`)
  useEffect(() => {
    if (!profile?.id) return
    const sub = supabase
      .channel(realtimeTopicRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assigned_tasks' },
        () => {
          void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, profile.id] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(sub)
    }
  }, [profile?.id, queryClient, queryKeyPrefix])

  // PR #37 — pending → Submit pattern. Checking a row adds its id to
  // `pendingIds`; Submit Completed commits all queued toggles at once.
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())

  const togglePending = (taskId: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
    // Tapping any non-swap row also folds an open swap drawer — keeps
    // the list visually quiet (only one row open at a time, period).
    closeExpand()
  }

  const submitMutation = useMutation({
    mutationFn: async (toggles: { taskId: string; next: boolean }[]) => {
      await Promise.all(
        toggles.map((t) => completeAssignedTask(t.taskId, t.next)),
      )
    },
    onSuccess: () => {
      setPendingIds(new Set())
      void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, profile?.id ?? 'none'] })
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks', profile?.id ?? 'none'] })
    },
  })

  // PR #38 → 2026-05-06 redesign. Originally a hover overlay fired
  // `requestTaskReassignment` directly and we tracked "did I request
  // this?" in a local Set. The new flow is a NotificationsPanel-style
  // click-to-expand inline drawer:
  //   1) click row → "Request to take this task?" + Submit
  //   2) Submit → fires RPC; row keeps a visible pending marker
  //   3) click pending row → "Cancel task swap?" + Submit
  //   4) Submit → fires cancel RPC; pending marker drops
  // Single-tap submit on each step (no two-step confirm) — cancel is
  // a one-tap revert anyway, so a "type to commit" gate is overkill.
  // Pending state comes from get_my_outgoing_pending_reassign_requests
  // so it survives reload + matches the source of truth (and gives us
  // the request id we need to cancel). Only one drawer is open at a
  // time across the whole list (clicking another row folds the prev).
  const outgoingPendingQuery = useQuery({
    queryKey: taskReassignKeys.outgoing(),
    queryFn: fetchMyOutgoingPendingReassignRequests,
    enabled: Boolean(profile?.id),
    staleTime: 30_000,
  })
  const pendingByTaskId = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of outgoingPendingQuery.data ?? []) {
      if (r.direction === 'take') m.set(r.task_id, r.id)
    }
    return m
  }, [outgoingPendingQuery.data])

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  // Optional "why are you taking this?" note. Lives at the parent so
  // it survives a re-render. Reset whenever the drawer closes or
  // jumps to a new row.
  const [noteText, setNoteText] = useState('')

  const closeExpand = () => {
    setExpandedTaskId(null)
    setNoteText('')
  }
  // Toggle helper: clicking the open row closes; clicking another row
  // folds the prev + opens the new one (note resets either way).
  const openRow = (taskId: string) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId))
    setNoteText('')
  }

  const reassignMutation = useMutation({
    mutationFn: ({ taskId, note }: { taskId: string; note: string | null }) =>
      requestTaskReassignment(taskId, note),
    onSuccess: () => {
      closeExpand()
      void queryClient.invalidateQueries({ queryKey: taskReassignKeys.outgoing() })
    },
  })
  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => cancelTaskReassignment(requestId),
    onSuccess: () => {
      closeExpand()
      void queryClient.invalidateQueries({ queryKey: taskReassignKeys.outgoing() })
      void queryClient.invalidateQueries({ queryKey: taskReassignKeys.incoming() })
    },
  })

  const visibleTasks = useMemo(() => {
    const tasks = tasksQuery.data ?? []
    const openFiltered = showCompleted ? tasks : tasks.filter((task) => !task.is_completed)
    return [...openFiltered].sort((a, b) => {
      const aDue = a.due_date ?? '9999-12-31'
      const bDue = b.due_date ?? '9999-12-31'
      if (aDue !== bDue) return aDue.localeCompare(bDue)
      return a.title.localeCompare(b.title)
    })
  }, [showCompleted, tasksQuery.data])

  // For the Studio Tasks widget: group visible tasks by studio_space.
  // Sections render in a fixed order (Control Room · Studio A · Studio B)
  // followed by a backfill bucket for any rows still without a tag.
  // Empty sections are HIDDEN here (different from the admin pane —
  // the /daily widget is space-constrained and shouldn't waste rows
  // on "no tasks yet" labels per room).
  const sectionedVisibleTasks = useMemo(() => {
    if (!sectionedByStudioSpace) return null
    const buckets = new Map<string, AssignedTask[]>()
    for (const key of STUDIO_SECTION_KEYS) buckets.set(key, [])
    buckets.set(NO_SPACE_KEY, [])
    for (const t of visibleTasks) {
      const key = (t.studio_space ?? NO_SPACE_KEY) as string
      const bucket = buckets.get(key) ?? buckets.get(NO_SPACE_KEY)!
      bucket.push(t)
    }
    return buckets
  }, [sectionedByStudioSpace, visibleTasks])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Skin pass 2026-05-06 — toolbar moved from BOTTOM to TOP per
          user direction (matches the MyTasksCard treatment). Submit
          Completed bar + show-completed eye live above the data list
          so the actions are reachable without scrolling. */}
      <div className="shrink-0 space-y-1.5 mb-2">
        <SubmitBar
          count={pendingIds.size}
          isSubmitting={submitMutation.isPending}
          onClick={() => {
            if (pendingIds.size === 0) return
            const tasks = tasksQuery.data ?? []
            const toggles = Array.from(pendingIds).map((id) => {
              const t = tasks.find((x) => x.id === id)
              return { taskId: id, next: !(t?.is_completed ?? false) }
            })
            submitMutation.mutate(toggles)
          }}
        />
        {/* 2026-05-13 — Studio variant: +New Task = outlined gold
            (creation), distinct from SubmitBar = filled gold
            (commit). Mirrors MyTasksCard's two-button hierarchy
            so members never confuse "make a new task" with
            "commit my checked work." */}
        {sectionedByStudioSpace && (
          <button
            type="button"
            onClick={() => setRequestModalOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl border-2 border-gold-muted bg-gold/12 text-gold text-[13px] font-bold tracking-tight hover:bg-gold/20 hover:border-gold transition-colors focus-ring"
            aria-label="Request a new studio task"
          >
            <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
            New Task
          </button>
        )}
      </div>

      {/* PR #69 — `Due` column header anchors the right-side date so
          users know it's the due date, not assignment date. Stage
          filter (PR #36) deferred to the flywheel-event-ledger PR.
          2026-05-13 — show-completed eye lives in the left slot
          here (was its own row in the toolbar above). One row
          recovered, no functional change. */}
      <div className="shrink-0 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5 px-2 mb-1 items-center">
        <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((value) => !value)} />
        <span aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-gold/70 whitespace-nowrap">Due</span>
      </div>

      {/* Skin pass 2026-05-06 — booking-style nesting for parity with
          MyTasksCard. Wrap scrollable list in `.inset-panel` so row
          dividers clip cleanly at the panel border; inner scroller
          uses `divide-y divide-theme` for needle-thin row hairlines.
          Per-row card chrome (rounded-[14px] border bg-white/[…])
          dropped in TeamTaskRow below — flat rows + bg-tinted state
          via theme-aware tokens. Section headers in the studio
          variant render between divider groups so each room reads
          as its own grouping. */}
      <div className="flex-1 min-h-0 inset-panel">
        <div className="h-full overflow-y-auto divide-y divide-theme">
        {tasksQuery.isLoading ? (
          <div className="h-full flex items-center justify-center text-text-light py-6">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : tasksQuery.error ? (
          <div className="flex items-start gap-2 text-[13px] text-amber-300 px-2 py-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{(tasksQuery.error as Error).message}</span>
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-6">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-surface-alt ring-1 ring-border mb-2">
              <Inbox size={18} className="text-text-light" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-medium text-text">{emptyTitle}</p>
            <p className="text-[12px] text-text-light mt-0.5 max-w-[28ch]">{emptyBody}</p>
          </div>
        ) : sectionedVisibleTasks ? (
          // Studio variant — render each non-empty section with a
          // header + per-section row list.
          <>
            {/* Backfill bucket first so admins notice untagged rows. */}
            {(sectionedVisibleTasks.get(NO_SPACE_KEY) ?? []).length > 0 && (
              <SectionedRows
                label="No space set"
                labelDim
                tasks={sectionedVisibleTasks.get(NO_SPACE_KEY) ?? []}
                pendingIds={pendingIds}
                pendingByTaskId={pendingByTaskId}
                expandedTaskId={expandedTaskId}
                noteText={noteText}
                onNoteChange={setNoteText}
                togglePending={togglePending}
                onToggleExpand={openRow}
                onSubmitTake={(id) =>
                  reassignMutation.mutate({ taskId: id, note: noteText.trim() ? noteText.trim() : null })
                }
                onSubmitCancel={(reqId) => cancelMutation.mutate(reqId)}
                isMutating={reassignMutation.isPending || cancelMutation.isPending}
                submitMutationPending={submitMutation.isPending}
                memberMap={memberMap}
                profileId={profile?.id ?? null}
              />
            )}
            {STUDIO_SECTION_KEYS.map((key) => {
              const bucket = sectionedVisibleTasks.get(key) ?? []
              if (bucket.length === 0) return null
              return (
                <SectionedRows
                  key={key}
                  label={key}
                  tasks={bucket}
                  pendingIds={pendingIds}
                  pendingByTaskId={pendingByTaskId}
                  expandedTaskId={expandedTaskId}
                  noteText={noteText}
                  onNoteChange={setNoteText}
                  togglePending={togglePending}
                  onToggleExpand={openRow}
                  onSubmitTake={(id) =>
                    reassignMutation.mutate({ taskId: id, note: noteText.trim() ? noteText.trim() : null })
                  }
                  onSubmitCancel={(reqId) => cancelMutation.mutate(reqId)}
                  isMutating={reassignMutation.isPending || cancelMutation.isPending}
                  submitMutationPending={submitMutation.isPending}
                  memberMap={memberMap}
                  profileId={profile?.id ?? null}
                />
              )
            })}
          </>
        ) : (
          visibleTasks.map((task) => {
            const dueLabel = formatDueShort(task.due_date)
            const isPending = pendingIds.has(task.id)
            const checkVisual = task.is_completed !== isPending // XOR
            // PR #38 — a task qualifies for the "Request to take"
            // inline drawer when: it's member-scope + someone else's +
            // incomplete + caller can't complete. Studio tasks and
            // own rows take the normal checkbox path.
            const canRequestTransfer =
              !task.can_complete &&
              !task.is_completed &&
              task.scope === 'member' &&
              Boolean(task.assigned_to) &&
              task.assigned_to !== profile?.id
            const pendingRequestId = pendingByTaskId.get(task.id) ?? null
            const isExpanded = expandedTaskId === task.id

            return (
              <TeamTaskRow
                key={task.id}
                task={task}
                dueLabel={dueLabel}
                isPending={isPending}
                checkVisual={checkVisual}
                canRequestTransfer={canRequestTransfer}
                pendingRequestId={pendingRequestId}
                isExpanded={isExpanded}
                noteText={noteText}
                onNoteChange={setNoteText}
                isMutating={reassignMutation.isPending || cancelMutation.isPending}
                disableCheckbox={!task.can_complete || submitMutation.isPending}
                onTogglePending={() => togglePending(task.id)}
                onToggleExpand={() => openRow(task.id)}
                onSubmitTake={() =>
                  reassignMutation.mutate({
                    taskId: task.id,
                    note: noteText.trim() ? noteText.trim() : null,
                  })
                }
                onSubmitCancel={() => {
                  if (pendingRequestId) cancelMutation.mutate(pendingRequestId)
                }}
                memberMap={memberMap}
              />
            )
          })
        )}
        </div>
      </div>

      {/* Toolbar moved to TOP of widget body (skin pass 2026-05-06) —
          see Submit + Eye render above the Due-column header. */}

      {/* Studio-only request modal (mounted last so it portals above
          the widget content). Only available in the Studio variant
          today; Team Board lacks the request-flow plumbing. */}
      {sectionedByStudioSpace && requestModalOpen && (
        <TaskRequestModal onClose={() => setRequestModalOpen(false)} />
      )}
    </div>
  )
}

// Single task row. Two interaction modes:
//   - Own/studio (can_complete=true): button-style row, click to
//     toggle the pending set, sibling rows join the Submit batch.
//   - Peer's member task (canRequestTransfer=true): click-to-expand
//     drawer. Closed: tappable row + (if pending) gold "Pending swap"
//     marker. Open: inline single-tap drawer offering either
//     "Request to take this task?" → Submit → fire RPC, OR (when
//     already pending) "Cancel task swap?" → Submit → fire cancel.
//     Mirrors the NotificationsPanel quick-reply pattern (forum
//     violet → gold for swap actions).
// Both variants share the grid-layout + stage pill + due-label look.
function TeamTaskRow({
  task,
  dueLabel,
  isPending,
  checkVisual,
  canRequestTransfer,
  pendingRequestId,
  isExpanded,
  noteText,
  onNoteChange,
  isMutating,
  disableCheckbox,
  onTogglePending,
  onToggleExpand,
  onSubmitTake,
  onSubmitCancel,
  memberMap,
}: {
  task: AssignedTask
  dueLabel: string | null
  isPending: boolean
  checkVisual: boolean
  canRequestTransfer: boolean
  pendingRequestId: string | null
  isExpanded: boolean
  noteText: string
  onNoteChange: (value: string) => void
  isMutating: boolean
  disableCheckbox: boolean
  onTogglePending: () => void
  onToggleExpand: () => void
  onSubmitTake: () => void
  onSubmitCancel: () => void
  memberMap: Map<string, TeamMember>
}) {
  const assignee = task.assigned_to ? memberMap.get(task.assigned_to) : undefined
  const roleLabel = rolePositionFor(assignee?.position)
  const shortName = formatShortName(task.assigned_to_name)
  // Skin pass 2026-05-06 — flat row inside AssignedTaskBoards'
  // inset-panel + divide-theme stack. No rounded/border on the row
  // itself; divide-theme handles separation. Theme-aware bg tokens
  // + theme-aware checkbox border so checkboxes are visible in light.
  const rowBase = 'relative w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-3 py-2 transition-all'
  const hasPendingSwap = Boolean(pendingRequestId)

  const rowContent = (
    <>
      <span
        className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors ${
          isPending
            ? 'bg-gold/30 border-gold'
            : task.is_completed
              ? 'bg-gold/30 border-gold/40'
              : 'checkbox-empty'
        }`}
      >
        {checkVisual && <Check size={11} className="text-gold" strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-[14px] leading-snug truncate ${task.is_completed ? 'line-through text-text-light' : 'text-text'}`}>
            {task.title}
          </p>
          {hasPendingSwap && (
            // Visible "you've asked for this" marker — small pill so the
            // row reads as pending at a glance, even when collapsed.
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gold/15 ring-1 ring-gold/40 text-[10px] font-bold uppercase tracking-[0.06em] text-gold">
              <ArrowRightLeft size={9} strokeWidth={2.5} />
              Pending swap
            </span>
          )}
        </div>
        {/* PR #69 — `[role] · First L.` line; matches MyTasks. */}
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-light flex-wrap">
          {roleLabel && <span className="lowercase">{roleLabel}</span>}
          {roleLabel && shortName && <span aria-hidden="true">·</span>}
          {shortName && <span>{shortName}</span>}
        </div>
      </div>
      <span
        className={`shrink-0 text-[12px] tabular-nums whitespace-nowrap mt-[2px] ${
          dueLabel ? 'text-text-light' : 'text-text-light/30'
        }`}
        title={dueLabel ? `Due ${dueLabel}` : 'No due date'}
      >
        {dueLabel ?? '—'}
      </span>
    </>
  )

  if (canRequestTransfer) {
    // Non-own member task. Two states: closed (tappable trigger) and
    // open (inline single-tap submit drawer). Flat row chrome
    // (divider stack does separation) but tinted bg when expanded or
    // pending so the swap state is visible at a glance.
    const tint = isExpanded
      ? 'bg-gold/10'
      : hasPendingSwap
        ? 'bg-gold/8 hover:bg-gold/12'
        : 'hover:bg-surface-hover'
    return (
      <div className={`transition-colors duration-150 ease-out ${tint}`}>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          className={`${rowBase} bg-transparent hover:bg-transparent focus-ring`}
        >
          {rowContent}
        </button>

        {isExpanded && (
          <div
            className="px-3 pb-3 pt-1 space-y-1.5"
            style={{ animation: 'fadeIn 180ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <p className="text-[12px] font-semibold text-text">
              {hasPendingSwap ? 'Cancel task swap?' : 'Request to take this task?'}
            </p>
            {/* Optional note — only shown for the take flow (cancel is
                a one-line withdrawal, no message needed). Mirrors the
                Notifications quick-reply textarea so the interaction
                pattern is consistent across the dashboard. */}
            {!hasPendingSwap && (
              <textarea
                autoFocus
                rows={2}
                value={noteText}
                onChange={(e) => onNoteChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    onSubmitTake()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    onToggleExpand()
                  }
                }}
                placeholder="Why? (optional — e.g. you're free this afternoon)"
                className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-gold/30 text-[12px] text-text placeholder:text-text-light focus:border-gold/60 focus:outline-none resize-none min-h-[44px]"
              />
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-text-light/70">
                {hasPendingSwap ? 'Esc to dismiss' : '⌘/Ctrl + Enter · Esc to dismiss'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleExpand}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium text-text-light hover:text-text transition-colors focus-ring"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={hasPendingSwap ? onSubmitCancel : onSubmitTake}
                  disabled={isMutating}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold transition-all focus-ring ${
                    hasPendingSwap
                      ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-[0_4px_12px_rgba(0,0,0,0.08)]'
                      : 'bg-gold text-black hover:bg-gold-muted shadow-[0_4px_12px_rgba(0,0,0,0.08)]'
                  } disabled:opacity-60`}
                >
                  {isMutating ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} strokeWidth={3} />}
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Own task or studio-pool task — standard checkbox-button row.
  return (
    <button
      type="button"
      disabled={disableCheckbox}
      onClick={onTogglePending}
      className={`${rowBase} ${
        isPending
          ? 'bg-gold/8 hover:bg-gold/12'
          : 'hover:bg-surface-hover'
      } ${task.is_completed && !isPending ? 'opacity-40' : ''} ${
        !task.can_complete ? 'cursor-default opacity-60' : ''
      }`}
    >
      {rowContent}
    </button>
  )
}

// ─── Section header + per-section rows (Studio variant) ────────────
//
// Used by StudioAssignedTasksCard to render visible rows under
// Control Room · Studio A · Studio B headers (plus an optional
// "(no space set)" group at the top). Reuses TeamTaskRow verbatim
// so the per-row interactions (pending toggle, request-to-take
// overlay) are identical to the flat Team Board layout.

function SectionedRows({
  label,
  labelDim,
  tasks,
  pendingIds,
  pendingByTaskId,
  expandedTaskId,
  noteText,
  onNoteChange,
  togglePending,
  onToggleExpand,
  onSubmitTake,
  onSubmitCancel,
  isMutating,
  submitMutationPending,
  memberMap,
  profileId,
}: {
  label: string
  labelDim?: boolean
  tasks: AssignedTask[]
  pendingIds: Set<string>
  pendingByTaskId: Map<string, string>
  expandedTaskId: string | null
  noteText: string
  onNoteChange: (value: string) => void
  togglePending: (taskId: string) => void
  onToggleExpand: (taskId: string) => void
  onSubmitTake: (taskId: string) => void
  onSubmitCancel: (requestId: string) => void
  isMutating: boolean
  submitMutationPending: boolean
  memberMap: Map<string, TeamMember>
  profileId: string | null
}) {
  // Skin pass 2026-05-06 — section header restyled as a section band
  // (matches the ASSIGNMENTS / FORUMS treatment used in
  // NotificationsPanel + the booking page table head). Rows inside
  // each section use divide-y divide-theme so hairlines appear
  // between rows within the same room. The OUTER scroller's
  // divide-theme handles separation BETWEEN sections.
  return (
    <section>
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-alt/40">
        <h3
          className={`text-[11px] font-bold uppercase tracking-[0.08em] ${
            labelDim ? 'text-text-light/70' : 'text-gold/70'
          }`}
        >
          {label}
        </h3>
        <span className="tabular-nums text-[10px] font-bold text-text-light/70 px-1.5 py-0.5 rounded-full bg-surface ring-1 ring-border">
          {tasks.length}
        </span>
      </div>
      <div className="divide-y divide-theme">
        {tasks.map((task) => {
          const dueLabel = formatDueShort(task.due_date)
          const isPending = pendingIds.has(task.id)
          const checkVisual = task.is_completed !== isPending
          const canRequestTransfer =
            !task.can_complete &&
            !task.is_completed &&
            task.scope === 'member' &&
            Boolean(task.assigned_to) &&
            task.assigned_to !== profileId
          const pendingRequestId = pendingByTaskId.get(task.id) ?? null
          const isExpanded = expandedTaskId === task.id
          return (
            <TeamTaskRow
              key={task.id}
              task={task}
              dueLabel={dueLabel}
              isPending={isPending}
              checkVisual={checkVisual}
              canRequestTransfer={canRequestTransfer}
              pendingRequestId={pendingRequestId}
              isExpanded={isExpanded}
              noteText={noteText}
              onNoteChange={onNoteChange}
              isMutating={isMutating}
              disableCheckbox={!task.can_complete || submitMutationPending}
              onTogglePending={() => togglePending(task.id)}
              onToggleExpand={() => onToggleExpand(task.id)}
              onSubmitTake={() => onSubmitTake(task.id)}
              onSubmitCancel={() => {
                if (pendingRequestId) onSubmitCancel(pendingRequestId)
              }}
              memberMap={memberMap}
            />
          )
        })}
      </div>
    </section>
  )
}
