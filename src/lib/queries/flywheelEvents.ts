// Phase 1 of the Flywheel event ledger.
//
// Append-only ledger of every studio action mapped to one of the 5
// flywheel stages (Deliver → Capture → Share → Attract → Book).
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

export type FlywheelStage = 'deliver' | 'capture' | 'share' | 'attract' | 'book'

/**
 * Free-text discriminator for which kind of source row produced the
 * event. Open list (kept as a string union for current callers, but
 * the database stores it as plain `text` so new source types don't
 * need DDL). Add new entries here as you wire new emit points.
 */
export type FlywheelSourceType =
  | 'task'           // assigned_tasks row completed
  | 'session'        // sessions row created (Book + sometimes Capture)
  | 'client'         // clients row created (Attract)
  | 'media_upload'   // AddMedia upload completed (Share)

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
