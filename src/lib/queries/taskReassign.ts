// PR #38 — peer-to-peer task reassignment queries.
//
// These wrap the four RPCs shipped in migration
// `20260424220002_task_reassign_requests_rpcs.sql`. Pattern matches
// `src/lib/queries/taskRequests.ts`: throw-on-error + `[queries/…]`
// prefixed console logs so failures surface during dev without
// needing react-query's devtools open.

import { supabase } from '../supabase'

export interface IncomingReassignRequest {
  id: string
  task_id: string
  task_title: string | null
  requester_id: string
  requester_name: string | null
  note: string | null
  status: 'pending' | 'approved' | 'declined' | 'cancelled'
  created_at: string
}

export const taskReassignKeys = {
  all: ['task-reassign-requests'] as const,
  incoming: () => [...taskReassignKeys.all, 'incoming'] as const,
}

function requireMessage(error: { message?: string } | null, fallback: string): Error {
  const msg = error?.message ?? fallback
  return new Error(msg)
}

export async function requestTaskReassignment(
  taskId: string,
  note?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('request_task_reassignment', {
    p_task_id: taskId,
    p_note: note ?? null,
  })
  if (error) {
    console.error('[queries/taskReassign] request failed:', error)
    throw requireMessage(error, 'Could not send the reassignment request.')
  }
}

export async function approveTaskReassignment(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_task_reassignment', {
    p_request_id: requestId,
  })
  if (error) {
    console.error('[queries/taskReassign] approve failed:', error)
    throw requireMessage(error, 'Could not approve the request.')
  }
}

export async function declineTaskReassignment(
  requestId: string,
  note?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('decline_task_reassignment', {
    p_request_id: requestId,
    p_note: note ?? null,
  })
  if (error) {
    console.error('[queries/taskReassign] decline failed:', error)
    throw requireMessage(error, 'Could not decline the request.')
  }
}

export async function fetchIncomingReassignRequests(): Promise<IncomingReassignRequest[]> {
  const { data, error } = await supabase.rpc('get_my_incoming_reassign_requests')
  if (error) {
    console.error('[queries/taskReassign] fetch incoming failed:', error)
    throw requireMessage(error, 'Could not load incoming reassignment requests.')
  }
  if (!Array.isArray(data)) return []
  return data as IncomingReassignRequest[]
}
