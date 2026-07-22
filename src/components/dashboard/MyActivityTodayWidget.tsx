import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Circle,
  Loader2,
  Mic2,
  MousePointer2,
  PlayCircle,
  Upload,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTeamSchedule } from '../../lib/schedule/useTeamSchedule'
import { toLocalDateString } from '../../lib/schedule/expand'
import {
  buildActivityDay,
  type ActivityEventType,
  type SegmentKind,
} from '../../lib/activity/buildActivityDay'
import {
  fetchMemberActivityEvents,
  fetchMemberPresenceSessions,
  toScheduledWindows,
  memberActivityKeys,
} from '../../lib/activity/queries'

// Presence-segment colours (semantic: on-schedule / late / off-schedule).
// Feature-specific palette kept local — these three states only exist on
// this timeline. Matches the director-approved visual spec.
const SEGMENT_COLOR: Record<SegmentKind, string> = {
  on: '#34d399', // emerald — present within schedule
  late: '#fbbf24', // amber — late start past the grace
  off: '#60a5fa', // sky — active outside the scheduled window
}

const TYPE_META: Record<ActivityEventType, { color: string; Icon: typeof CheckCircle2 }> = {
  task: { color: '#34d399', Icon: CheckCircle2 },
  session: { color: '#a78bfa', Icon: Mic2 },
  upload: { color: '#C9A84C', Icon: Upload },
  video: { color: '#a78bfa', Icon: PlayCircle },
  notification: { color: '#60a5fa', Icon: Bell },
  other: { color: '#9ca3af', Icon: Circle },
}

function startOfLocalDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function hourLabel(h: number): string {
  const hr = ((h + 11) % 12) + 1
  return `${hr}${h < 12 || h === 24 ? 'a' : 'p'}`
}

export default function MyActivityTodayWidget() {
  const { profile } = useAuth()
  const memberId = profile?.id ?? ''
  const [feedOpen, setFeedOpen] = useState(false)
  const [hoverPct, setHoverPct] = useState<number | null>(null)

  // Re-render every minute so the "you are here" marker + open-session
  // active time advance while the widget stays open.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  const now = new Date(nowTick)

  const dayStart = useMemo(() => startOfLocalDay(now), [nowTick])
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
    [presenceQuery.data, eventsQuery.data, scheduledWindows, dayStart, dayEnd, nowTick],
  )

  const hasOpenSession = (presenceQuery.data ?? []).some((s) => s.ended_at === null)

  // Axis window — clamp to sensible hours but always cover the schedule,
  // all activity, and "now" so nothing is cut off.
  const { axisStartMs, axisEndMs } = useMemo(() => {
    const times: number[] = [dayStart.getTime() + 7 * 3600_000, dayStart.getTime() + 21 * 3600_000, now.getTime()]
    if (model.scheduledWindow) {
      times.push(Date.parse(model.scheduledWindow.start), Date.parse(model.scheduledWindow.end))
    }
    for (const s of model.segments) times.push(Date.parse(s.start), Date.parse(s.end))
    for (const m of model.markers) times.push(Date.parse(m.at))
    const min = Math.min(...times)
    const max = Math.max(...times)
    const startH = Math.max(0, Math.floor((min - dayStart.getTime()) / 3600_000))
    const endH = Math.min(24, Math.ceil((max - dayStart.getTime()) / 3600_000))
    return {
      axisStartMs: dayStart.getTime() + startH * 3600_000,
      axisEndMs: dayStart.getTime() + Math.max(endH, startH + 1) * 3600_000,
    }
  }, [model, dayStart, nowTick])

  const pct = (ms: number) => {
    const p = ((ms - axisStartMs) / (axisEndMs - axisStartMs)) * 100
    return Math.max(0, Math.min(100, p))
  }

  const axisTicks = useMemo(() => {
    const startH = Math.round((axisStartMs - dayStart.getTime()) / 3600_000)
    const endH = Math.round((axisEndMs - dayStart.getTime()) / 3600_000)
    const step = endH - startH > 10 ? 2 : 1
    const out: { left: number; label: string }[] = []
    for (let h = startH; h <= endH; h += step) {
      out.push({ left: pct(dayStart.getTime() + h * 3600_000), label: hourLabel(h) })
    }
    return out
  }, [axisStartMs, axisEndMs, dayStart])

  const nowLeft = pct(now.getTime())
  const feed = useMemo(() => [...model.markers].reverse(), [model.markers])
  const loading = presenceQuery.isLoading || eventsQuery.isLoading

  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const schedLabel = model.scheduledWindow
    ? `${formatTime(model.scheduledWindow.start)} – ${formatTime(model.scheduledWindow.end)}`
    : null

  return (
    <div className="h-full flex flex-col">
      {/* Meta row — presence status + date + scheduled hours */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {hasOpenSession ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            Active now
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-text-light">Not active</span>
        )}
        <span className="text-[11px] text-text-muted">{dateLabel}</span>
        {schedLabel && (
          <span className="text-[11px] font-semibold text-gold">· Scheduled {schedLabel}</span>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <>
          {/* Hero timeline bar */}
          <div
            className="relative h-[70px] mx-1"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setHoverPct(((e.clientX - r.left) / r.width) * 100)
            }}
            onMouseLeave={() => setHoverPct(null)}
          >
            {hoverPct === null && (
              <span className="absolute right-0 top-0 text-[9.5px] text-text-light flex items-center gap-1">
                <MousePointer2 size={10} aria-hidden="true" /> hover across the bar
              </span>
            )}

            {/* Scheduled band */}
            {model.scheduledWindow && (
              <div
                className="absolute top-[26px] h-[22px] rounded-md border border-dashed border-gold/45 bg-gold/[0.09]"
                style={{
                  left: `${pct(Date.parse(model.scheduledWindow.start))}%`,
                  width: `${pct(Date.parse(model.scheduledWindow.end)) - pct(Date.parse(model.scheduledWindow.start))}%`,
                }}
                title={`Scheduled ${schedLabel}`}
              />
            )}

            {/* Presence segments */}
            {model.segments.map((s, i) => {
              const left = pct(Date.parse(s.start))
              const right = pct(Date.parse(s.end))
              return (
                <div
                  key={`${s.start}-${i}`}
                  className="absolute top-[29px] h-[16px] rounded"
                  style={{ left: `${left}%`, width: `${Math.max(0.4, right - left)}%`, background: SEGMENT_COLOR[s.kind] }}
                  title={`${s.kind === 'on' ? 'On schedule' : s.kind === 'late' ? 'Late start' : 'Off-schedule'} · ${formatTime(s.start)}–${formatTime(s.end)}`}
                />
              )
            })}

            {/* Colored activity ticks (always visible) + proximity markers */}
            {model.markers.map((m) => {
              const left = pct(Date.parse(m.at))
              const meta = TYPE_META[m.type]
              const dist = hoverPct === null ? Infinity : Math.abs(hoverPct - left)
              const tRaw = Math.max(0, 1 - dist / 9)
              const t = tRaw * tRaw * (3 - 2 * tRaw)
              const { Icon } = meta
              return (
                <div key={m.id}>
                  <span
                    className="absolute top-[24px] w-[2px] rounded-sm"
                    style={{ left: `${left}%`, height: `${26 + 6 * t}px`, background: meta.color, opacity: 0.6 + 0.4 * t, transform: 'translateX(-1px)' }}
                    aria-hidden="true"
                  />
                  <div
                    className="absolute top-0 flex flex-col items-center pointer-events-none"
                    style={{ left: `${left}%`, transform: `translateX(-50%) translateY(${(1 - t) * 8}px) scale(${0.8 + 0.2 * t})`, opacity: t, transformOrigin: 'bottom center' }}
                  >
                    <span className="text-[9px] text-text-muted whitespace-nowrap">{formatTime(m.at)}</span>
                    <Icon size={15} style={{ color: meta.color }} aria-hidden="true" />
                  </div>
                </div>
              )
            })}

            {/* You are here */}
            <div className="absolute top-[22px]" style={{ left: `${nowLeft}%` }} title={`You are here · ${formatTime(now.toISOString())}`}>
              <span className="absolute -left-[9px] top-0 w-[18px] h-[18px] rounded-full border-2 border-surface bg-gold flex items-center justify-center">
                <span className="w-[6px] h-[6px] rounded-full bg-surface" />
              </span>
              <span className="absolute -left-[0.5px] top-4 w-px h-3.5 bg-gold" />
            </div>

            {/* Axis */}
            <div className="absolute top-[52px] left-0 right-0 h-px bg-border" />
            <div className="absolute top-[56px] left-0 right-0 text-[9.5px] text-text-light">
              {axisTicks.map((t, i) => (
                <span key={i} className="absolute" style={{ left: `${t.left}%`, transform: 'translateX(-50%)' }}>{t.label}</span>
              ))}
            </div>
          </div>

          {/* Collapsible activity feed */}
          <div className="mt-3 border-t border-border pt-1">
            <button
              type="button"
              onClick={() => setFeedOpen((v) => !v)}
              aria-expanded={feedOpen}
              className="w-full flex items-center justify-between py-2 px-0.5 text-[12.5px] text-text focus-ring rounded-md"
            >
              <span className="flex items-center gap-2">
                Activity feed
                <span className="text-[11px] text-text-light bg-surface-alt px-1.5 py-px rounded-full">{feed.length}</span>
              </span>
              <ChevronDown size={16} className={`text-text-muted transition-transform ${feedOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {feedOpen && (
              <div className="pb-1 overflow-y-auto">
                {feed.length === 0 ? (
                  <p className="text-[12px] text-text-light py-2 px-0.5">No activity recorded yet today.</p>
                ) : (
                  feed.map((m) => {
                    const meta = TYPE_META[m.type]
                    const { Icon } = meta
                    return (
                      <div key={m.id} className="flex items-center justify-between py-1.5 px-0.5 text-[12.5px]">
                        <span className="flex items-center gap-2 min-w-0">
                          <Icon size={15} style={{ color: meta.color }} className="shrink-0" aria-hidden="true" />
                          <span className="truncate text-text-muted">{m.label}</span>
                        </span>
                        <span className="text-text-light text-[11px] shrink-0">{formatTime(m.at)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
