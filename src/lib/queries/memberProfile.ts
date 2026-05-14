// Lean Tier 1 — profile-page query helpers.
//
// Both hooks live behind react-query so they share cache + don't
// double-fetch when other surfaces also want the same data later.
// Both default to `enabled: Boolean(memberId)` so passing
// `undefined` is safe — useful while waiting for auth context.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import {
  fetchAdminClockEntries,
  timeClockKeys,
  type AdminClockEntry,
} from './timeClock'

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

// ─── Activity history (recent sessions + recent task completions) ──
// Tier 2 follow-up to the Profile-page sidebar — surfaces a member's
// last few sessions + last few completed tasks so admins (and the
// member themselves) can scan their recent work without leaving the
// profile. Each query is intentionally narrow (limit 5) so the
// sidebar stays glanceable; we'll grow into deeper history pages
// later if there's pull.

export interface RecentSessionInfo {
  sessionId: string
  /** "Apr 23" — short date for the sidebar pill. */
  dateLabel: string
  /** ISO date for sorting / hover title. */
  sessionDate: string
  title: string
  room: string | null
  status: string | null
  startTime: string | null
}

const recentSessionsKey = (memberId: string) =>
  ['member-recent-sessions', memberId] as const

async function fetchRecentSessions(memberId: string): Promise<RecentSessionInfo[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, session_date, start_time, room, client_name, session_type, status')
    .eq('assigned_to', memberId)
    .neq('status', 'cancelled')
    .order('session_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(5)
  if (error) throw error
  return (data ?? []).map((row) => {
    const dt = new Date(`${row.session_date}T00:00:00`)
    const dateLabel = Number.isNaN(dt.getTime())
      ? row.session_date
      : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return {
      sessionId: row.id,
      dateLabel,
      sessionDate: row.session_date,
      title: row.client_name ?? row.session_type ?? 'Session',
      room: row.room,
      status: row.status,
      startTime: row.start_time,
    }
  })
}

export function useMemberRecentSessions(memberId: string | undefined) {
  return useQuery({
    queryKey: recentSessionsKey(memberId ?? '__none__'),
    queryFn: () => fetchRecentSessions(memberId!),
    enabled: Boolean(memberId),
    staleTime: 60_000,
  })
}

export interface RecentTaskInfo {
  taskId: string
  title: string
  completedAt: string
  /** "2d ago" / "Today" — short relative for the sidebar. */
  relativeLabel: string
}

const recentTasksKey = (memberId: string) =>
  ['member-recent-completed-tasks', memberId] as const

function relativeShort(ts: string): string {
  const then = new Date(ts).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function fetchRecentCompletedTasks(memberId: string): Promise<RecentTaskInfo[]> {
  const { data, error } = await supabase
    .from('assigned_tasks')
    .select('id, title, completed_at')
    .eq('assigned_to', memberId)
    .eq('is_completed', true)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return (data ?? [])
    .filter((row) => Boolean(row.completed_at))
    .map((row) => ({
      taskId: row.id,
      title: row.title,
      completedAt: row.completed_at as string,
      relativeLabel: relativeShort(row.completed_at as string),
    }))
}

export function useMemberRecentCompletedTasks(memberId: string | undefined) {
  return useQuery({
    queryKey: recentTasksKey(memberId ?? '__none__'),
    queryFn: () => fetchRecentCompletedTasks(memberId!),
    enabled: Boolean(memberId),
    staleTime: 60_000,
  })
}

// ─── Admin drawer history (deeper, configurable limits) ───────────
// PR — Members admin per-row activity drawer. The Profile sidebar
// hooks above hard-cap at 5 rows for "glance" context. The drawer
// surfaces deeper history for admins reviewing a single member, so
// we expose configurable-limit twins that share the same row shape
// but use distinct query keys to avoid clobbering the sidebar cache.

const adminSessionsKey = (memberId: string, limit: number) =>
  ['member-admin-sessions', memberId, limit] as const

async function fetchAdminMemberSessions(
  memberId: string,
  limit: number,
): Promise<RecentSessionInfo[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, session_date, start_time, room, client_name, session_type, status')
    .eq('assigned_to', memberId)
    .neq('status', 'cancelled')
    .order('session_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => {
    const dt = new Date(`${row.session_date}T00:00:00`)
    const dateLabel = Number.isNaN(dt.getTime())
      ? row.session_date
      : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return {
      sessionId: row.id,
      dateLabel,
      sessionDate: row.session_date,
      title: row.client_name ?? row.session_type ?? 'Session',
      room: row.room,
      status: row.status,
      startTime: row.start_time,
    }
  })
}

export function useMemberAdminSessions(
  memberId: string | undefined,
  limit = 20,
) {
  return useQuery({
    queryKey: adminSessionsKey(memberId ?? '__none__', limit),
    queryFn: () => fetchAdminMemberSessions(memberId!, limit),
    enabled: Boolean(memberId),
    staleTime: 60_000,
  })
}

const adminTasksKey = (memberId: string, limit: number) =>
  ['member-admin-completed-tasks', memberId, limit] as const

async function fetchAdminMemberCompletedTasks(
  memberId: string,
  limit: number,
): Promise<RecentTaskInfo[]> {
  const { data, error } = await supabase
    .from('assigned_tasks')
    .select('id, title, completed_at')
    .eq('assigned_to', memberId)
    .eq('is_completed', true)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? [])
    .filter((row) => Boolean(row.completed_at))
    .map((row) => ({
      taskId: row.id,
      title: row.title,
      completedAt: row.completed_at as string,
      relativeLabel: relativeShort(row.completed_at as string),
    }))
}

export function useMemberAdminCompletedTasks(
  memberId: string | undefined,
  limit = 20,
) {
  return useQuery({
    queryKey: adminTasksKey(memberId ?? '__none__', limit),
    queryFn: () => fetchAdminMemberCompletedTasks(memberId!, limit),
    enabled: Boolean(memberId),
    staleTime: 60_000,
  })
}

/**
 * Wraps `fetchAdminClockEntries` in react-query so the drawer can
 * share cache with the Members > Clock Data table when the admin
 * drills into the same member from both surfaces.
 */
export function useMemberClockEntries(
  memberId: string | undefined,
  limit = 20,
) {
  return useQuery<AdminClockEntry[]>({
    queryKey: timeClockKeys.adminEntries(memberId ?? null),
    queryFn: () => fetchAdminClockEntries(memberId ?? null, limit),
    enabled: Boolean(memberId),
    staleTime: 30_000,
  })
}
