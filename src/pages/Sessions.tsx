import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import CreateBookingModal from '../components/CreateBookingModal'
import ClientsPanel from '../components/clients/ClientsPanel'
import { loadSessionsWindow, type SessionCategory, type SessionListItem } from '../domain/sessions/queries'
import { PageHeader } from '../components/ui'
import { AlertCircle, Briefcase, Loader2, Plus, UserSquare } from 'lucide-react'

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

type ViewTab = 'bookings' | 'clients'

/* ── Status dot (emerald/amber/red used as status semantics — those
   three hues are reserved for the future priority system, so status
   readings align with that palette naturally). ── */
function StatusLabel({ status }: { status: string }) {
  const lower = status.toLowerCase()
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-text-muted">
      {lower === 'confirmed' && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
      {lower === 'completed' && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
      {lower === 'pending'   && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
      {lower === 'cancelled' && <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />}
      {status}
    </span>
  )
}

export default function Sessions() {
  useDocumentTitle('Booking Agent - Checkmark Workspace')

  // PR #64 — top-level Bookings ↔ Clients toggle. Replaces the
  // standalone /admin/clients page (which the user asked to retire).
  // URL hash drives the initial state so a deep link (or the booking-
  // modal "Manage clients" hint) can jump straight to the Clients view.
  const [view, setView] = useState<ViewTab>(() =>
    typeof window !== 'undefined' && window.location.hash === '#clients' ? 'clients' : 'bookings',
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const next = view === 'clients' ? '#clients' : ''
    if (window.location.hash !== next) {
      history.replaceState(null, '', `${window.location.pathname}${next}`)
    }
  }, [view])

  const [activeCategory, setActiveCategory] = useState<CategoryTab>('All')
  const [showBooking, setShowBooking] = useState(false)
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

  // PR #65 — same gold-CTA shape as the Overview Book a Session button.
  // h-10 / px-4 / rounded-2xl + lighter shadow `0_6px_14px_18%` (was
  // `0_14px_28px_22%` — way too feathery per user feedback).
  const headerAction =
    view === 'bookings' ? (
      <button
        type="button"
        onClick={() => setShowBooking(true)}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-gradient-to-b from-gold to-gold-muted text-black text-[13px] font-extrabold tracking-tight hover:brightness-105 transition-all shadow-[0_6px_14px_rgba(214,170,55,0.18)] focus-ring"
      >
        <Plus size={14} strokeWidth={2.4} />
        Book a Session
      </button>
    ) : (
      <button
        type="button"
        onClick={() => openAddClientRef.current?.()}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-gradient-to-b from-gold to-gold-muted text-black text-[13px] font-extrabold tracking-tight hover:brightness-105 transition-all shadow-[0_6px_14px_rgba(214,170,55,0.18)] focus-ring"
      >
        <Plus size={14} strokeWidth={2.4} />
        Add Client
      </button>
    )

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {showBooking && <CreateBookingModal onClose={() => { setShowBooking(false); void refetch() }} />}

      <PageHeader
        icon={Briefcase}
        title="Booking"
        actions={headerAction}
      >
        {/* View toggle — Bookings / Clients. Sits in the page-header
            child slot so it stays anchored to the title row, just like
            the category pills used to. Same gold-gradient active state
            as the top nav for visual consistency. */}
        <div
          role="tablist"
          aria-label="Booking page view"
          className="flex gap-1.5"
        >
          <ViewToggleButton
            active={view === 'bookings'}
            onClick={() => setView('bookings')}
            icon={<Briefcase size={14} aria-hidden="true" />}
            label="Bookings"
          />
          <ViewToggleButton
            active={view === 'clients'}
            onClick={() => setView('clients')}
            icon={<UserSquare size={14} aria-hidden="true" />}
            label="Clients"
          />
        </div>

        {/* Bookings-only sub-row: category pills. */}
        {view === 'bookings' && (
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
                      : 'text-text-muted hover:text-text hover:bg-white/[0.03]'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        )}
      </PageHeader>

      {view === 'bookings' ? (
        <div className="widget-card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-section text-text">Current bookings</h2>
            <span className="text-caption">
              {loading ? '…' : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
            </span>
          </div>

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
                  <tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-label">Client</th>
                    <th className="px-5 py-3 text-left text-label">Date</th>
                    <th className="px-5 py-3 text-left text-label">Engineer</th>
                    <th className="px-5 py-3 text-left text-label">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((booking) => (
                    <tr
                      key={booking.id}
                      ref={(node) => {
                        if (node) rowRefs.current.set(booking.id, node)
                        else rowRefs.current.delete(booking.id)
                      }}
                      className={`hover:bg-white/[0.03] transition-colors ${
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
                        <StatusLabel status={booking.status} />
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
      ) : (
        <ClientsPanel
          registerAddClient={(open) => {
            openAddClientRef.current = open
          }}
        />
      )}
    </div>
  )
}

function ViewToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[22px] text-[13px] font-semibold transition-all focus-ring whitespace-nowrap ${
        active
          ? 'text-gold bg-gradient-to-b from-gold/18 to-gold/8 ring-1 ring-gold/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'text-text-muted hover:text-text hover:bg-white/[0.03]'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
