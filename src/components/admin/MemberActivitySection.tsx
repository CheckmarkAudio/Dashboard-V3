// PR — Members admin "Activity" left-rail section.
//
// User direction (2026-05-14): "have the activity tab open up to
// several widgets — Session History, Task Completion, Clock Data.
// Make them the same size as the other widgets on the rest of the
// website. Lay it out similar to the tasks page in overview, two
// per page since the left menu bar takes up space."
//
// Three per-member widgets in a horizontal carousel, 2 visible per
// page, paged via arrows + dots. Each widget reuses the shared
// `widget-card` chrome via DashboardWidgetFrame so the section
// matches the visual language of Overview / Hub. No drag-reorder
// here — this is transient drill-down content, not a customizable
// dashboard.

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
  useMemberAdminCompletedTasks,
  useMemberAdminSessions,
  useMemberClockEntries,
} from '../../lib/queries/memberProfile'
import { Select } from '../ui'
import DashboardWidgetFrame from '../dashboard/DashboardWidgetFrame'
import type { TeamMember } from '../../types'
import type { AdminClockEntry } from '../../lib/queries/timeClock'

const HISTORY_LIMIT = 20
// Locked page size — left rail eats horizontal room, so 3-per-page
// would crowd the widgets. User asked for "two per this page since
// there is a left menu bar taking up space."
const PAGE_SIZE = 2
// Match the standard widget row height used by WorkspacePanel
// (ROW_HEIGHT_PX = 340). Keeps the Activity widgets visually
// consistent with Overview / Hub.
const WIDGET_HEIGHT_PX = 340
const PAGE_GAP_PX = 16

export default function MemberActivitySection({ members }: { members: TeamMember[] }) {
  const memberOptions = useMemo(
    () =>
      [...members]
        .filter((m) => m.display_name)
        .sort((a, b) => {
          // Active members first, then alpha within each bucket so
          // the picker opens to a useful default (most active member
          // alphabetically).
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
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity size={18} className="text-gold" aria-hidden="true" />
            Activity
          </h2>
          <p className="text-text-muted text-[12px] mt-0.5">
            Recent sessions, completed tasks, and shifts for one member at a glance.
          </p>
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
  const sessions = useMemberAdminSessions(member.id, HISTORY_LIMIT)
  const tasks = useMemberAdminCompletedTasks(member.id, HISTORY_LIMIT)
  const clockEntries = useMemberClockEntries(member.id, HISTORY_LIMIT)

  // Three widget definitions — kept inline rather than in a registry
  // because they're tightly coupled to this view's queries and
  // there's no draggable layout state to persist.
  const widgets: { id: string; title: string; body: ReactNode }[] = [
    {
      id: 'sessions',
      title: 'Session History',
      body: (
        <ListBody
          loading={sessions.isLoading}
          error={sessions.error}
          empty={!sessions.isLoading && (sessions.data?.length ?? 0) === 0}
          emptyIcon={<Briefcase size={18} className="text-text-light mb-1.5" aria-hidden="true" />}
          emptyLabel="No sessions on record yet."
        >
          {sessions.data?.map((s) => (
            <li key={s.sessionId} className="px-1 py-2.5 hover:bg-surface-alt/60 rounded-md transition-colors -mx-1">
              <Link
                to="/sessions"
                className="block min-w-0"
                title={`${s.title} · ${s.dateLabel}${s.room ? ` · ${s.room}` : ''}`}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('highlight-session', { detail: { sessionId: s.sessionId } }),
                  )
                }}
              >
                <div className="flex items-baseline justify-between gap-2 px-3">
                  <p className="text-[13px] font-medium text-text truncate">{s.title}</p>
                  <span className="text-[11px] text-text-light tabular-nums shrink-0">{s.dateLabel}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 px-3">
                  {s.room && (
                    <span className="text-[11px] text-text-muted truncate">{s.room}</span>
                  )}
                  {s.status && s.status !== 'scheduled' && (
                    <span className="text-[10px] uppercase tracking-wider text-text-light">
                      {s.status}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ListBody>
      ),
    },
    {
      id: 'tasks',
      title: 'Task Completion',
      body: (
        <ListBody
          loading={tasks.isLoading}
          error={tasks.error}
          empty={!tasks.isLoading && (tasks.data?.length ?? 0) === 0}
          emptyIcon={<CheckCircle2 size={18} className="text-text-light mb-1.5" aria-hidden="true" />}
          emptyLabel="No completed tasks yet."
        >
          {tasks.data?.map((t) => (
            <li key={t.taskId} className="px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-medium text-text truncate" title={t.title}>{t.title}</p>
                <span className="text-[11px] text-text-light tabular-nums shrink-0">{t.relativeLabel}</span>
              </div>
            </li>
          ))}
        </ListBody>
      ),
    },
    {
      id: 'clock',
      title: 'Clock Data',
      body: (
        <ListBody
          loading={clockEntries.isLoading}
          error={clockEntries.error}
          empty={!clockEntries.isLoading && (clockEntries.data?.length ?? 0) === 0}
          emptyIcon={<Clock size={18} className="text-text-light mb-1.5" aria-hidden="true" />}
          emptyLabel="No shifts recorded yet."
        >
          {clockEntries.data?.map((e) => (
            <ClockEntryRow key={e.entry_id} entry={e} />
          ))}
        </ListBody>
      ),
    },
  ]

  const totalPages = Math.max(1, Math.ceil(widgets.length / PAGE_SIZE))
  const [currentPage, setCurrentPage] = useState(0)

  // Defensive: if widget count or page size changes ever leaves us
  // out of bounds, snap back to the last page.
  useEffect(() => {
    if (currentPage > totalPages - 1) setCurrentPage(Math.max(0, totalPages - 1))
  }, [currentPage, totalPages])

  // Reset to page 0 when the member changes — feels less surprising
  // than landing on page 2 of widgets that just got swapped in.
  useEffect(() => {
    setCurrentPage(0)
  }, [member.id])

  const widgetWidth = `calc((100% - ${(PAGE_SIZE - 1) * PAGE_GAP_PX}px) / ${PAGE_SIZE})`
  const showArrows = totalPages > 1
  const showDots = totalPages > 1

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          className="overflow-hidden"
          style={{ height: `${WIDGET_HEIGHT_PX}px` }}
        >
          <div
            className="flex"
            style={{
              gap: `${PAGE_GAP_PX}px`,
              transform: `translateX(calc(${-currentPage * 100}% - ${currentPage * PAGE_GAP_PX}px))`,
              transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'transform',
            }}
          >
            {widgets.map((w) => (
              <div
                key={w.id}
                style={{
                  flex: `0 0 ${widgetWidth}`,
                  width: widgetWidth,
                  height: `${WIDGET_HEIGHT_PX}px`,
                }}
              >
                <DashboardWidgetFrame title={w.title}>
                  {w.body}
                </DashboardWidgetFrame>
              </div>
            ))}
          </div>
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
    </div>
  )
}

// ─── Widget body shell + rows ────────────────────────────────────

function ListBody({
  loading,
  error,
  empty,
  emptyIcon,
  emptyLabel,
  children,
}: {
  loading: boolean
  error: unknown
  empty: boolean
  emptyIcon?: ReactNode
  emptyLabel: string
  children: ReactNode
}) {
  if (error) {
    return (
      <div className="text-[12px] text-rose-300">
        Failed to load. {error instanceof Error ? error.message : ''}
      </div>
    )
  }
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-light">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      </div>
    )
  }
  if (empty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center text-text-light">
        {emptyIcon}
        <p className="text-[12px] italic">{emptyLabel}</p>
      </div>
    )
  }
  return (
    <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/40 -mx-1 px-1">
      {children}
    </ul>
  )
}

function ClockEntryRow({ entry }: { entry: AdminClockEntry }) {
  const isOpen = entry.clocked_out_at === null
  return (
    <li className="px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-text">
          {formatDateTime(entry.clocked_in_at)}
          <ChevronRight size={11} className="inline mx-1 text-text-light" aria-hidden="true" />
          {isOpen ? (
            <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wider align-middle">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              On shift
            </span>
          ) : (
            <span className="text-text-muted">{formatDateTime(entry.clocked_out_at!)}</span>
          )}
        </p>
        <span className="text-[11px] text-text-light tabular-nums shrink-0">
          {formatDuration(entry.duration_minutes)}
        </span>
      </div>
      {entry.notes && (
        <p className="text-[11px] text-text-light line-clamp-2 mt-0.5">
          {entry.notes}
        </p>
      )}
    </li>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────

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
