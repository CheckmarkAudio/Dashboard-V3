import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTeamSchedule } from '../lib/schedule/useTeamSchedule'
import { toLocalDateString } from '../lib/schedule/expand'
import { buildActivityDay, type SegmentKind } from '../lib/activity/buildActivityDay'
import {
  fetchMemberActivityEvents,
  fetchMemberPresenceSessions,
  memberActivityKeys,
  toScheduledWindows,
} from '../lib/activity/queries'

// Same fixed axis + segment palette as MyActivityTodayWidget /
// AdminTeamActivityWidget, just compressed to header-pill size.
const AXIS_START_HOUR = 7
const AXIS_END_HOUR = 21

const SEGMENT_COLOR: Record<SegmentKind, string> = {
  on: '#34d399',
  late: '#fbbf24',
  off: '#60a5fa',
}

function startOfLocalDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

/**
 * HeaderActivityBar — replaces the retired Clock In/Out button.
 *
 * A passive glance-only presence indicator: today's mini
 * presence-vs-schedule bar for the signed-in member, live-updating
 * every 60s. Clicking it opens Overview, where the full "My Activity"
 * card lives. There is no click-to-clock-in/out action here anymore —
 * presence is heartbeat-driven (usePresenceHeartbeat, mounted
 * separately in Layout), not a manual punch.
 */
export default function HeaderActivityBar() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const memberId = profile?.id ?? ''

  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  const now = new Date(nowTick)
  const dayStart = useMemo(() => startOfLocalDay(now), [nowTick]) // eslint-disable-line react-hooks/exhaustive-deps
  const dayEnd = useMemo(() => new Date(dayStart.getTime() + 24 * 60 * 60_000), [dayStart])
  const dayKey = toLocalDateString(dayStart)
  const fromIso = dayStart.toISOString()
  const toIso = dayEnd.toISOString()

  const presenceQuery = useQuery({
    queryKey: memberActivityKeys.presence(memberId, dayKey),
    queryFn: () => fetchMemberPresenceSessions(memberId, fromIso, toIso),
    enabled: Boolean(memberId),
    refetchInterval: 60_000,
  })
  const eventsQuery = useQuery({
    queryKey: memberActivityKeys.events(memberId, dayKey),
    queryFn: () => fetchMemberActivityEvents(memberId, fromIso, toIso),
    enabled: Boolean(memberId),
    refetchInterval: 60_000,
  })
  const { expanded } = useTeamSchedule({
    range: { from: dayKey, to: dayKey },
    memberId: memberId || undefined,
    includePending: false,
  })
  const scheduledWindows = useMemo(
    () => toScheduledWindows(expanded, memberId),
    [expanded, memberId],
  )

  const model = useMemo(
    () =>
      buildActivityDay({
        presenceSessions: presenceQuery.data ?? [],
        events: eventsQuery.data ?? [],
        scheduledWindows,
        dayStart,
        dayEnd,
        now,
      }),
    [presenceQuery.data, eventsQuery.data, scheduledWindows, dayStart, dayEnd, nowTick], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const isActiveNow = (presenceQuery.data ?? []).some((s) => s.ended_at === null)

  const axisStartMs = dayStart.getTime() + AXIS_START_HOUR * 3600_000
  const axisEndMs = dayStart.getTime() + AXIS_END_HOUR * 3600_000
  const pct = (ms: number) => {
    const p = ((ms - axisStartMs) / (axisEndMs - axisStartMs)) * 100
    return Math.max(0, Math.min(100, p))
  }

  if (!memberId) return null

  const title = isActiveNow
    ? `Active today · ${model.activeMinutes}m so far`
    : 'My Activity today'

  return (
    <button
      type="button"
      onClick={() => navigate('/')}
      className="hidden shrink-0 items-center gap-2 h-10 px-3 rounded-2xl bg-gold/12 text-gold border border-gold/25 hover:bg-gold/20 transition-all focus-ring sm:flex"
      title={title}
      aria-label={title}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isActiveNow ? 'bg-emerald-400 animate-pulse' : 'bg-text-light'}`}
        aria-hidden="true"
      />
      <div className="relative h-2 w-[84px] rounded-full bg-surface-alt/70" aria-hidden="true">
        {model.scheduledWindow && (
          <div
            className="absolute top-0 h-full rounded-full border border-dashed border-gold/40"
            style={{
              left: `${pct(Date.parse(model.scheduledWindow.start))}%`,
              width: `${Math.max(2, pct(Date.parse(model.scheduledWindow.end)) - pct(Date.parse(model.scheduledWindow.start)))}%`,
            }}
          />
        )}
        {model.segments.map((s, i) => {
          const left = pct(Date.parse(s.start))
          const right = pct(Date.parse(s.end))
          return (
            <div
              key={i}
              className="absolute top-0 h-full rounded-full"
              style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%`, background: SEGMENT_COLOR[s.kind] }}
            />
          )
        })}
        <div
          className="absolute top-[-1px] h-[10px] w-[2px] rounded-full bg-gold"
          style={{ left: `${pct(now.getTime())}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold tabular-nums">
        {isActiveNow ? 'Active' : 'My Activity'}
      </span>
    </button>
  )
}
