// PR #43 — admin-side session library + per-session editor.
// Mirrors `adminTasks.ts` in shape.

import { supabase } from '../supabase'

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
): Promise<AdminSession> {
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
  return data as AdminSession
}

export async function adminDeleteSession(
  sessionId: string,
  opts: { cancelNote?: string } = {},
): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_session', {
    p_session_id: sessionId,
    p_cancel_note: opts.cancelNote ?? null,
  })
  if (error) {
    console.error('[queries/adminSessions] adminDeleteSession failed:', error)
    throw new Error(error.message)
  }
}
