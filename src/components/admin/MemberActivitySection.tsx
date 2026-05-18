// PR — Members admin "Activity" left-rail section, refit to the
// canonical widget pattern.
//
// User direction (2026-05-14): "take those widgets you just made and
// format the ui for them the same as the other widgets:
// rearrange-ability, nesting and visible rows with thin lines, etc.
// just do the exact same style as the other widgets."
//
// What "exact same style" means in this codebase (cross-checked
// against adminOverviewWidgets.tsx + WorkspacePanel.tsx):
//   1. Each widget body is a `<ListPanel title="…">` (nested-panel
//      pattern — pure-white inner panel with its own bold title +
//      needle-thin row dividers, sitting inside the dimmed widget
//      frame). Frame's own title is suppressed via `hideTitle`.
//   2. Each row is a `<ListRow>` with icon tile · title · meta ·
//      right pill — same row chrome the rest of the site uses.
//   3. Drag-reorder via dnd-kit. Order is session-only here (the
//      site-wide layout persistence is scoped to dashboards; this
//      is a transient drill-down, no need to remember per-admin
//      ordering).
//   4. Expand-to-modal via `FloatingDetailModal` — same pattern
//      WorkspacePanel uses for click-to-expand.
//   5. Page arrows + dots (carousel), 2 widgets per page since the
//      left rail eats horizontal room.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useMemberAdminCompletedTasks,
  useMemberAdminSessions,
  useMemberClockEntries,
} from '../../lib/queries/memberProfile'
import { ExportButtons, Select, toExportColumns } from '../ui'
import { clockColumns } from '../../lib/columns/clockColumns'
import { sessionColumns } from '../../lib/columns/sessionColumns'
import { memberTaskCompletionColumns } from '../../lib/columns/memberTaskCompletionColumns'
import {
  packPagedWidgets,
  packedPageForWidget,
  packedTotalPages,
} from '../../lib/carousel/packPagedWidgets'

/**
 * Build a safe, member-name-scoped filename + PDF title for each
 * widget export so multi-member downloads land cleanly in the user's
 * Downloads folder. Sanitized to a whitelist by ExportButtons before
 * being handed to the anchor download.
 */
function exportNames(member: TeamMember, kind: string) {
  return {
    filename: `${kind}-${member.display_name}`,
    title: `${kind.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} — ${member.display_name}`,
  }
}
import DashboardWidgetFrame, { type DragHandleProps } from '../dashboard/DashboardWidgetFrame'
import type { TeamMember } from '../../types'
import type { AdminClockEntry } from '../../lib/queries/timeClock'

const HISTORY_LIMIT = 20
// Locked page size — left rail eats horizontal room, so 3-per-page
// would crowd. User asked explicitly for "two per this page since
// there is a left menu bar taking up space."
const PAGE_SIZE = 2
// Match Overview / Hub widget height. Those widgets register with
// rowSpan: 2, which WorkspacePanel renders as 2 × ROW_HEIGHT_PX
// (340) + 1 × ROW_GAP_PX (16) = 696px.
const WIDGET_HEIGHT_PX = 696
const PAGE_GAP_PX = 16

type WidgetId = 'sessions' | 'tasks' | 'clock'

const DEFAULT_ORDER: WidgetId[] = ['sessions', 'tasks', 'clock']

interface WidgetMeta {
  id: WidgetId
  title: string
}

const WIDGET_META: Record<WidgetId, WidgetMeta> = {
  sessions: { id: 'sessions', title: 'Session History' },
  tasks: { id: 'tasks', title: 'Task Completion' },
  clock: { id: 'clock', title: 'Clock Data' },
}

export default function MemberActivitySection({ members }: { members: TeamMember[] }) {
  const memberOptions = useMemo(
    () =>
      [...members]
        .filter((m) => m.display_name)
        .sort((a, b) => {
          const aActive = (a.status ?? 'active') === 'active'
          const bActive = (b.status ?? 'active') === 'active'
          if (aActive !== bActive) return aActive ? -1 : 1
          return a.display_name.localeCompare(b.display_name)
        }),
    [members],
  )

  const [memberId, setMemberId] = useState<string>(() => memberOptions[0]?.id ?? '')

  const member = useMemo(
    () => memberOptions.find((m) => m.id === memberId) ?? null,
    [memberOptions, memberId],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          {/* Sitewide rule: titles only, no decorative subtitle. */}
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity size={18} className="text-gold" aria-hidden="true" />
            Activity
          </h2>
        </div>
        <div className="flex items-end gap-3">
          {member && (
            <Link
              to={`/profile/${member.id}`}
              className="text-[12px] font-medium text-gold hover:text-gold/80 transition-colors inline-flex items-center gap-1 pb-2"
            >
              View profile
              <ChevronRight size={12} aria-hidden="true" />
            </Link>
          )}
          <div className="min-w-[220px]">
            <Select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              aria-label="Choose member to view activity"
            >
              {memberOptions.length === 0 && <option value="">No members</option>}
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                  {m.status === 'inactive' ? ' · inactive' : ''}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {member ? (
        <ActivityCarousel member={member} />
      ) : (
        <div className="rounded-xl border border-border bg-surface-alt/40 px-4 py-12 flex flex-col items-center text-center">
          <Inbox size={20} className="text-text-light mb-2" aria-hidden="true" />
          <p className="text-[13px] text-text-muted">No team members yet.</p>
          <p className="text-[11px] text-text-light mt-1">
            Add members from the Roster tab to see their activity here.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Carousel ────────────────────────────────────────────────────

function ActivityCarousel({ member }: { member: TeamMember }) {
  // Session-only widget order. The sitewide WorkspacePanel persists
  // ordering per scope/role/userId, but these widgets are a
  // transient drill-down view — no point cluttering the layout
  // table with three more rows. Resets on every page mount.
  const [order, setOrder] = useState<WidgetId[]>(DEFAULT_ORDER)
  const [activeId, setActiveId] = useState<WidgetId | null>(null)
  // 2026-05-17 — `expandedId` now drives INLINE expansion (the
  // expanded widget grows to 2× width, pushing other widgets across
  // the carousel) rather than opening a FloatingDetailModal. Click
  // the expand chevron again to collapse back to normal width. The
  // chevron icon swaps Maximize2 ↔ Minimize2 via DashboardWidgetFrame's
  // new `isExpanded` prop so the affordance reads correctly in both
  // states.
  const [expandedId, setExpandedId] = useState<WidgetId | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  // Pack widgets into pages once per (order, expandedId) change. The
  // shared `packPagedWidgets` helper (also used by `WorkspacePanel`)
  // handles the slot-weight + spacer logic — see its docstring for
  // the page-spanning prevention rationale.
  const layout = useMemo(
    () => packPagedWidgets(order, (id) => (id === expandedId ? 2 : 1), PAGE_SIZE),
    [order, expandedId],
  )
  const totalPages = packedTotalPages(layout)

  // Clamp + reset behavior:
  //   - if totalPages shrinks below currentPage (collapse/reorder), pin to the last page
  useEffect(() => {
    if (currentPage > totalPages - 1) setCurrentPage(Math.max(0, totalPages - 1))
  }, [currentPage, totalPages])

  // Reset to page 0 when the picked member changes — feels less
  // surprising than landing mid-carousel on freshly-swapped data.
  // Also collapse any expanded widget so the new member's widgets
  // start in the standard 2-per-page view.
  useEffect(() => {
    setCurrentPage(0)
    setExpandedId(null)
  }, [member.id])

  // When a widget expands, auto-navigate to the page that contains
  // it so the user always SEES the expansion happen — otherwise an
  // expanded widget on a different page would feel like the click
  // did nothing. Smooth transition handled by the carousel
  // translate's CSS transition.
  useEffect(() => {
    if (!expandedId) return
    const page = packedPageForWidget(layout, expandedId)
    if (page !== null) setCurrentPage(page)
  }, [expandedId, layout])

  const normalWidth = `calc((100% - ${(PAGE_SIZE - 1) * PAGE_GAP_PX}px) / ${PAGE_SIZE})`
  // Expanded widget fills the entire viewport. Subtracting nothing
  // here: a page is `100% + PAGE_GAP_PX` (track gap), and one widget
  // at 100% sits flush against page boundaries.
  const expandedWidth = '100%'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Dragging an expanded widget would break the page packing math
  // (a 2-slot widget dragged into a 1-slot position would orphan a
  // spacer mid-row). Collapse before drag begins; user can re-
  // expand afterward if they want.
  const handleDragStart = (e: DragStartEvent) => {
    setExpandedId(null)
    setActiveId(e.active.id as WidgetId)
  }
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const a = active.id as WidgetId
    const b = over.id as WidgetId
    setOrder((prev) => {
      const next = [...prev]
      const aIdx = next.indexOf(a)
      const bIdx = next.indexOf(b)
      if (aIdx === -1 || bIdx === -1) return prev
      ;[next[aIdx], next[bIdx]] = [next[bIdx]!, next[aIdx]!]
      return next
    })
  }
  const handleDragCancel = () => setActiveId(null)

  const showArrows = totalPages > 1
  const showDots = totalPages > 1

  const toggleExpand = (id: WidgetId) =>
    setExpandedId((prev) => (prev === id ? null : id))

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="relative">
          <div
            className="overflow-hidden"
            style={{ height: `${WIDGET_HEIGHT_PX}px` }}
          >
            <SortableContext items={order} strategy={horizontalListSortingStrategy}>
              <div
                className="flex"
                style={{
                  gap: `${PAGE_GAP_PX}px`,
                  transform: `translateX(calc(${-currentPage * 100}% - ${currentPage * PAGE_GAP_PX}px))`,
                  transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'transform',
                }}
              >
                {layout.map((item) => {
                  if (item.type === 'spacer') {
                    // Non-interactive placeholder that holds the
                    // orphan slot when an expanded widget bumps to
                    // the next page. Same width as a normal widget
                    // so the flex row keeps its page rhythm.
                    return (
                      <div
                        key={item.key}
                        aria-hidden="true"
                        style={{
                          flex: `0 0 ${normalWidth}`,
                          height: `${WIDGET_HEIGHT_PX}px`,
                          transition: 'flex-basis 320ms cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                    )
                  }
                  const { id } = item
                  const isExpanded = id === expandedId
                  return (
                    <SortableWidget
                      key={id}
                      id={id}
                      width={isExpanded ? expandedWidth : normalWidth}
                      height={WIDGET_HEIGHT_PX}
                      isExpanded={isExpanded}
                    >
                      {(dragHandleProps) => (
                        <DashboardWidgetFrame
                          title={WIDGET_META[id].title}
                          dragHandleProps={dragHandleProps}
                          onExpand={() => toggleExpand(id)}
                          isExpanded={isExpanded}
                        >
                          <WidgetBody id={id} member={member} />
                        </DashboardWidgetFrame>
                      )}
                    </SortableWidget>
                  )
                })}
              </div>
            </SortableContext>
          </div>

          {showArrows && (
            <>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                aria-label="Previous page"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-surface border border-border shadow-md text-text hover:bg-surface-alt hover:text-gold disabled:opacity-30 disabled:hover:bg-surface disabled:hover:text-text disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                aria-label="Next page"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-surface border border-border shadow-md text-text hover:bg-surface-alt hover:text-gold disabled:opacity-30 disabled:hover:bg-surface disabled:hover:text-text disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        {showDots && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentPage(i)}
                aria-label={`Go to page ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === currentPage
                    ? 'w-6 bg-gold'
                    : 'w-2 bg-text-muted/40 hover:bg-text-muted/70'
                }`}
              />
            ))}
          </div>
        )}

        <DragOverlay
          dropAnimation={{
            duration: 220,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {activeId ? (
            <div
              style={{ width: normalWidth, height: `${WIDGET_HEIGHT_PX}px` }}
              className="widget-card bg-surface shadow-2xl ring-2 ring-gold/60 rounded-2xl overflow-hidden cursor-grabbing flex items-center justify-center"
            >
              <p className="text-[13px] font-bold text-text">{WIDGET_META[activeId].title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ─── Sortable wrapper ────────────────────────────────────────────

function SortableWidget({
  id,
  width,
  height,
  isExpanded,
  children,
}: {
  id: WidgetId
  width: string
  height: number
  isExpanded: boolean
  children: (dragHandleProps: DragHandleProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  // Combine the dnd-kit transition (transform-only for drag) with our
  // own `flex-basis` transition so the width animation feels of-a-
  // piece with the carousel translate. Same easing curve + duration as
  // the carousel scroll so the expand "lands" at the same moment the
  // carousel pages over to the expanded widget.
  const combinedTransition = [
    transition ?? '',
    'flex-basis 320ms cubic-bezier(0.16, 1, 0.3, 1)',
    'box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1)',
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: combinedTransition,
        flex: `0 0 ${width}`,
        width,
        height: `${height}px`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
        opacity: isDragging ? 0.35 : 1,
        // Subtle elevation when expanded — communicates "this is the
        // active focus" without changing the widget's chrome (the
        // frame itself stays the same shape). Soft gold-tinged ring
        // matches the dashboard's brand accent.
        boxShadow: isExpanded
          ? '0 18px 40px -16px rgba(201, 168, 76, 0.32), 0 0 0 1px rgba(201, 168, 76, 0.25)'
          : 'none',
        borderRadius: isExpanded ? 16 : 0,
      }}
      className={isDragging ? 'rounded-2xl ring-2 ring-dashed ring-gold/40' : ''}
    >
      {children({
        attributes: attributes as DragHandleProps['attributes'],
        listeners: listeners as DragHandleProps['listeners'],
        isDragging,
      })}
    </div>
  )
}

// ─── Widget body dispatcher ──────────────────────────────────────

function WidgetBody({ id, member }: { id: WidgetId; member: TeamMember }) {
  if (id === 'sessions') return <SessionsBody member={member} />
  if (id === 'tasks') return <TasksBody member={member} />
  return <ClockBody member={member} />
}

// ─── Per-widget ExportButtons strip ──────────────────────────────
//
// Small pinned strip rendered at the top of each widget body, above
// the scrollable CanonicalBody. Right-aligned so the title row above
// stays clean. Disabled state when zero rows surfaces the standard
// "No rows to export yet" tooltip from ExportButtons.
function WidgetExportStrip({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end pb-1.5 -mt-1">
      {children}
    </div>
  )
}

// ─── Canonical body shell ───────────────────────────────────────
//
// `inset-panel` provides the booking-style nested chrome (border +
// rounded corners + clipped overflow). Rows inside use
// `divide-y divide-theme` for needle-thin hairlines.
//
// The earlier section-header band was removed once the frame's own
// title became visible — having a "SESSIONS" band UNDER a "Session
// History" frame title was a duplicate heading.
function CanonicalBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 min-h-0 inset-panel">
      <div className="h-full overflow-auto">
        <div className="divide-y divide-theme">{children}</div>
      </div>
    </div>
  )
}

// `CanonicalRow` carries the row layout used across NotificationsPanel
// (forum + assignment rows): colored circle icon · bold title + muted
// meta · right-side timestamp pill. Color tints come from the row's
// own `tint` prop so each widget can pick a category accent (violet
// for sessions, gold for tasks, emerald for shifts) without losing
// the shared row rhythm.
type RowTint = 'violet' | 'gold' | 'emerald'

const TINT_CLASSES: Record<RowTint, { bg: string; ring: string; text: string }> = {
  violet:  { bg: 'bg-violet-500/15',  ring: 'ring-violet-500/30',  text: 'text-violet-300' },
  gold:    { bg: 'bg-gold/15',        ring: 'ring-gold/30',        text: 'text-gold' },
  emerald: { bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/30', text: 'text-emerald-300' },
}

function CanonicalRow({
  to,
  onClick,
  icon: Icon,
  tint,
  title,
  meta,
  rightLabel,
  rightExtra,
}: {
  to?: string
  onClick?: () => void
  icon: typeof Briefcase
  tint: RowTint
  title: string
  meta: string
  rightLabel?: string
  rightExtra?: ReactNode
}) {
  const t = TINT_CLASSES[tint]
  const inner = (
    <div className="flex items-start gap-2.5 px-3 py-2.5">
      <span
        className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full ring-1 ${t.bg} ${t.ring} ${t.text}`}
        aria-hidden="true"
      >
        <Icon size={13} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-text truncate">{title}</p>
        <p className="text-[12px] text-text-light truncate mt-0.5">{meta}</p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
        {rightLabel && (
          <span className="text-[10px] text-text-light tabular-nums whitespace-nowrap">
            {rightLabel}
          </span>
        )}
        {rightExtra}
      </div>
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="block transition-[background-color] duration-150 hover:bg-surface-hover focus-ring">
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left transition-[background-color] duration-150 hover:bg-surface-hover focus-ring"
      >
        {inner}
      </button>
    )
  }
  return <div className="transition-[background-color] duration-150 hover:bg-surface-hover">{inner}</div>
}

// ─── Sessions widget body ────────────────────────────────────────

function SessionsBody({ member }: { member: TeamMember }) {
  const sessions = useMemberAdminSessions(member.id, HISTORY_LIMIT)
  if (sessions.error) return <ErrorState error={sessions.error} />
  if (sessions.isLoading) return <LoadingState />
  const rows = sessions.data ?? []
  const { filename, title } = exportNames(member, 'session-history')
  return (
    <>
      <WidgetExportStrip>
        <ExportButtons
          filename={filename}
          title={title}
          columns={toExportColumns(sessionColumns)}
          rows={rows}
        />
      </WidgetExportStrip>
      {rows.length === 0 ? (
        <EmptyState icon={Briefcase} label="No sessions on record yet." />
      ) : (
        <CanonicalBody>
          {rows.map((s) => (
            <CanonicalRow
              key={s.sessionId}
              to="/sessions"
              icon={Briefcase}
              tint="violet"
              title={s.title}
              meta={
                [
                  s.room,
                  s.status && s.status !== 'scheduled' ? s.status : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Studio session'
              }
              rightLabel={s.dateLabel}
            />
          ))}
        </CanonicalBody>
      )}
    </>
  )
}

// ─── Tasks widget body ───────────────────────────────────────────

function TasksBody({ member }: { member: TeamMember }) {
  const tasks = useMemberAdminCompletedTasks(member.id, HISTORY_LIMIT)
  if (tasks.error) return <ErrorState error={tasks.error} />
  if (tasks.isLoading) return <LoadingState />
  const rows = tasks.data ?? []
  const { filename, title } = exportNames(member, 'task-completion')
  return (
    <>
      <WidgetExportStrip>
        <ExportButtons
          filename={filename}
          title={title}
          columns={toExportColumns(memberTaskCompletionColumns)}
          rows={rows}
        />
      </WidgetExportStrip>
      {rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} label="No completed tasks yet." />
      ) : (
        <CanonicalBody>
          {rows.map((t) => (
            <CanonicalRow
              key={t.taskId}
              icon={CheckCircle2}
              tint="gold"
              title={t.title}
              meta="Completed"
              rightLabel={t.relativeLabel}
            />
          ))}
        </CanonicalBody>
      )}
    </>
  )
}

// ─── Clock widget body ───────────────────────────────────────────

function ClockBody({ member }: { member: TeamMember }) {
  const entries = useMemberClockEntries(member.id, HISTORY_LIMIT)
  if (entries.error) return <ErrorState error={entries.error} />
  if (entries.isLoading) return <LoadingState />
  const rows = entries.data ?? []
  const { filename, title } = exportNames(member, 'shift-history')
  return (
    <>
      <WidgetExportStrip>
        {/* Reuses the SAME `clockColumns` array that powers the main
            Members > Clock Data tab — single source of truth across
            both surfaces. Rename a header in `clockColumns.tsx` and
            both the main tab AND this widget's CSV/PDF update in
            lockstep. */}
        <ExportButtons
          filename={filename}
          title={title}
          columns={toExportColumns(clockColumns)}
          rows={rows}
        />
      </WidgetExportStrip>
      {rows.length === 0 ? (
        <EmptyState icon={Clock} label="No shifts recorded yet." />
      ) : (
        <CanonicalBody>
          {rows.map((e) => {
            const isOpen = e.clocked_out_at === null
            return (
              <CanonicalRow
                key={e.entry_id}
                icon={Clock}
                tint="emerald"
                title={formatClockTitle(e)}
                meta={e.notes ?? 'No notes'}
                rightLabel={isOpen ? undefined : formatDuration(e.duration_minutes)}
                rightExtra={
                  isOpen ? (
                    <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                      On shift
                    </span>
                  ) : null
                }
              />
            )
          })}
        </CanonicalBody>
      )}
    </>
  )
}

// ─── Status states ───────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center text-text-light">
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
    </div>
  )
}

function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="text-[12px] text-rose-300">
      Failed to load. {error instanceof Error ? error.message : ''}
    </div>
  )
}

function EmptyState({
  icon: Icon,
  label,
}: {
  icon: typeof Inbox
  label: string
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center text-text-light">
      <Icon size={20} className="mb-1.5" aria-hidden="true" />
      <p className="text-[12px] italic">{label}</p>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatClockTitle(e: AdminClockEntry): string {
  const inLabel = formatDateTime(e.clocked_in_at)
  if (e.clocked_out_at === null) return `${inLabel} → now`
  const outLabel = formatDateTime(e.clocked_out_at)
  return `${inLabel} → ${outLabel}`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (remainder === 0) return `${hours}h`
  return `${hours}h ${remainder}m`
}
