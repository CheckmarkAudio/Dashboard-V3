// Task-request + approval-queue query helpers (PR #16).
//
// Pattern mirrors `queries/assignments.ts`: async functions, throw on
// RPC error, `[queries/taskRequests]` log prefix. Keys exported as a
// factory so invalidation stays typo-safe.

import { supabase } from '../supabase'

export const taskRequestKeys = {
  all: ['task-requests'] as const,
  pending: () => [...taskRequestKeys.all, 'pending'] as const,
  mine: () => [...taskRequestKeys.all, 'mine'] as const,
}

export type TaskRequestStatus = 'pending' | 'approved' | 'rejected'

/** Row shape returned by `get_pending_task_requests` (admin queue). */
export interface PendingTaskRequest {
  id: string
  requester_id: string
  requester_name: string
  title: string
  description: string | null
  category: string | null
  due_date: string | null
  status: TaskRequestStatus
  created_at: string
}

/** Row shape returned by `get_my_task_requests` (member history). */
export interface MyTaskRequest {
  id: string
  title: string
  description: string | null
  category: string | null
  due_date: string | null
  status: TaskRequestStatus
  reviewer_note: string | null
  reviewed_at: string | null
  approved_task_id: string | null
  created_at: string
}

export interface SubmitTaskRequestInput {
  title: string
  description?: string | null
  category?: string | null
  due_date?: string | null
}

export async function submitTaskRequest(
  input: SubmitTaskRequestInput,
): Promise<{ request_id: string; notification_count: number }> {
  const { data, error } = await supabase.rpc('submit_task_request', {
    p_title: input.title,
    p_description: input.description ?? null,
    p_category: input.category ?? null,
    p_due_date: input.due_date ?? null,
  })
  if (error) {
    console.error('[queries/taskRequests] submitTaskRequest failed:', error)
    throw new Error(error.message)
  }
  return data as { request_id: string; notification_count: number }
}

export async function fetchPendingTaskRequests(): Promise<PendingTaskRequest[]> {
  const { data, error } = await supabase.rpc('get_pending_task_requests')
  if (error) {
    console.error('[queries/taskRequests] fetchPendingTaskRequests failed:', error)
    throw new Error(error.message)
  }
  return (data as PendingTaskRequest[] | null) ?? []
}

export async function fetchMyTaskRequests(limit = 20): Promise<MyTaskRequest[]> {
  const { data, error } = await supabase.rpc('get_my_task_requests', {
    p_limit: limit,
  })
  if (error) {
    console.error('[queries/taskRequests] fetchMyTaskRequests failed:', error)
    throw new Error(error.message)
  }
  return (data as MyTaskRequest[] | null) ?? []
}

export async function approveTaskRequest(
  requestId: string,
): Promise<{ request_id: string; task_id: string; batch_id: string; notification_id: string }> {
  const { data, error } = await supabase.rpc('approve_task_request', {
    p_request_id: requestId,
  })
  if (error) {
    console.error('[queries/taskRequests] approveTaskRequest failed:', error)
    throw new Error(error.message)
  }
  return data as { request_id: string; task_id: string; batch_id: string; notification_id: string }
}

export async function rejectTaskRequest(
  requestId: string,
  note: string | null = null,
): Promise<{ request_id: string; notification_id: string }> {
  const { data, error } = await supabase.rpc('reject_task_request', {
    p_request_id: requestId,
    p_note: note,
  })
  if (error) {
    console.error('[queries/taskRequests] rejectTaskRequest failed:', error)
    throw new Error(error.message)
  }
  return data as { request_id: string; notification_id: string }
}
