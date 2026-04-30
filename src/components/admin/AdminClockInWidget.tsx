import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Loader2, Users } from 'lucide-react'
import {
  fetchCurrentlyClockedIn,
  timeClockKeys,
  type CurrentlyClockedInRow,
} from '../../lib/queries/timeClock'

/**
 * AdminClockInWidget — "Who's on the clock" (PR #50, Lean 1).
 *
 * Lists every team member currently clocked in, with a live "1h 23m"
 * elapsed counter per row that ticks every minute. Single RPC call
 * (`admin_currently_clocked_in`) keeps the widget cheap. Refetches
 * every 60s so a clock-in/out from another tab surfaces here.
 *
 * Designed to slot into the admin Hub page as a small companion to
 * the existing Team widget — gives the admin a glance-able answer to
 * "is anyone working right now?"
 */
export default function AdminClockInWidget() {
  const query = useQuery({
    queryKey: timeClockKeys.currentlyClockedIn(),
    queryFn: fetchCurrentlyClockedIn,
    // Cheap RPC; refresh once a minute so admins see new clock-ins
    // without needing to refresh the page.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  // Re-render every 60s to tick the elapsed-time strings forward.
  // We don't drive this from `now` state because that would force
  // every consumer of useEffect to rerun; this is a local counter
  // that the formatElapsed() helper reads at render time.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const rows = query.data ?? []

  return (
    <div className="flex flex-col h-full min-h-0">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-gold/70 mb-2 shrink-0">
        ON THE CLOCK · {rows.length}
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        {query.isLoading ? (
          <div className="h-full flex items-center justify-center text-text-light">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : query.error ? (
          <p className="py-4 text-center text-[12px] text-rose-300">
            Could not load shifts.
          </p>
        ) : rows.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-center">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-surface ring-1 ring-border mb-2">
              <Users size={16} className="text-text-light" aria-hidden="true" />
            </div>
            <p className="text-[12px] text-text-light">No one's clocked in.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <ClockedInRow key={r.entry_id} row={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ClockedInRow({ row }: { row: CurrentlyClockedInRow }) {
  const initial = row.display_name?.charAt(0)?.toUpperCase() ?? '?'
  return (
    <li
      className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-surface/60 ring-1 ring-border/60 hover:bg-surface-hover hover:ring-gold/30 transition-colors"
    >
      {/* Avatar — initial in a small gold-tinted circle */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-gold/15 ring-1 ring-gold/30 text-gold flex items-center justify-center text-[12px] font-bold">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-text truncate">
          {row.display_name}
        </p>
        <p className="text-[11px] text-text-light flex items-center gap-1">
          <Clock size={10} aria-hidden="true" />
          since {formatTimeOfDay(row.clocked_in_at)}
        </p>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/12 ring-1 ring-emerald-500/30 text-emerald-300 text-[10px] font-bold tabular-nums">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
        {formatElapsed(row.clocked_in_at)}
      </span>
    </li>
  )
}

function formatTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** "5m" · "1h 23m" · "8h" · "1d 4h" — keeps the pill compact. */
function formatElapsed(iso: string): string {
  const start = new Date(iso).getTime()
  const now = Date.now()
  const ms = Math.max(0, now - start)
  const totalMin = Math.floor(ms / 60_000)
  if (totalMin < 60) return `${totalMin}m`
  const totalHours = Math.floor(totalMin / 60)
  if (totalHours < 24) {
    const m = totalMin % 60
    return m === 0 ? `${totalHours}h` : `${totalHours}h ${m}m`
  }
  const days = Math.floor(totalHours / 24)
  const h = totalHours % 24
  return h === 0 ? `${days}d` : `${days}d ${h}h`
}
