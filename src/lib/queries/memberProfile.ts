// Lean Tier 1 — profile-page query helpers.
//
// Both hooks live behind react-query so they share cache + don't
// double-fetch when other surfaces also want the same data later.
// Both default to `enabled: Boolean(memberId)` so passing
// `undefined` is safe — useful while waiting for auth context.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

export interface MemberStats {
  sessionsThisMonth: number
  tasksCompletedThisWeek: number
}

const memberStatsKey = (memberId: string) => ['member-stats', memberId] as const

async function fetchMemberStats(memberId: string): Promise<MemberStats> {
  // Compute the period boundaries client-side. Postgres-side `now()`
  // would also work but doing it here lets us tweak the period
  // (e.g. "last 30 days" vs "this calendar month") without RPC
  // changes.
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const weekStartDate = new Date(now)
  weekStartDate.setDate(weekStartDate.getDate() - 7)
  const weekStart = weekStartDate.toISOString()

  const [sessionsRes, tasksRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', memberId)
      .gte('session_date', monthStart)
      .neq('status', 'cancelled'),
    supabase
      .from('assigned_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', memberId)
      .eq('is_completed', true)
      .gte('completed_at', weekStart),
  ])

  if (sessionsRes.error) throw sessionsRes.error
  if (tasksRes.error) throw tasksRes.error

  return {
    sessionsThisMonth: sessionsRes.count ?? 0,
    tasksCompletedThisWeek: tasksRes.count ?? 0,
  }
}

export function useMemberStats(memberId: string | undefined) {
  return useQuery({
    queryKey: memberStatsKey(memberId ?? '__none__'),
    queryFn: () => fetchMemberStats(memberId!),
    enabled: Boolean(memberId),
    // Stats don't change minute-to-minute. Refresh every 5 min when
    // the tab is active.
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  })
}

// ─── Live status ──────────────────────────────────────────────────

export type LiveStatusState = 'in-session' | 'upcoming-today' | 'available' | 'unknown'

export interface LiveSessionInfo {
  sessionId: string
  title: string
  room: string | null
  /** ISO timestamp of when the session starts/ends. */
  startsAt: string
  endsAt: string
}

export interface MemberLiveStatus {
  state: LiveStatusState
  current?: LiveSessionInfo
  next?: LiveSessionInfo
}

const liveStatusKey = (memberId: string) => ['member-live-status', memberId] as const

function combineDateAndTime(date: string, time: string): string {
  // sessions.session_date = 'YYYY-MM-DD', start_time/end_time =
  // 'HH:MM:SS'. We treat them as local-time wall clocks (which is
  // how everyone reads them) and let the browser convert.
  const [hh = '00', mm = '00', ss = '00'] = time.split(':')
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, Number(hh), Number(mm), Number(ss))
  return dt.toISOString()
}

async function fetchMemberLiveStatus(memberId: string): Promise<MemberLiveStatus> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('sessions')
    .select('id, session_date, start_time, end_time, room, client_name, session_type, status')
    .eq('assigned_to', memberId)
    .eq('session_date', today)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })

  if (error) throw error

  const now = Date.now()
  let current: LiveSessionInfo | undefined
  let next: LiveSessionInfo | undefined
  for (const row of data ?? []) {
    if (!row.start_time || !row.end_time) continue
    const startsAt = combineDateAndTime(row.session_date, row.start_time)
    const endsAt = combineDateAndTime(row.session_date, row.end_time)
    const start = Date.parse(startsAt)
    const end = Date.parse(endsAt)
    const title = row.client_name ?? row.session_type ?? 'Session'
    const info: LiveSessionInfo = {
      sessionId: row.id,
      title,
      room: row.room,
      startsAt,
      endsAt,
    }
    if (now >= start && now <= end) {
      current = info
      break
    }
    if (start > now && !next) {
      next = info
    }
  }

  let state: LiveStatusState = 'available'
  if (current) state = 'in-session'
  else if (next) state = 'upcoming-today'

  return { state, current, next }
}

export function useMemberLiveStatus(memberId: string | undefined) {
  return useQuery({
    queryKey: liveStatusKey(memberId ?? '__none__'),
    queryFn: () => fetchMemberLiveStatus(memberId!),
    enabled: Boolean(memberId),
    // Refresh every minute so the "1h 22m left" countdown stays fresh
    // and a session ending mid-view flips to "Available" promptly.
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
