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
// What the member is asking for. PR #82 (admin-side) shipped immediate
// admin delete; this PR adds the member-request half. 'edit' is
// reserved for the next PR — server raises 'unsupported' on approve.
export type TaskRequestKind = 'create' | 'edit' | 'delete'

/** Shape of the stored recurrence spec on a task request. `null` = one-shot. */
export interface RecurrenceSpec {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  interval: number
}

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
  kind: TaskRequestKind
  target_task_id: string | null
  is_required: boolean
  recurrence_spec: RecurrenceSpec | null
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
  kind: TaskRequestKind
  target_task_id: string | null
  is_required: boolean
  recurrence_spec: RecurrenceSpec | null
  reviewer_note: string | null
  reviewed_at: string | null
  approved_task_id: string | null
  created_at: string
}

// PR #17 — recurrence is stubbed until the engine ships; UI captures
// the choice and we persist it as a JSONB spec so saved requests can
// activate automatically later.
export interface RecurrenceSpecInput {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  interval: number
}

export interface SubmitTaskRequestInput {
  title: string
  description?: string | null
  category?: string | null
  due_date?: string | null
  recurrence_spec?: RecurrenceSpecInput | null
  /** Merged priority+required flag (PR #17). */
  is_required?: boolean
}

export async function submitTaskRequest(
  input: SubmitTaskRequestInput,
): Promise<{ request_id: string; notification_count: number }> {
  const { data, error } = await supabase.rpc('submit_task_request', {
    p_title: input.title,
    p_description: input.description ?? null,
    p_category: input.category ?? null,
    p_due_date: input.due_date ?? null,
    p_recurrence_spec: input.recurrence_spec ?? null,
    p_is_required: input.is_required ?? false,
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

// PR #17 — admin can tag the approved task with a flywheel stage
// during review so KPI tracking catches up the moment the task lands.
// Passing null/undefined preserves the requester's own category.
export async function approveTaskRequest(
  requestId: string,
  category: string | null = null,
): Promise<{ request_id: string; task_id: string; batch_id: string; category: string | null; notification_id: string }> {
  const { data, error } = await supabase.rpc('approve_task_request', {
    p_request_id: requestId,
    p_category: category,
  })
  if (error) {
    console.error('[queries/taskRequests] approveTaskRequest failed:', error)
    throw new Error(error.message)
  }
  return data as { request_id: string; task_id: string; batch_id: string; category: string | null; notification_id: string }
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

/**
 * Member submits a request to delete one of their OWN assigned tasks.
 * Admin approves via approveTaskRequest (server dispatches on kind);
 * the actual delete happens server-side at approve time, not at submit.
 *
 * Server enforces:
 *   - caller authenticated
 *   - task exists in caller's team
 *   - task scope = 'member' AND assigned_to = caller
 *
 * Studio-scope tasks have no single owner — admin direct-delete is
 * the only path; this RPC rejects with code 22023.
 */
export async function submitTaskDeleteRequest(
  taskId: string,
  reason: string | null = null,
): Promise<{ request_id: string; notification_count: number }> {
  const { data, error } = await supabase.rpc('submit_task_delete_request', {
    p_task_id: taskId,
    p_reason: reason,
  })
  if (error) {
    console.error('[queries/taskRequests] submitTaskDeleteRequest failed:', error)
    throw new Error(error.message)
  }
  return data as { request_id: string; notification_count: number }
}
