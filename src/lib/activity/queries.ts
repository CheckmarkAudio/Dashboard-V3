// Member Activity — read-only data layer (PR2).
//
// Thin, RLS-scoped fetches + pure mappers that feed the pure
// `buildActivityDay` builder. PR3's widget composes these: fetch →
// buildActivityDay → render, with no date math left to solve.
//
// All reads respect the existing RLS boundaries:
//   - member_presence_sessions: a member reads own rows; admins read
//     their team's rows (policies from PR1's migration).
//   - flywheel_events: team-scoped SELECT; filtering by member_id here
//     narrows within the caller's own team, never across teams.
// No writes live in this module.

import { supabase } from '../supabase'
import { describeFlywheelEvent } from '../queries/flywheelEvents'
import type { FlywheelStage } from '../flywheel/stages'
import type { ExpandedSchedule } from '../../types'
import type { PresenceSession } from '../queries/presence'
import { resolveEffectiveWorkWindows } from '../schedule/effective'
import { activityTypeFromSource, type ActivityEvent, type ScheduledWindow } from './buildActivityDay'

const LOG_PREFIX = '[activity/queries]'

const PRESENCE_COLUMNS =
  'id, member_id, team_id, started_at, last_seen_at, ended_at, source'

/**
 * Presence sessions for one member that overlap the [fromIso, toIso)
 * window. A session overlaps when it started before the window ends AND
 * it is either still open or ended at/after the window start.
 */
export async function fetchMemberPresenceSessions(
  memberId: string,
  fromIso: string,
  toIso: string,
): Promise<PresenceSession[]> {
  const { data, error } = await supabase
    .from('member_presence_sessions')
    .select(PRESENCE_COLUMNS)
    .eq('member_id', memberId)
    .lt('started_at', toIso)
    .or(`ended_at.is.null,ended_at.gte.${fromIso}`)
    .order('started_at', { ascending: true })
  if (error) {
    console.error(`${LOG_PREFIX} fetchMemberPresenceSessions failed:`, error)
    throw new Error(error.message)
  }
  return (data as PresenceSession[] | null) ?? []
}

interface RawMemberEventRow {
  id: string
  stage: FlywheelStage
  source_type: string
  metadata: Record<string, unknown> | null
  occurred_at: string
}

/**
 * Flywheel events for one member within [fromIso, toIso), normalized to
 * the `ActivityEvent` shape the builder + widget consume.
 */
export async function fetchMemberActivityEvents(
  memberId: string,
  fromIso: string,
  toIso: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from('flywheel_events')
    .select('id, stage, source_type, metadata, occurred_at')
    .eq('member_id', memberId)
    .gte('occurred_at', fromIso)
    .lt('occurred_at', toIso)
    .order('occurred_at', { ascending: true })
  if (error) {
    console.error(`${LOG_PREFIX} fetchMemberActivityEvents failed:`, error)
    throw new Error(error.message)
  }
  return ((data as RawMemberEventRow[] | null) ?? []).map(flywheelRowToActivityEvent)
}

/** Pure: turn a flywheel event row into a normalized ActivityEvent. */
export function flywheelRowToActivityEvent(row: RawMemberEventRow): ActivityEvent {
  return {
    id: row.id,
    at: row.occurred_at,
    type: activityTypeFromSource(row.source_type),
    label: describeFlywheelEvent({
      stage: row.stage,
      source_type: row.source_type,
      metadata: row.metadata,
    }),
    sourceType: row.source_type,
  }
}

/**
 * Pure: reduce a member's expanded schedule entries (for one day) to the
 * `ScheduledWindow[]` the builder wants. Only approved entries count as
 * the presumptive-clock baseline; pending/denied are ignored here.
 */
export function toScheduledWindows(
  expanded: ExpandedSchedule[],
  memberId: string,
): ScheduledWindow[] {
  return resolveEffectiveWorkWindows(expanded, memberId)
}

export const memberActivityKeys = {
  all: ['member-activity'] as const,
  presence: (memberId: string, day: string) =>
    [...memberActivityKeys.all, 'presence', memberId, day] as const,
  events: (memberId: string, day: string) =>
    [...memberActivityKeys.all, 'events', memberId, day] as const,
}
