// PR #50 — Tier 2 / Clock In/Out (Lean 1).
//
// Wraps the SECURITY DEFINER RPCs from
// `supabase/migrations/20260429000000_time_clock_entries.sql`.
// Pattern matches `src/lib/queries/assignments.ts`: async, throw-on-
// error, log-prefix on failure, return typed.

import { supabase } from '../supabase'

const LOG_PREFIX = '[queries/timeClock]'

export interface TimeClockEntry {
  id: string
  user_id: string
  team_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** Open the caller's shift. Idempotent — clocking in while already
 *  on the clock returns the existing open row unchanged. */
export async function clockIn(): Promise<TimeClockEntry> {
  const { data, error } = await supabase.rpc('clock_in')
  if (error) {
    console.error(`${LOG_PREFIX} clockIn failed:`, error)
    throw new Error(error.message)
  }
  return data as TimeClockEntry
}

/** Close the caller's most recent open shift. */
export async function clockOut(notes?: string): Promise<TimeClockEntry> {
  const { data, error } = await supabase.rpc('clock_out', { p_notes: notes ?? null })
  if (error) {
    console.error(`${LOG_PREFIX} clockOut failed:`, error)
    throw new Error(error.message)
  }
  return data as TimeClockEntry
}

/** Returns the caller's currently-open shift, or `null` if not on
 *  the clock. The RPC returns a NULL composite when no open shift
 *  exists; supabase-js surfaces that as a row with all-null fields,
 *  which we normalize here. */
export async function fetchMyOpenClockEntry(): Promise<TimeClockEntry | null> {
  const { data, error } = await supabase.rpc('get_my_open_clock_entry')
  if (error) {
    console.error(`${LOG_PREFIX} fetchMyOpenClockEntry failed:`, error)
    throw new Error(error.message)
  }
  // NULL composite → effectively `{ id: null, user_id: null, ... }`.
  // A real row always has a non-null id.
  if (!data || (data as { id: string | null }).id === null) {
    return null
  }
  return data as TimeClockEntry
}

export interface CurrentlyClockedInRow {
  user_id: string
  display_name: string
  email: string
  clocked_in_at: string
  entry_id: string
}

/** Admin-only — list every team member currently on the clock. */
export async function fetchCurrentlyClockedIn(): Promise<CurrentlyClockedInRow[]> {
  const { data, error } = await supabase.rpc('admin_currently_clocked_in')
  if (error) {
    console.error(`${LOG_PREFIX} fetchCurrentlyClockedIn failed:`, error)
    throw new Error(error.message)
  }
  return (data as CurrentlyClockedInRow[] | null) ?? []
}

export interface ClockEntryRow {
  entry_id: string
  member_id: string
  member_name: string
  clocked_in_at: string
  clocked_out_at: string | null
  duration_minutes: number | null
  notes: string | null
}

/** Admin-only — historical shift log across the team, optionally
 *  filtered to one member. Open shifts come back with
 *  `clocked_out_at: null` and `duration_minutes: null`; the UI renders
 *  those as the "ON SHIFT" pill. Sorted by clocked_in_at desc. */
export async function fetchClockEntries(
  memberId?: string | null,
  limit = 100,
): Promise<ClockEntryRow[]> {
  const { data, error } = await supabase.rpc('admin_list_clock_entries', {
    p_member_id: memberId ?? null,
    p_limit: limit,
  })
  if (error) {
    console.error(`${LOG_PREFIX} fetchClockEntries failed:`, error)
    throw new Error(error.message)
  }
  return (data as ClockEntryRow[] | null) ?? []
}

// React-query key factory for cache coordination across widgets.
export const timeClockKeys = {
  all: ['time-clock'] as const,
  myOpen: () => ['time-clock', 'my-open'] as const,
  currentlyClockedIn: () => ['time-clock', 'currently-clocked-in'] as const,
  entries: (memberId?: string | null) =>
    ['time-clock', 'entries', memberId ?? 'all'] as const,
}
