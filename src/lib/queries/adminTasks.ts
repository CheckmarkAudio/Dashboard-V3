// PR #40 — admin-side "Edit Tasks" surface.
//
// Wraps `admin_list_all_assigned_tasks` + `admin_update_assigned_task`.
// Both RPCs enforce is_team_admin() server-side so any non-admin caller
// gets 42501; the client helpers still fire so the error surfaces via
// React Query instead of silently returning empty.

import { supabase } from '../supabase'
import type { AssignedTask } from '../../types/assignments'

export const adminTaskKeys = {
  all: ['admin-assigned-tasks'] as const,
  list: (includeCompleted: boolean) =>
    [...adminTaskKeys.all, includeCompleted ? 'all' : 'open'] as const,
}

export async function fetchAllAssignedTasks(
  opts: { includeCompleted?: boolean } = {},
): Promise<AssignedTask[]> {
  const { data, error } = await supabase.rpc('admin_list_all_assigned_tasks', {
    p_include_completed: opts.includeCompleted ?? false,
  })
  if (error) {
    console.error('[queries/adminTasks] fetchAllAssignedTasks failed:', error)
    throw new Error(error.message)
  }
  if (!Array.isArray(data)) return []
  return data as AssignedTask[]
}

/**
 * Partial update — every field is optional. Use `clear*` flags to
 * explicitly null a column (distinguishes "don't change" from "clear
 * this field"). Server fires a `task_edited` notification to the
 * current assignee when relevant.
 */
export interface AdminUpdateTaskPayload {
  title?: string
  description?: string
  category?: string | null
  due_date?: string | null  // YYYY-MM-DD
  clearDescription?: boolean
  clearCategory?: boolean
  clearDue?: boolean
}

export async function adminUpdateAssignedTask(
  taskId: string,
  payload: AdminUpdateTaskPayload,
): Promise<AssignedTask> {
  const { data, error } = await supabase.rpc('admin_update_assigned_task', {
    p_task_id: taskId,
    p_title: payload.title ?? null,
    p_description: payload.description ?? null,
    p_category: payload.category ?? null,
    p_due_date: payload.due_date ?? null,
    p_clear_due: payload.clearDue ?? false,
    p_clear_description: payload.clearDescription ?? false,
    p_clear_category: payload.clearCategory ?? false,
  })
  if (error) {
    console.error('[queries/adminTasks] adminUpdateAssignedTask failed:', error)
    throw new Error(error.message)
  }
  return data as AssignedTask
}

export interface AdminDeleteTasksResult {
  deleted_count: number
  deleted_ids: string[]
}

export async function adminDeleteAssignedTasks(
  taskIds: string[],
): Promise<AdminDeleteTasksResult> {
  const ids = Array.from(new Set(taskIds.filter(Boolean)))
  if (ids.length === 0) return { deleted_count: 0, deleted_ids: [] }

  const { data, error } = await supabase.rpc('admin_delete_assigned_tasks', {
    p_task_ids: ids,
  })
  if (error) {
    console.error('[queries/adminTasks] adminDeleteAssignedTasks failed:', error)
    throw new Error(error.message)
  }
  return data as AdminDeleteTasksResult
}
