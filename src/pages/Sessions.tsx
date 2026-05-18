import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import CreateBookingModal from '../components/CreateBookingModal'
import AdminEditSessionsModal from '../components/admin/sessions/AdminEditSessionsModal'
import ClientsPanel from '../components/clients/ClientsPanel'
import BookingStatusPopover from '../components/calendar/BookingStatusPopover'
import Calendar from './Calendar'
import { AdminSectionNavItem, type AdminSection } from '../components/admin/AdminSectionNavItem'
import { loadSessionsWindow, type SessionCategory, type SessionListItem } from '../domain/sessions/queries'
import { ExportButtons, PageHeader, toExportColumns } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle, Briefcase, CalendarDays, ChevronDown, Loader2, Pencil, Plus, UserSquare } from 'lucide-react'
import { adminSessionColumns } from '../lib/columns/adminSessionColumns'
import { adminSessionKeys, fetchAllSessions } from '../lib/queries/adminSessions'

// PR #15 — matches the highlight-task pattern in MyTasksCard. When a
// session-assign notification is clicked elsewhere in the app, the
// notification widget dispatches `highlight-session` with a sessionId,
// navigates here, and this page scrolls + flashes the matching row.
const HIGHLIGHT_EVENT = 'highlight-session'
const HIGHLIGHT_DURATION_MS = 1600

/* ── Booking categories ── */
const CATEGORIES: readonly ('All' | SessionCategory)[] = [
  'All', 'Engineer', 'Consult', 'Trailing', 'Music Lesson', 'Education',
] as const
type CategoryTab = typeof CATEGORIES[number]

// 2026-05-17 (Sessions polish #2) — third tab "calendar" embeds the
// /calendar page's week view inside the right pane. Top-nav Calendar
// entry stays during the preview so the user can compare and decide
// whether to merge them.
type ViewTab = 'bookings' | 'calendar' | 'clients'

const SECTIONS: AdminSection<ViewTab>[] = [
  { key: 'bookings', icon: Briefcase,    title: 'Bookings',  subtitle: 'Upcoming + past sessions list' },
  { key: 'calendar', icon: CalendarDays, title: 'Calendar',  subtitle: 'Week-view grid + booking blocks' },
  { key: 'clients',  icon: UserSquare,   title: 'Clients',   subtitle: 'Roster of people who book sessions' },
]

/* ── Status pill — tonal, button-shaped so it's obvious you can click it.
   Wrapped in BookingStatusPopover at the call site (PR #158); this is
   purely the visual trigger. Emerald/amber/rose hues are status
   semantics (those three are reserved away from the future priority
   palette so they don't clash). The chevron-down caret + ring + hover
   deepen telegraph "menu opens here." Completed shows the same chrome
   minus the chevron since the popover doesn't surface for terminal
   states. ── */
function StatusLabel({ status }: { status: string }) {
  const lower = status.toLowerCase()
  const tone =
    lower === 'confirmed' || lower === 'completed'
      ? { bg: 'bg-emerald-500/10', text: 'text-emerald-300', ring: 'ring-emerald-500/30', dot: 'bg-emerald-400', hover: 'hover:bg-emerald-500/20' }
      : lower === 'pending'
        ? { bg: 'bg-amber-500/10', text: 'text-amber-300', ring: 'ring-amber-500/30', dot: 'bg-amber-400', hover: 'hover:bg-amber-500/20' }
        : lower === 'cancelled'
          ? { bg: 'bg-rose-500/10', text: 'text-rose-300', ring: 'ring-rose-500/30', dot: 'bg-rose-400', hover: 'hover:bg-rose-500/20' }
          : { bg: 'bg-text-light/10', text: 'text-text-muted', ring: 'ring-border', dot: 'bg-text-light', hover: 'hover:bg-text-light/20' }
  const isTerminal = lower === 'completed'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${tone.bg} ${tone.text} ${tone.ring} ${isTerminal ? '' : tone.hover}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
      <span>{status}</span>
      {!isTerminal && <ChevronDown size={11} strokeWidth={2.5} aria-hidden="true" className="opacity-70" />}
    </span>
  )
}

export default function Sessions() {
  useDocumentTitle('Booking Agent - Checkmark Workspace')
  const { isAdmin } = useAuth()

  // 2026-05-17 — admin-only fetch of the full sessions library for
  // CSV/PDF export. Distinct from `loadSessionsWindow` (used by the
  // member-accessible carousel below) because exports want the
  // complete row shape — client, room, status, assigned_to_name,
  // notes, google_event_id, etc. Lazy-enabled via the `enabled` gate
  // so members never trigger the admin-only RPC. Includes past
  // sessions by default because exports are usually retrospective
  // reports.
  const adminSessionsQuery = useQuery({
    queryKey: adminSessionKeys.list(true),
    queryFn: () => fetchAllSessions({ includePast: true }),
    enabled: isAdmin === true,
    staleTime: 60_000,
  })
  const allAdminSessions = adminSessionsQuery.data ?? []

  // PR #64 — top-level tab state. URL hash drives initial value so
  // deep links work (`#clients`, `#calendar`). Sessions polish #2
  // (2026-05-17) added `#calendar` as the third tab.
  const [view, setView] = useState<ViewTab>(() => {
    if (typeof window === 'undefined') return 'bookings'
    if (window.location.hash === '#clients') return 'clients'
    if (window.location.hash === '#calendar') return 'calendar'
    return 'bookings'
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const next = view === 'bookings' ? '' : `#${view}`
    if (window.location.hash !== next) {
      history.replaceState(null, '', `${window.location.pathname}${next}`)
    }
  }, [view])

  const [activeCategory, setActiveCategory] = useState<CategoryTab>('All')
  const [showBooking, setShowBooking] = useState(false)
  // PR #158 — Reschedule from the BookingStatusPopover opens
  // CreateBookingModal in edit mode (mirror of Calendar.tsx).
  const [editSessionId, setEditSessionId] = useState<string | null>(null)
  const [showAdminEdit, setShowAdminEdit] = useState(false)
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Highlight-session pipeline: row refs + currently-flashing id.
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const pendingHighlightRef = useRef<string | null>(null)

  // PR #64 — opener for the Clients-tab "+ Add Client" header button.
  // ClientsPanel registers its open-editor function via this ref so
  // the page-header action button can fire it without prop-drilling.
  const openAddClientRef = useRef<(() => void) | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const next = await loadSessionsWindow()
      setSessions(next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const applyHighlight = useCallback((sessionId: string) => {
    const node = rowRefs.current.get(sessionId)
    if (!node) {
      pendingHighlightRef.current = sessionId
      return
    }
    pendingHighlightRef.current = null
    setHighlightedId(sessionId)
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => setHighlightedId(null), HIGHLIGHT_DURATION_MS)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId?: string }>).detail
      if (!detail?.sessionId) return
      // Snap to bookings view so the highlight is actually visible.
      setView('bookings')
      applyHighlight(detail.sessionId)
    }
    window.addEventListener(HIGHLIGHT_EVENT, handler)
    return () => window.removeEventListener(HIGHLIGHT_EVENT, handler)
  }, [applyHighlight])

  useEffect(() => {
    const pending = pendingHighlightRef.current
    if (pending && rowRefs.current.has(pending)) {
      applyHighlight(pending)
    }
  }, [sessions, applyHighlight])

  const filtered = activeCategory === 'All'
    ? sessions
    : sessions.filter((row) => row.category === activeCategory)

  // 2026-05-17 (Sessions polish #2) — section-specific header action.
  // Bookings tab: "Book a Session" gold CTA (always for members, kept
  // for admins too — Manage Bookings + Export live inside the tab on
  // the category-pill row).
  // Calendar tab: same "Book a Session" CTA (the calendar tab needs a
  // way to start a booking without forcing the user back to Bookings).
  // Clients tab: "Add Client" gold CTA.
  const headerAction =
    view === 'clients' ? (
      <button
        type="button"
        onClick={() => openAddClientRef.current?.()}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-gold text-black text-[13px] font-extrabold tracking-tight hover:bg-gold-muted transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-ring"
      >
        <Plus size={14} strokeWidth={2.4} />
        Add Client
      </button>
    ) : view === 'calendar' ? (
      <button
        type="button"
        onClick={() => setShowBooking(true)}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-gold text-black text-[13px] font-extrabold tracking-tight hover:bg-gold-muted transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-ring"
      >
        <Plus size={14} strokeWidth={2.4} />
        Book a Session
      </button>
    ) : null

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {showBooking && <CreateBookingModal onClose={() => { setShowBooking(false); void refetch() }} />}
      {editSessionId && (
        <CreateBookingModal
          editSessionId={editSessionId}
          onClose={() => { setEditSessionId(null); void refetch() }}
        />
      )}
      {showAdminEdit && (
        <AdminEditSessionsModal
          onClose={() => {
            setShowAdminEdit(false)
            void refetch()
          }}
        />
      )}

      <PageHeader
        icon={Briefcase}
        title="Booking"
        actions={headerAction}
      />

      {/* 2026-05-17 (Sessions polish #2) — two-pane layout modeled on
          the AdminSettings + Members admin chrome: 280px left section
          rail + right pane that hosts the active tab's content.
          Bookings · Calendar · Clients live as peer sections. The
          top-nav `/calendar` route stays intact during the preview so
          the user can decide whether to fully merge Calendar into the
          Booking menu item (and drop the separate top-nav entry). */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* ── Left rail: section nav ── */}
        <aside
          className="bg-surface rounded-xl border border-border p-2 space-y-1"
          aria-label="Booking page sections"
        >
          <p className="px-3 pt-3 pb-2 text-label">Booking</p>
          {SECTIONS.map((section) => (
            <AdminSectionNavItem
              key={section.key}
              section={section}
              active={view === section.key}
              onSelect={() => setView(section.key)}
            />
          ))}
        </aside>

        {/* ── Right pane: active section content ── */}
        <section className="min-w-0">
          {view === 'bookings' && (
            <div className="space-y-4">
              {/* Bookings sub-toolbar — category pills on the LEFT,
                  Export + Manage + Book CTAs justified to the RIGHT.
                  Used to live in the PageHeader's child slot; lifted
                  into the tab body so each section owns its own
                  sub-toolbar (Calendar's week-nav + Clients' search
                  follow the same pattern). */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORIES.map((cat) => {
                    const active = activeCategory === cat
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`inline-flex items-center h-9 px-3.5 rounded-[22px] text-[13px] font-semibold transition-all focus-ring whitespace-nowrap ${
                          active
                            ? 'text-gold bg-gradient-to-b from-gold/18 to-gold/8 ring-1 ring-gold/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                            : 'text-text-muted hover:text-text hover:bg-surface-hover'
                        }`}
                      >
                        {cat}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end ml-auto">
                  {isAdmin && (
                    <ExportButtons
                      filename="bookings"
                      title="Bookings"
                      columns={toExportColumns(adminSessionColumns)}
                      rows={allAdminSessions}
                      disabled={adminSessionsQuery.isLoading}
                    />
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowAdminEdit(true)}
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 w-[200px] rounded-2xl border-2 border-gold-muted bg-gold/12 text-gold text-[13px] font-bold tracking-tight hover:bg-gold/20 hover:border-gold transition-all focus-ring"
                      title="Edit or cancel existing bookings"
                    >
                      <Pencil size={14} strokeWidth={2.2} />
                      Manage Bookings
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowBooking(true)}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 w-[200px] rounded-2xl bg-gold text-black text-[13px] font-extrabold tracking-tight border border-gold-muted hover:bg-gold-muted transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-ring"
                  >
                    <Plus size={14} strokeWidth={2.4} />
                    Book a Session
                  </button>
                </div>
              </div>

              <div className="widget-card overflow-hidden">
                <div className="px-5 py-4 border-b theme-divider flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-section text-text">Current bookings</h2>
                  <span className="text-caption">
                    {loading ? '…' : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
                  </span>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      {loading ? (
                        <div className="px-5 py-10 flex items-center justify-center text-text-light">
                          <Loader2 size={18} className="animate-spin" />
                        </div>
                      ) : error ? (
                        <div className="px-5 py-8 flex items-center gap-2 text-sm text-amber-300">
                          <AlertCircle size={16} />
                          <span>{error}</span>
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b theme-divider bg-surface-alt/40">
                              <th className="px-5 py-3 text-left text-label">Client</th>
                              <th className="px-5 py-3 text-left text-label">Date</th>
                              <th className="px-5 py-3 text-left text-label">Engineer</th>
                              <th className="px-5 py-3 text-left text-label">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-theme">
                            {filtered.map((booking) => (
                              <tr
                                key={booking.id}
                                ref={(node) => {
                                  if (node) rowRefs.current.set(booking.id, node)
                                  else rowRefs.current.delete(booking.id)
                                }}
                                className={`hover:bg-surface-hover transition-colors ${
                                  highlightedId === booking.id
                                    ? 'ring-2 ring-gold/80 ring-inset bg-gold/5'
                                    : ''
                                }`}
                              >
                                <td className="px-5 py-4">
                                  <p className="text-[14px] font-medium text-text tracking-tight">{booking.client}</p>
                                  <p className="text-[11px] text-text-light">{booking.description}</p>
                                </td>
                                <td className="px-5 py-4">
                                  <p className="text-[13px] text-text-muted">{booking.date}</p>
                                  <p className="text-[11px] text-text-light">{booking.startTime} – {booking.endTime}</p>
                                </td>
                                <td className="px-5 py-4">
                                  <p className="text-[13px] text-text-muted">{booking.engineer}</p>
                                  <p className="text-[11px] text-text-light">{booking.studio}</p>
                                </td>
                                <td className="px-5 py-4">
                                  <BookingStatusPopover
                                    sessionId={booking.id}
                                    status={booking.status}
                                    onChanged={() => void refetch()}
                                    onReschedule={() => setEditSessionId(booking.id)}
                                  >
                                    <StatusLabel status={booking.status} />
                                  </BookingStatusPopover>
                                </td>
                              </tr>
                            ))}
                            {filtered.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-5 py-10 text-center text-text-muted text-sm">
                                  No bookings {activeCategory === 'All' ? 'yet' : `in ${activeCategory}`}.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'calendar' && (
            // Renders the SAME Calendar page component used at `/calendar`
            // (single source of truth — booking blocks, day card, week
            // nav, modals, right-click delete menu). `embedded` skips
            // the outer max-w wrapper + the page H1 so the calendar
            // slots cleanly inside this pane.
            <Calendar embedded />
          )}

          {view === 'clients' && (
            <ClientsPanel
              registerAddClient={(open) => {
                openAddClientRef.current = open
              }}
            />
          )}
        </section>
      </div>
    </div>
  )
}

// 2026-05-17 (Sessions polish #2) — removed `ViewToggleButton`. The
// inline pill-tab pattern was replaced by the AdminSectionNavItem
// left rail, which carries icons + title + subtitle and matches the
// Settings/Assign pages chrome convention.
