import { useCallback, useEffect, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import CreateBookingModal from '../components/CreateBookingModal'
import { loadSessionsWindow, type SessionCategory, type SessionListItem } from '../domain/sessions/queries'
import { ExternalLink, AlertCircle, Loader2 } from 'lucide-react'

/* ── Booking categories ── */
const CATEGORIES: readonly ('All' | SessionCategory)[] = [
  'All', 'Engineer', 'Consult', 'Trailing', 'Music Lesson', 'Education',
] as const
type CategoryTab = typeof CATEGORIES[number]

/* ── Status dot ── */
function StatusLabel({ status }: { status: string }) {
  const lower = status.toLowerCase()
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-text-muted">
      {lower === 'confirmed' && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
      {lower === 'completed' && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
      {lower === 'pending' && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
      {lower === 'cancelled' && <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />}
      {status}
    </span>
  )
}

export default function Sessions() {
  useDocumentTitle('Booking Agent - Checkmark Audio')
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('All')
  const [showBooking, setShowBooking] = useState(false)
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const filtered = activeCategory === 'All'
    ? sessions
    : sessions.filter((row) => row.category === activeCategory)

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <h1 className="text-[28px] font-extrabold tracking-tight text-text">Manage studio bookings</h1>

      {/* Top category tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
              activeCategory === cat
                ? 'bg-gold text-black border-gold'
                : 'bg-surface border-border text-text-muted hover:text-text hover:border-border-light'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Book a Session CTA.
          Phase A migration (April 2026): CreateBookingModal now inserts
          directly into the Supabase `sessions` table and runs an async
          conflict check via findSessionConflict. Page refetches on
          modal close so the new row shows in the table below. Recurring
          (Weekly/Monthly) is disabled in the modal pending Phase B
          (Weekly Approval workflow, separate task). */}
      {showBooking && <CreateBookingModal onClose={() => { setShowBooking(false); void refetch() }} />}
      <button
        onClick={() => setShowBooking(true)}
        className="w-full py-3.5 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-bold flex items-center justify-center gap-2 transition-colors"
      >
        Book a Session
        <ExternalLink size={15} />
      </button>

      {/* Current bookings */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-text">Current bookings</h2>
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium tracking-tight transition-all ${
                  activeCategory === cat
                    ? 'text-gold'
                    : 'text-text-light hover:text-text-muted'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
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
                <tr className="border-b border-border/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Client</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Engineer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((booking) => (
                  <tr key={booking.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-[14px] font-medium text-text tracking-tight">{booking.client}</p>
                      <p className="text-[11px] text-text-light">{booking.description}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] text-text-muted">{booking.date}</p>
                      <p className="text-[11px] text-text-light">{booking.startTime} – {booking.endTime}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] text-text-muted">{booking.engineer}</p>
                      <p className="text-[11px] text-text-light">{booking.studio}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusLabel status={booking.status} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-text-muted text-sm">
                      No bookings for this category yet.
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
