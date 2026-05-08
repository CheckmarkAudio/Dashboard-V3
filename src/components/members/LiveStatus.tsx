import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Coffee, Loader2, Radio } from 'lucide-react'
import { useMemberLiveStatus, type LiveSessionInfo } from '../../lib/queries/memberProfile'

/**
 * Live status row, shown on the profile hero under the name.
 *
 * States:
 *   - 'in-session'     → Red pulsing dot · "In <room> · <title> · ends <relative>"
 *   - 'upcoming-today' → Amber dot · "Up next at <time> · <title>"
 *   - 'available'      → Green dot · "Available"
 *   - 'unknown'        → Hidden while query loads / errors silently
 *
 * Pulls from `useMemberLiveStatus`, which auto-refreshes every
 * minute so the countdown stays honest and a session ending
 * mid-view flips to "Available" promptly.
 */

interface LiveStatusProps {
  memberId: string
  /** When true, render a more compact pill (for use inside hero
   *  rows that are already busy). Default = false (full row). */
  compact?: boolean
}

export default function LiveStatus({ memberId, compact = false }: LiveStatusProps) {
  const { data, isLoading } = useMemberLiveStatus(memberId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-text-light">
        <Loader2 size={11} className="animate-spin" aria-hidden="true" />
        <span>Checking schedule…</span>
      </div>
    )
  }
  if (!data) return null

  if (data.state === 'in-session' && data.current) {
    return (
      <SessionPill
        kind="active"
        info={data.current}
        compact={compact}
        prefix="In session"
        suffix="left"
      />
    )
  }
  if (data.state === 'upcoming-today' && data.next) {
    return (
      <SessionPill
        kind="upcoming"
        info={data.next}
        compact={compact}
        prefix="Up next"
      />
    )
  }
  return <AvailablePill compact={compact} />
}

// ─── Pieces ──────────────────────────────────────────────────────

function AvailablePill({ compact }: { compact: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full',
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
        'bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-300',
      ].join(' ')}
      title="No sessions on the calendar today"
    >
      <Coffee size={compact ? 10 : 12} aria-hidden="true" />
      <span className="font-semibold">Available</span>
    </span>
  )
}

function SessionPill({
  kind,
  info,
  compact,
  prefix,
  suffix,
}: {
  kind: 'active' | 'upcoming'
  info: LiveSessionInfo
  compact: boolean
  prefix: string
  suffix?: string
}) {
  const isActive = kind === 'active'
  const ts = useMemo(() => {
    const target = isActive ? Date.parse(info.endsAt) : Date.parse(info.startsAt)
    return formatRelativeShort(target)
  }, [info.endsAt, info.startsAt, isActive])

  const tone = isActive
    ? 'bg-rose-500/10 ring-rose-500/30 text-rose-300'
    : 'bg-amber-500/10 ring-amber-500/30 text-amber-300'
  const Icon = isActive ? Radio : CalendarClock

  // The label compresses room + title nicely. "Studio A · TRC"
  // when both present, "TRC" or "Studio A" if only one.
  const label = [info.room, info.title].filter(Boolean).join(' · ')

  return (
    <Link
      to="/sessions"
      className={[
        'inline-flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-80',
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
        'ring-1',
        tone,
      ].join(' ')}
      title={isActive ? `Session ends ${ts}` : `Session starts ${ts}`}
    >
      {isActive ? (
        <span className="relative inline-flex items-center justify-center" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-60" />
          <Icon size={compact ? 10 : 12} className="relative" />
        </span>
      ) : (
        <Icon size={compact ? 10 : 12} aria-hidden="true" />
      )}
      <span>
        <span className="font-semibold">{prefix}:</span>{' '}
        <span>{label}</span>
        {suffix && <span className="opacity-70"> · {ts} {suffix}</span>}
        {!suffix && <span className="opacity-70"> · {ts}</span>}
      </span>
    </Link>
  )
}

// ─── Time helpers ────────────────────────────────────────────────

/**
 * Compact relative time. Past targets read "ended Xm ago", future
 * read "in Xm" or "in Xh Ym". For the live-status pill we mostly
 * pass future-end timestamps for active sessions and future-start
 * for upcoming, so the output reads naturally either way.
 */
function formatRelativeShort(targetMs: number): string {
  const now = Date.now()
  const diffMs = targetMs - now
  const sign = diffMs >= 0 ? '' : '-'
  const abs = Math.abs(diffMs)
  const mins = Math.round(abs / 60_000)
  if (mins < 1) return sign === '' ? 'now' : 'just now'
  if (mins < 60) return `${sign}${mins}m`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (sign === '-') return `${hours}h ${remMins}m ago`
  return `${hours}h ${remMins}m`
}
