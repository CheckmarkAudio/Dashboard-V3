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
// AdminTeamActivityWidget.
const AXIS_START_HOUR = 7
const AXIS_END_HOUR = 21
// Context ticks under the bar — not evenly spaced in hours, just
// enough landmarks to read the bar as a real timeline at a glance.
const AXIS_TICKS = [7, 11, 15, 19, 21]

const SEGMENT_FILL: Record<SegmentKind, string> = {
  on: 'linear-gradient(90deg, #22c98e, #34d399)',
  late: '#fbbf24',
  off: '#60a5fa',
}

function startOfLocalDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function hourLabel(h: number): string {
  const hr = ((h + 11) % 12) + 1
  return `${hr}${h < 12 || h === 24 ? 'a' : 'p'}`
}

function formatActiveMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/**
 * HeaderActivityBar — replaces the retired Clock In/Out button.
 *
 * A passive glance-only presence indicator: today's presence-vs-
 * schedule timeline for the signed-in member, live-updating every
 * 60s. Clicking it opens Overview, where the full "My Activity" card
 * lives. There is no click-to-clock-in/out action here anymore —
 * presence is heartbeat-driven (usePresenceHeartbeat, mounted
 * separately in Layout), not a manual punch.
 *
 * v2 (2026-07-26) — director feedback on v1: "very hard to see... the
 * time thing [is] puny, give it a soul." Solid (non-transparent) fill,
 * a real gold border, a bigger timeline (was 84px) with a glowing
 * "now" marker and hour-tick context underneath, and a bold two-line
 * label instead of a single muted word.
 *
 * v3 (2026-07-26) — further feedback: "there's a lot of space, fill
 * it more" (timeline 320px → 520px) and the scheduled-hours band read
 * as too tentative — "it shouldn't be translucent really since it is
 * a concrete scheduled time... treated more set than potential" (was
 * a dashed outline with no fill; now a solid gold-tinted block).
 * Also moved to render BEFORE the theme toggle in Layout.tsx.
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
  const nowPct = pct(now.getTime())

  if (!memberId) return null

  const title = isActiveNow
    ? `Active now · ${formatActiveMinutes(model.activeMinutes)} today`
    : 'My Activity today'

  return (
    <button
      type="button"
      onClick={() => navigate('/')}
      // `.widget-card` is the same shared, theme-aware chrome every
      // panel in the app already uses (dark: surface-alt→surface
      // gradient + soft white border; light: flat white + border-
      // border, no shadow) -- reusing it directly is what actually
      // makes this control belong here instead of reading as a
      // custom one-off. The gold ring is layered ON TOP for a touch
      // of brand distinction + interactivity, not baked into the
      // base chrome.
      className="widget-card hidden shrink-0 items-center gap-4 h-[72px] px-5 ring-1 ring-gold/20 hover:ring-gold/40 hover:-translate-y-0.5 transition-all focus-ring lg:flex"
      title={title}
      aria-label={title}
    >
      <span className="relative shrink-0 flex items-center justify-center w-[10px] h-[10px]" aria-hidden="true">
        <span className={`absolute inset-0 rounded-full ${isActiveNow ? 'bg-emerald-400' : 'bg-text-light'}`} />
        {isActiveNow && (
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
        )}
      </span>

      <div className="flex flex-col items-start gap-1.5">
        <span className="text-[13px] font-bold text-text tracking-tight tabular-nums whitespace-nowrap">
          {title}
        </span>

        {/* Recessed groove — `bg-border` gives correct "recessed
            below the card" contrast in BOTH themes from one token
            (dark border #34343d is lighter than the card behind it;
            light border #dedee5 is darker than the white card), vs.
            a hardcoded hex that only ever reads right in one theme. */}
        <div className="relative h-[11px] w-[520px] rounded-md bg-border shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]" aria-hidden="true">
          {model.scheduledWindow && (
            // Solid fill, not a dashed outline — this is a real,
            // committed scheduled window, not a maybe. Presence
            // segments (below) paint on top in their own vivid
            // colors wherever actual activity occurred.
            <div
              className="absolute top-0 h-full rounded-md bg-gold/35 border border-gold/80"
              style={{
                left: `${pct(Date.parse(model.scheduledWindow.start))}%`,
                width: `${Math.max(1.5, pct(Date.parse(model.scheduledWindow.end)) - pct(Date.parse(model.scheduledWindow.start)))}%`,
              }}
            />
          )}
          {model.segments.map((s, i) => {
            const left = pct(Date.parse(s.start))
            const right = pct(Date.parse(s.end))
            return (
              <div
                key={i}
                className="absolute top-0 h-full rounded-md"
                style={{ left: `${left}%`, width: `${Math.max(1.5, right - left)}%`, background: SEGMENT_FILL[s.kind] }}
              />
            )
          })}
          {/* Glowing "now" marker — tick + halo dot */}
          <div
            className="absolute top-[-4px] w-[3px] h-[19px] rounded-sm bg-gold shadow-[0_0_8px_2px_rgba(201,168,76,0.55)]"
            style={{ left: `${nowPct}%` }}
          />
          <div
            className="absolute top-[-9px] w-[9px] h-[9px] -ml-[3px] rounded-full bg-gold shadow-[0_0_10px_3px_rgba(201,168,76,0.5)]"
            style={{ left: `${nowPct}%` }}
          />
        </div>

        <div className="flex justify-between w-[520px] text-[9px] text-text-light tracking-wide">
          {AXIS_TICKS.map((h) => (
            <span key={h}>{hourLabel(h)}</span>
          ))}
        </div>
      </div>
    </button>
  )
}
