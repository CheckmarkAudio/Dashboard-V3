// PR #43 — admin-side session library + per-session editor.
// Mirrors `adminTasks.ts` in shape.

import { supabase } from '../supabase'
import { deleteSessionEventFromGoogleCalendar, syncSessionToGoogleCalendar } from '../googleCalendar'

export interface AdminSession {
  id: string
  client_name: string | null
  session_date: string // YYYY-MM-DD
  start_time: string   // HH:mm:ss
  end_time: string
  session_type: string
  status: string
  room: string | null
  notes: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  created_by: string | null
  created_at: string | null
  google_event_id?: string | null
}

export const adminSessionKeys = {
  all: ['admin-sessions'] as const,
  list: (includePast: boolean) =>
    [...adminSessionKeys.all, includePast ? 'all' : 'upcoming'] as const,
}

export async function fetchAllSessions(
  opts: { includePast?: boolean } = {},
): Promise<AdminSession[]> {
  const { data, error } = await supabase.rpc('admin_list_all_sessions', {
    p_include_past: opts.includePast ?? false,
  })
  if (error) {
    console.error('[queries/adminSessions] fetchAllSessions failed:', error)
    throw new Error(error.message)
  }
  if (!Array.isArray(data)) return []
  return data as AdminSession[]
}

export interface AdminUpdateSessionPayload {
  client_name?: string
  session_date?: string     // YYYY-MM-DD
  start_time?: string       // HH:mm
  end_time?: string         // HH:mm
  session_type?: string
  status?: string
  room?: string
  notes?: string
  assigned_to?: string
  clearClientName?: boolean
  clearRoom?: boolean
  clearNotes?: boolean
  clearAssignedTo?: boolean
}

export async function adminUpdateSession(
  sessionId: string,
  payload: AdminUpdateSessionPayload,
): Promise<{ session: AdminSession; syncWarning: string | null }> {
  const { data, error } = await supabase.rpc('admin_update_session', {
    p_session_id: sessionId,
    p_client_name: payload.client_name ?? null,
    p_session_date: payload.session_date ?? null,
    p_start_time: payload.start_time ?? null,
    p_end_time: payload.end_time ?? null,
    p_session_type: payload.session_type ?? null,
    p_status: payload.status ?? null,
    p_room: payload.room ?? null,
    p_notes: payload.notes ?? null,
    p_assigned_to: payload.assigned_to ?? null,
    p_clear_client_name: payload.clearClientName ?? false,
    p_clear_room: payload.clearRoom ?? false,
    p_clear_notes: payload.clearNotes ?? false,
    p_clear_assigned_to: payload.clearAssignedTo ?? false,
  })
  if (error) {
    console.error('[queries/adminSessions] adminUpdateSession failed:', error)
    throw new Error(error.message)
  }
  const updated = data as AdminSession
  try {
    await syncSessionToGoogleCalendar(updated.id)
    return { session: updated, syncWarning: null }
  } catch (error) {
    return {
      session: updated,
      syncWarning: error instanceof Error ? error.message : 'Unknown Google Calendar sync failure',
    }
  }
}

export async function adminDeleteSession(
  sessionId: string,
  opts: { cancelNote?: string } = {},
): Promise<{ syncWarning: string | null }> {
  const { data, error } = await supabase.rpc('admin_delete_session', {
    p_session_id: sessionId,
    p_cancel_note: opts.cancelNote ?? null,
  })
  if (error) {
    console.error('[queries/adminSessions] adminDeleteSession failed:', error)
    throw new Error(error.message)
  }
  const googleEventId = (data as { deleted_google_event_id?: string | null } | null)?.deleted_google_event_id
  try {
    await deleteSessionEventFromGoogleCalendar(googleEventId ?? null)
    return { syncWarning: null }
  } catch (syncError) {
    return {
      syncWarning: syncError instanceof Error ? syncError.message : 'Unknown Google Calendar delete failure',
    }
  }
}
