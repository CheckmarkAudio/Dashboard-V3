// Flywheel event ledger.
//
// Append-only ledger of every studio action mapped to one of the 5
// flywheel stages of the refined platform model:
//   discovery → workflow → production → education → growth
//   (Discovery & Media · Workflow & Admin · Production & Completion ·
//    Education & Community · Growth, Advocacy & Retention)
// Insert path is the `record_flywheel_event` RPC — the table has no
// direct INSERT policy, so client code must use this helper. Reads
// come later (Phase 2 aggregations).
//
// Best-practice: emit calls SHOULD be fire-and-forget — never block
// the user's primary action on whether the event recorded. If the
// emit fails (network blip, RLS issue), log the error and move on;
// the user's booking/task/upload should NOT regress. `emitFlywheelEvent()`
// wraps the RPC + swallows errors with a console.warn for this
// reason.

import { supabase } from '../supabase'

export type FlywheelStage = 'discovery' | 'workflow' | 'production' | 'education' | 'growth'

/**
 * Free-text discriminator for which kind of source row produced the
 * event. Open list (kept as a string union for current callers, but
 * the database stores it as plain `text` so new source types don't
 * need DDL). Add new entries here as you wire new emit points.
 */
export type FlywheelSourceType =
  | 'task'           // assigned_tasks completed         → production
  | 'session'        // sessions row created             → workflow (booking + first-session conversion)
  | 'client'         // clients row created              → discovery
  | 'media_upload'   // AddMedia upload completed         → discovery (content asset)

export interface RecordFlywheelEventInput {
  stage: FlywheelStage
  source_type: FlywheelSourceType
  /** id of the source row (assigned_tasks.id, sessions.id, etc.). */
  source_id?: string | null
  /** Override the actor (defaults to auth.uid() on the server). */
  member_id?: string | null
  /** Free-form context for Phase 2 drill-downs (client_id, room, etc.). */
  metadata?: Record<string, unknown>
  /** Backdate the event. Defaults to now() on the server. */
  occurred_at?: string
}

/**
 * Fire-and-forget emit. Errors are logged but never thrown — emit
 * failures must not regress the user's primary action (booking,
 * task complete, upload, etc.). Returns the event id on success
 * for callers that want to log it; returns null on failure.
 */
export async function emitFlywheelEvent(input: RecordFlywheelEventInput): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('record_flywheel_event', {
      p_stage: input.stage,
      p_source_type: input.source_type,
      p_source_id: input.source_id ?? null,
      p_member_id: input.member_id ?? null,
      p_metadata: input.metadata ?? {},
      ...(input.occurred_at ? { p_occurred_at: input.occurred_at } : {}),
    })
    if (error) {
      console.warn('[flywheelEvents] emit failed (non-fatal):', error.message, input)
      return null
    }
    return typeof data === 'string' ? data : null
  } catch (err) {
    console.warn('[flywheelEvents] emit threw (non-fatal):', err, input)
    return null
  }
}

// ─── Reads (Phase 2) ──────────────────────────────────────────────
//
// The Team Activity feed reads recent events directly — flywheel_events
// has a team-scoped SELECT RLS policy (team_id = get_my_team_id()), so a
// plain client query is automatically isolated to the caller's team. The
// member_id FK lets us embed the actor's display name in one round trip.

export const flywheelKeys = {
  all: ['flywheel'] as const,
  activity: (limit: number) => [...flywheelKeys.all, 'activity', limit] as const,
}

export interface FlywheelActivityRow {
  id: string
  stage: FlywheelStage
  source_type: string
  metadata: Record<string, unknown> | null
  occurred_at: string
  /** Actor's display name (joined from team_members), or null for system events. */
  actor: string | null
}

type RawActivityRow = {
  id: string
  stage: FlywheelStage
  source_type: string
  metadata: Record<string, unknown> | null
  occurred_at: string
  member: { display_name: string | null } | { display_name: string | null }[] | null
}

/** Most-recent flywheel events for the caller's team (RLS-scoped). */
export async function fetchFlywheelActivity(limit = 8): Promise<FlywheelActivityRow[]> {
  const { data, error } = await supabase
    .from('flywheel_events')
    .select('id, stage, source_type, metadata, occurred_at, member:team_members!flywheel_events_member_id_fkey(display_name)')
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as unknown as RawActivityRow[]).map((r) => ({
    id: r.id,
    stage: r.stage,
    source_type: r.source_type,
    metadata: r.metadata ?? null,
    occurred_at: r.occurred_at,
    actor: Array.isArray(r.member) ? (r.member[0]?.display_name ?? null) : (r.member?.display_name ?? null),
  }))
}

/**
 * Turn a ledger row into a human sentence fragment (the actor name is
 * rendered separately by the widget). Falls back gracefully for source
 * types added later that this switch doesn't know about yet.
 */
export function describeFlywheelEvent(
  row: Pick<FlywheelActivityRow, 'stage' | 'source_type' | 'metadata'>,
): string {
  const m = row.metadata ?? {}
  const str = (k: string): string | null => (typeof m[k] === 'string' ? (m[k] as string) : null)
  switch (row.source_type) {
    case 'task':
      return str('title') ? `completed “${str('title')}”` : 'completed a task'
    case 'client':
      return str('name') ? `added a new client · ${str('name')}` : 'added a new client'
    case 'media_upload':
      return str('file_name') ? `uploaded ${str('file_name')}` : 'uploaded media'
    case 'session':
      if (m.milestone === 'client_converted') return 'converted a new client'
      return str('session_type') ? `booked a ${str('session_type')} session` : 'booked a session'
    default:
      return `logged a ${row.stage} event`
  }
}
