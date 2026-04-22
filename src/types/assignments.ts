// Assignment-system TypeScript types.
//
// Shape mirrors the Phase 1 RPC return payloads from PR #6 exactly.
// Field names match the DB / RPC output (snake_case) so we don't need
// a camelCase conversion layer at the edge. Keep in sync with:
//   - public.get_member_assigned_tasks → AssignedTask[]
//   - public.get_assignment_notifications → AssignmentNotification[]
//   - assign_*_to_members RPCs → AssignmentBatchSummary

export type AssignmentType = 'custom_task' | 'template_full' | 'template_partial'

// `daily_checklist` is reserved for the forthcoming checklist fold-in
// (see docs/assignment-task-model.md §"Daily checklists"). The UI
// already branches on it so once the migration writes the source tag,
// rows render with the correct origin label without another deploy.
export type AssignedSourceType =
  | 'custom'
  | 'template_full'
  | 'template_partial'
  | 'daily_checklist'

export type AssignmentNotificationType =
  | 'task_assigned'
  | 'template_assigned'
  | 'partial_template_assigned'
  // PR #13 — session-assign notifications flow through the same
  // notifications table; `batch` is null, `session` is populated.
  | 'session_assigned'
  | 'session_reassigned'

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

// Scope tag introduced by the 20260422 scope-foundation migration.
//   member  → one assignee; only that assignee (or admin) can complete it
//   studio  → shared studio task (no assignee); any team member can complete
export type AssignedTaskScope = 'member' | 'studio'

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
  // Scope-foundation fields (nullable until the migration is applied on the
  // target DB — the query-layer normalizer fills in safe defaults).
  // `assigned_to` mirrors the underlying column name on `assigned_tasks`
  // rather than inventing an `_member_id` alias.
  scope: AssignedTaskScope
  assigned_to: string | null
  assigned_to_name: string | null
  // Server-computed permission flag returned by get_*_assigned_tasks —
  // true when the current viewer may toggle completion for this task.
  can_complete: boolean
  // Team Tasks + Studio Tasks may surface rows that don't belong to a
  // specific assignment batch (e.g. future daily-checklist fold-in), so
  // the UI has to tolerate a null batch gracefully.
  batch: AssignmentBatchRef | null
}

// Embedded session summary on session-assign notifications.
// Mirrors the CASE-built payload in get_assignment_notifications.
export interface SessionNotificationRef {
  id: string
  client_name: string | null
  session_date: string  // 'YYYY-MM-DD'
  start_time: string    // 'HH:MM:SS'
  end_time: string      // 'HH:MM:SS'
  room: string | null
  status: string
}

export interface AssignmentNotification {
  id: string
  // Either batch_id OR session_id is non-null (DB-enforced XOR). The
  // notification_type tells you which shape `batch` / `session` carries.
  batch_id: string | null
  session_id: string | null
  notification_type: AssignmentNotificationType
  title: string
  body: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
  batch: AssignmentBatchRef | null
  session: SessionNotificationRef | null
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
  // PR #14 — 'studio' writes a single row with no assignee (scope='studio').
  // When 'studio', the member_ids array is ignored by the RPC.
  scope?: AssignedTaskScope
}

// ── Template types (PR #9 Assign-page surface) ────────────────────────
//
// Mirrors `task_templates` + `task_template_items` rows + the shapes
// returned by get_task_template_library / get_task_template_detail.

export type TemplateKind = 'admin_blueprint' | 'recurring_checklist'

export interface TaskTemplate {
  id: string
  name: string
  description: string | null
  role_tag: string | null
  template_kind: TemplateKind
  is_onboarding: boolean
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface TaskTemplateItem {
  id: string
  template_id: string
  title: string
  description: string | null
  category: string | null
  sort_order: number
  is_required: boolean
  default_due_offset_days: number | null
  created_at: string
  updated_at: string
}

// Summary returned by get_task_template_library — extends the row with
// an item_count rollup so the library list can render density at a glance.
export interface TaskTemplateLibraryEntry extends TaskTemplate {
  item_count: number
}

// Detail returned by get_task_template_detail — template + all items.
export interface TaskTemplateDetail {
  template: TaskTemplate
  items: TaskTemplateItem[]
}

// Payload for create_task_template RPC.
export interface CreateTemplateInput {
  name: string
  description?: string | null
  role_tag?: string | null
  is_onboarding?: boolean
}

// Payload for update_task_template — all fields optional (partial update).
export interface UpdateTemplateInput {
  name?: string | null
  description?: string | null
  role_tag?: string | null
  is_onboarding?: boolean | null
  is_active?: boolean | null
}

// Payload for add_task_template_item RPC.
export interface AddTemplateItemInput {
  title: string
  description?: string | null
  category?: string | null
  sort_order?: number
  is_required?: boolean
  default_due_offset_days?: number | null
}

// Payload for update_task_template_item — all fields optional.
export interface UpdateTemplateItemInput {
  title?: string | null
  description?: string | null
  category?: string | null
  sort_order?: number | null
  is_required?: boolean | null
  default_due_offset_days?: number | null
}

// Return shape of assign_template_preview RPC.
export interface AssignTemplatePreview {
  template: TaskTemplate
  items: TaskTemplateItem[]
  item_count: number
}

// Common overrides accepted by assign_template(_items)_to_members.
export interface TemplateAssignOverrides {
  due_date?: string | null
  title_override?: string | null
  description_override?: string | null
  show_on_overview?: boolean
}
