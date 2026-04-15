import { useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTasks } from '../contexts/TaskContext'
import CreateBookingModal from '../components/CreateBookingModal'
import { ExternalLink } from 'lucide-react'

/* ── Booking categories (matching mockup tabs) ── */
const CATEGORIES = ['Engineer', 'Consult', 'Trailing', 'Music Lesson', 'Education'] as const
type Category = typeof CATEGORIES[number]

/* ── Booking status colors ── */
const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Confirmed: { color: '#34d399', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)' },
  Pending:   { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)' },
  Cancelled: { color: '#f87171', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.4)' },
}

/* ── Placeholder bookings (matching mockup) ── */
// No hardcoded bookings — all data comes from TaskContext (single source of truth)
const BOOKINGS: { id: string; client: string; date: string; engineer: string; status: string; category: Category }[] = []

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.Pending
  return (
    <span
      className="text-[11px] font-semibold px-3 py-1 rounded-full border"
      style={{ color: style.color, backgroundColor: style.bg, borderColor: style.border }}
    >
      {status}
    </span>
  )
}

const BOOKING_TYPE_TO_CATEGORY: Record<string, Category> = {
  engineering: 'Engineer',
  training: 'Trailing',
  education: 'Education',
  music_lesson: 'Music Lesson',
  consultation: 'Consult',
}

export default function Sessions() {
  useDocumentTitle('Booking Agent - Checkmark Audio')
  const { bookings } = useTasks()
  const [activeCategory, setActiveCategory] = useState<Category>('Engineer')
  const [showBooking, setShowBooking] = useState(false)

  // Merge mock BOOKINGS with context bookings
  const contextBookings = bookings.map(b => ({
    id: b.id,
    client: `${b.client} - ${b.description}`,
    date: `${b.date}, ${b.startTime} - ${b.endTime}`,
    engineer: `${b.assignee} (${b.studio})`,
    status: b.status,
    category: BOOKING_TYPE_TO_CATEGORY[b.type] ?? ('Engineer' as Category),
  }))
  const allBookings = [...BOOKINGS, ...contextBookings.filter(cb => !BOOKINGS.some(mb => mb.id === cb.id))]
  const filtered = allBookings.filter(b => b.category === activeCategory)

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

      {/* Book a Session CTA */}
      {showBooking && <CreateBookingModal onClose={() => setShowBooking(false)} />}
      <button
        onClick={() => setShowBooking(true)}
        className="w-full py-3.5 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-bold flex items-center justify-center gap-2 transition-colors"
      >
        Book a Session
        <ExternalLink size={15} />
      </button>

      {/* Current bookings */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Current bookings</h2>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-gold/15 text-gold border border-gold/30'
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
                  <td className="px-5 py-3.5 text-text font-medium">{booking.client}</td>
                  <td className="px-5 py-3.5 text-text-muted">{booking.date}</td>
                  <td className="px-5 py-3.5 text-text-muted">{booking.engineer}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={booking.status} />
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
        </div>
      </div>
    </div>
  )
}
