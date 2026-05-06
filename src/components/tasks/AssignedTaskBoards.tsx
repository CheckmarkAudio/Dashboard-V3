import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowRightLeft, Check, Inbox, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  completeAssignedTask,
  fetchStudioAssignedTasks,
  fetchTeamAssignedTasks,
} from '../../lib/queries/assignments'
import { requestTaskReassignment } from '../../lib/queries/taskReassign'
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

  // PR #38 — request-to-take feature. When a user hovers over a team
  // task assigned to someone else (can_complete=false but assigned_to
  // is set), a "Request to take" overlay appears. Clicking fires the
  // RPC which inserts a task_reassign_requests row + notifies the
  // current assignee. Once the request is sent we remember the task
  // id locally so the overlay shows "Request sent" instead of letting
  // the user fire again.
  const [requestedTaskIds, setRequestedTaskIds] = useState<Set<string>>(() => new Set())
  const reassignMutation = useMutation({
    mutationFn: (taskId: string) => requestTaskReassignment(taskId),
    onSuccess: (_data, taskId) => {
      setRequestedTaskIds((prev) => {
        const next = new Set(prev)
        next.add(taskId)
        return next
      })
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
      {/* PR #69 — `Due` column header anchors the right-side date so
          users know it's the due date, not assignment date. Stage
          filter (PR #36) deferred to the flywheel-event-ledger PR. */}
      <div className="shrink-0 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5 px-2 mb-1">
        <span className="w-[18px]" aria-hidden="true" />
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
                requestedTaskIds={requestedTaskIds}
                togglePending={togglePending}
                reassignMutation={reassignMutation}
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
                  requestedTaskIds={requestedTaskIds}
                  togglePending={togglePending}
                  reassignMutation={reassignMutation}
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
            // overlay when: it's member-scope + someone else's +
            // incomplete + caller can't complete. Studio tasks and
            // own rows take the normal checkbox path.
            const canRequestTransfer =
              !task.can_complete &&
              !task.is_completed &&
              task.scope === 'member' &&
              Boolean(task.assigned_to) &&
              task.assigned_to !== profile?.id
            const alreadyRequested = requestedTaskIds.has(task.id)

            return (
              <TeamTaskRow
                key={task.id}
                task={task}
                dueLabel={dueLabel}
                isPending={isPending}
                checkVisual={checkVisual}
                canRequestTransfer={canRequestTransfer}
                alreadyRequested={alreadyRequested}
                isRequesting={reassignMutation.isPending}
                disableCheckbox={!task.can_complete || submitMutation.isPending}
                onTogglePending={() => togglePending(task.id)}
                onRequestTake={() => reassignMutation.mutate(task.id)}
                memberMap={memberMap}
              />
            )
          })
        )}
        </div>
      </div>

      {/* PR #37 — sticky footer: Submit Completed bar (greyed until
          user queues at least one pending toggle) + show-completed
          eye. No +Task button here since these boards don't support
          self-requesting. */}
      <div className="shrink-0 space-y-1.5 pt-1.5 mt-1 border-t theme-divider">
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
        <div className="flex items-center justify-end">
          <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((value) => !value)} />
        </div>
      </div>
    </div>
  )
}

// Single task row. Two interaction modes:
//   - Own/studio (can_complete=true): button-style row, click to
//     toggle the pending set, sibling rows join the Submit batch.
//   - Peer's member task (canRequestTransfer=true): non-interactive
//     row with a hover overlay showing "Request to take this task".
//     Clicking the overlay fires the reassign RPC; after success the
//     overlay flips to a confirmed "Request sent" state.
// Both variants share the grid-layout + stage pill + due-label look.
function TeamTaskRow({
  task,
  dueLabel,
  isPending,
  checkVisual,
  canRequestTransfer,
  alreadyRequested,
  isRequesting,
  disableCheckbox,
  onTogglePending,
  onRequestTake,
  memberMap,
}: {
  task: AssignedTask
  dueLabel: string | null
  isPending: boolean
  checkVisual: boolean
  canRequestTransfer: boolean
  alreadyRequested: boolean
  isRequesting: boolean
  disableCheckbox: boolean
  onTogglePending: () => void
  onRequestTake: () => void
  memberMap: Map<string, TeamMember>
}) {
  const assignee = task.assigned_to ? memberMap.get(task.assigned_to) : undefined
  const roleLabel = rolePositionFor(assignee?.position)
  const shortName = formatShortName(task.assigned_to_name)
  // Skin pass 2026-05-06 — flattened from rounded-[14px] border card
  // to flat row inside AssignedTaskBoards' inset-panel + divide-theme
  // stack. Matches the MyTasksCard treatment exactly:
  // - rounded + border dropped (divide-theme provides separation)
  // - bg state uses theme-aware tokens (dark-tuned bg-white/[…] → bg-surface-*)
  // - checkbox empty-state border swapped border-white/20 → border-border
  //   so the checkbox is actually visible in light mode (was invisible)
  const rowBase = 'relative w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-3 py-2 transition-all'

  const rowContent = (
    <>
      <span
        className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-[5px] border-[1.5px] flex items-center justify-center ${
          isPending
            ? 'bg-gold/30 border-gold'
            : task.is_completed
              ? 'bg-gold/30 border-gold/40'
              : 'border-border'
        }`}
      >
        {checkVisual && <Check size={11} className="text-gold" strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-[14px] leading-snug truncate ${task.is_completed ? 'line-through text-text-light' : 'text-text'}`}>
            {task.title}
          </p>
          {/* PR #70 — `Required` tag retired (matches MyTasks). */}
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
    // Non-own member task. Render as a div (not button) so clicks go
    // to the overlay, not a toggle. Overlay fades in on hover/focus.
    return (
      <div
        className={`group ${rowBase} bg-surface-alt/30 cursor-default overflow-hidden`}
        tabIndex={0}
      >
        {rowContent}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity ${
            alreadyRequested
              ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30 ring-inset opacity-100'
              : 'bg-gold/10 ring-1 ring-gold/40 ring-inset opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          }`}
        >
          {alreadyRequested ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-300">
              <Check size={12} strokeWidth={3} />
              Request sent
            </span>
          ) : (
            <button
              type="button"
              onClick={onRequestTake}
              disabled={isRequesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-gold text-black hover:bg-gold-muted shadow-[0_4px_12px_rgba(0,0,0,0.08)] disabled:opacity-60"
            >
              <ArrowRightLeft size={12} strokeWidth={2.5} />
              Request to take this task
            </button>
          )}
        </div>
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
  requestedTaskIds,
  togglePending,
  reassignMutation,
  submitMutationPending,
  memberMap,
  profileId,
}: {
  label: string
  labelDim?: boolean
  tasks: AssignedTask[]
  pendingIds: Set<string>
  requestedTaskIds: Set<string>
  togglePending: (taskId: string) => void
  reassignMutation: { mutate: (taskId: string) => void; isPending: boolean }
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
          const alreadyRequested = requestedTaskIds.has(task.id)
          return (
            <TeamTaskRow
              key={task.id}
              task={task}
              dueLabel={dueLabel}
              isPending={isPending}
              checkVisual={checkVisual}
              canRequestTransfer={canRequestTransfer}
              alreadyRequested={alreadyRequested}
              isRequesting={reassignMutation.isPending}
              disableCheckbox={!task.can_complete || submitMutationPending}
              onTogglePending={() => togglePending(task.id)}
              onRequestTake={() => reassignMutation.mutate(task.id)}
              memberMap={memberMap}
            />
          )
        })}
      </div>
    </section>
  )
}
