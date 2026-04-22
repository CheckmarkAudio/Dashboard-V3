import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import CreateBookingModal from '../components/CreateBookingModal'
import { loadSessionsWindow, type SessionCategory, type SessionListItem } from '../domain/sessions/queries'
import { PageHeader } from '../components/ui'
import { AlertCircle, Briefcase, Loader2, Plus } from 'lucide-react'

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
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('All')
  const [showBooking, setShowBooking] = useState(false)
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Highlight-session pipeline: row refs + currently-flashing id.
  // Clears itself after HIGHLIGHT_DURATION_MS so the ring fades.
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  // Remember a pending highlight if the event fires before sessions
  // have loaded — otherwise the row isn't in rowRefs yet.
  const pendingHighlightRef = useRef<string | null>(null)

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

  // Resolve a pending highlight once sessions land. This covers the
  // common flow: click notification → navigate to /sessions → page
  // mounts → event fires → rowRefs still empty → we buffer the id
  // and flash it once sessions hydrate.
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
      applyHighlight(detail.sessionId)
    }
    window.addEventListener(HIGHLIGHT_EVENT, handler)
    return () => window.removeEventListener(HIGHLIGHT_EVENT, handler)
  }, [applyHighlight])

  // When the sessions list updates, flush any pending highlight that
  // couldn't resolve earlier (e.g. event fired before data loaded).
  useEffect(() => {
    const pending = pendingHighlightRef.current
    if (pending && rowRefs.current.has(pending)) {
      applyHighlight(pending)
    }
  }, [sessions, applyHighlight])

  const filtered = activeCategory === 'All'
    ? sessions
    : sessions.filter((row) => row.category === activeCategory)

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {showBooking && <CreateBookingModal onClose={() => { setShowBooking(false); void refetch() }} />}

      <PageHeader
        icon={Briefcase}
        title="Booking"
        subtitle="Manage studio bookings — recording, mixing, lessons, and consults."
        actions={
          <button
            onClick={() => setShowBooking(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-b from-gold to-gold-muted text-black text-[13px] font-extrabold hover:brightness-105 transition-all shadow-[0_14px_28px_rgba(214,170,55,0.22)]"
          >
            <Plus size={14} strokeWidth={2.2} />
            Book a Session
          </button>
        }
      >
        {/* Category pills — same gold-gradient active state as the top nav. */}
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
      </PageHeader>

      {/* Bookings card — widget-card surface so it matches the rest of the app. */}
      <div className="widget-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-section text-text">Current bookings</h2>
          <span className="text-caption">
            {loading ? '…' : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {/* Table */}
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
    </div>
  )
}
