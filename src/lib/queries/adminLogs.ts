// PR #44 — Assign Log widget feed.
// PR #45 will add the Approval Log alongside this.

import { supabase } from '../supabase'

export interface RecentAssignmentRow {
  // 'task'    — member-scope, has individual assignee
  // 'studio'  — studio-pool, no assignee
  // 'session' — session booking with engineer
  kind: 'task' | 'studio' | 'session'
  ref_id: string
  title: string
  assignee_id: string | null
  assignee_name: string | null
  target_date: string | null  // YYYY-MM-DD (due_date or session_date)
  created_at: string
}

export const adminLogKeys = {
  recentAssignments: (limit: number) => ['admin-log', 'assignments', limit] as const,
}

export async function fetchRecentAssignments(
  limit = 30,
): Promise<RecentAssignmentRow[]> {
  const { data, error } = await supabase.rpc('admin_recent_assignments', {
    p_limit: limit,
  })
  if (error) {
    console.error('[queries/adminLogs] fetchRecentAssignments failed:', error)
    throw new Error(error.message)
  }
  if (!Array.isArray(data)) return []
  return data as RecentAssignmentRow[]
}
