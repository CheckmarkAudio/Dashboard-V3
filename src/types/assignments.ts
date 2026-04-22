// Assignment-system TypeScript types.
//
// Shape mirrors the Phase 1 RPC return payloads from PR #6 exactly.
// Field names match the DB / RPC output (snake_case) so we don't need
// a camelCase conversion layer at the edge. Keep in sync with:
//   - public.get_member_assigned_tasks → AssignedTask[]
//   - public.get_assignment_notifications → AssignmentNotification[]
//   - assign_*_to_members RPCs → AssignmentBatchSummary

export type AssignmentType = 'custom_task' | 'template_full' | 'template_partial'

export type AssignedSourceType = 'custom' | 'template_full' | 'template_partial'

export type AssignmentNotificationType =
  | 'task_assigned'
  | 'template_assigned'
  | 'partial_template_assigned'

// Embedded batch summary that every assigned-task / notification row
// carries so the UI can render `Assigned by X on Y` without a join.
export interface AssignmentBatchRef {
  id: string
  assignment_type: AssignmentType
  title: string
  description: string | null
  assigned_by: string
  source_template_id?: string | null
  created_at: string
}

export interface AssignedTask {
  id: string
  title: string
  description: string | null
  category: string | null
  sort_order: number
  is_required: boolean
  is_completed: boolean
  completed_at: string | null
  due_date: string | null
  visible_on_overview: boolean
  source_type: AssignedSourceType
  source_template_id: string | null
  source_template_item_id: string | null
  created_at: string
  updated_at: string
  batch: AssignmentBatchRef
}

export interface AssignmentNotification {
  id: string
  batch_id: string
  notification_type: AssignmentNotificationType
  title: string
  body: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
  batch: AssignmentBatchRef
}

// Structured response from every assign_* RPC.
export interface AssignmentBatchSummary {
  batch_id: string
  recipient_count: number
  task_count: number
  notification_count: number
}

// Payload shape accepted by `assignCustomTaskToMembers` in the query
// helpers. Mirrors the RPC params.
export interface CustomTaskAssignmentPayload {
  title: string
  description?: string | null
  category?: string | null
  due_date?: string | null
  is_required?: boolean
  show_on_overview?: boolean
}
