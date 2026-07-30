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

const SEGMENT_LABEL: Record<SegmentKind, string> = {
  on: 'Present',
  late: 'Late start',
  off: 'Active outside schedule',
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

function formatClockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
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
 *
 * v4 (2026-07-26) — "looking way better" but "sticks out... hovery
 * over the header... not integrated." Root cause: the `.widget-card`
 * shadow/ring/lift combo is a *content-card* pattern (a clickable
 * tile that should feel separate from the page), not a *chrome*
 * pattern (a persistent nav control that should feel like part of
 * the bar it lives in). Cross-checked how other products treat a
 * persistent status control in a nav bar — Discord's voice-connection
 * strip, Notion's presence stack, Linear's status pills, GitHub's
 * header controls — none of them use a drop shadow or hover-lift;
 * they sit flush using the bar's own hover-state color, a hairline
 * border at most, and let content (icons/color/text) carry the
 * distinction instead of the container. Applied that here: dropped
 * the shadow + gold ring + `-translate-y` lift, swapped to the same
 * solid `bg-surface-hover` tone the header's OTHER buttons already
 * use on hover (so at rest it already reads as "a control that
 * belongs to this bar," not a card that landed on it), and reduced
 * the radius to match sibling controls instead of the heavier
 * widget-card radius. Still solid/opaque per the earlier "not
 * transparent" note — the bar's own content (colored segments, gold
 * now-marker) carries the legibility now that it's large, so the
 * container no longer has to.
 *
 * v5 (2026-07-27) — director liked the always-deeper hover tone
 * better than the lighter resting one, and wants it gold-tinted
 * ("glass look is gold") rather than neutral: the container now sits
 * permanently at that gold-glass weight (frosted/blurred, translucent
 * ON PURPOSE — this is chrome, not content) instead of only reaching
 * it on hover. The gold tint is currently the one and only option;
 * "part of a customizability" (director's phrasing) reads as an
 * eventual per-user/theme setting, not something this pass builds —
 * flagged back to the director rather than guessing at a picker UI
 * that doesn't exist yet. Inside the bar, the opposite move: the
 * scheduled-window band went from a 35%-alpha tint to fully solid
 * gold (matches how the presence segments were already solid), so
 * everything that represents actual DATA reads as concrete while only
 * the container chrome is allowed to be glass. Also added native
 * hover tooltips on the scheduled band and each presence segment
 * ("Present · 10:00 AM–12:30 PM" etc.) per "when we hover over the
 * markers we need it to show us what they are" — mouse-hover only for
 * now (title attributes); a fully keyboard/touch-reachable tooltip
 * would need these to stop being plain divs inside one wrapping
 * button, which is a bigger restructure than this pass.
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
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate('/')}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          navigate('/')
        }
      }}
      // Gold glass chrome, always at the "deeper" weight (not just on
      // hover) -- blurred + translucent is fine HERE because this is
      // the container, not the data; the timeline inside stays fully
      // solid so nothing that represents real activity is ever hard
      // to read.
      className="hidden shrink-0 items-center gap-4 h-[72px] px-5 rounded-xl bg-gold/16 backdrop-blur-md border border-gold/35 hover:bg-gold/22 hover:border-gold/50 transition-colors focus-ring lg:flex"
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
        <div className="relative h-[11px] w-[520px] rounded-md bg-border shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]">
          {model.scheduledWindow && (
            // Fully solid — a committed scheduled window is data, not
            // decoration, so (unlike the glass container) it gets no
            // transparency. Presence segments paint on top in their
            // own solid colors wherever actual activity occurred.
            <div
              className="absolute top-0 h-full rounded-md bg-gold"
              style={{
                left: `${pct(Date.parse(model.scheduledWindow.start))}%`,
                width: `${Math.max(1.5, pct(Date.parse(model.scheduledWindow.end)) - pct(Date.parse(model.scheduledWindow.start)))}%`,
              }}
              title={`Scheduled · ${formatClockTime(Date.parse(model.scheduledWindow.start))}–${formatClockTime(Date.parse(model.scheduledWindow.end))}`}
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
                title={`${SEGMENT_LABEL[s.kind]} · ${formatClockTime(Date.parse(s.start))}–${formatClockTime(Date.parse(s.end))}`}
              />
            )
          })}
          {model.markers.map((marker) => {
            const markerPct = pct(Date.parse(marker.at))
            const markerTitle = `${marker.label} · ${formatClockTime(Date.parse(marker.at))}`
            return marker.href ? (
              <button
                key={marker.id}
                type="button"
                className="absolute z-20 top-[-7px] -ml-[5px] h-[10px] w-[10px] rounded-full border-2 border-surface bg-violet-400 shadow-[0_0_7px_rgba(167,139,250,0.85)] hover:scale-150 focus:scale-150 transition-transform focus-ring"
                style={{ left: `${markerPct}%` }}
                title={`${markerTitle} · Open project`}
                aria-label={`${markerTitle}. Open project.`}
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(marker.href!)
                }}
              />
            ) : (
              <span
                key={marker.id}
                className="absolute z-10 top-[-6px] -ml-[4px] h-2 w-2 rounded-full border border-surface bg-sky-400"
                style={{ left: `${markerPct}%` }}
                title={markerTitle}
              />
            )
          })}
          {/* Glowing "now" marker — tick + halo dot */}
          <div
            className="absolute top-[-4px] w-[3px] h-[19px] rounded-sm bg-gold shadow-[0_0_8px_2px_rgba(201,168,76,0.55)]"
            style={{ left: `${nowPct}%` }}
            title={`Now · ${formatClockTime(now.getTime())}`}
          />
          <div
            className="absolute top-[-9px] w-[9px] h-[9px] -ml-[3px] rounded-full bg-gold shadow-[0_0_10px_3px_rgba(201,168,76,0.5)]"
            style={{ left: `${nowPct}%` }}
            title={`Now · ${formatClockTime(now.getTime())}`}
          />
        </div>

        <div className="flex justify-between w-[520px] text-[9px] text-text-light tracking-wide">
          {AXIS_TICKS.map((h) => (
            <span key={h}>{hourLabel(h)}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
