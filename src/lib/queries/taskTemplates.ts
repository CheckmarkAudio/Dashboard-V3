// Query helpers for the task-assignment template system.
//
// Admin surface (`/admin/templates`, PR #9) calls these exclusively —
// no direct table writes. Wraps the SECURITY DEFINER RPCs from PR #6
// (library + assign actions) and PR #8 (edit ops + preview).
//
// Pattern matches `src/lib/queries/assignments.ts`: async, throw-on-
// error, `[queries/taskTemplates]` log prefix, return typed.

import { supabase } from '../supabase'
import type {
  AddTemplateItemInput,
  AssignmentBatchSummary,
  AssignTemplatePreview,
  CreateTemplateInput,
  TaskTemplate,
  TaskTemplateDetail,
  TaskTemplateItem,
  TaskTemplateLibraryEntry,
  TemplateAssignOverrides,
  UpdateTemplateInput,
  UpdateTemplateItemInput,
} from '../../types/assignments'

const LOG_PREFIX = '[queries/taskTemplates]'

// ─── Library ─────────────────────────────────────────────────────────

export async function fetchTaskTemplateLibrary(
  opts: { roleTag?: string | null; includeInactive?: boolean } = {},
): Promise<TaskTemplateLibraryEntry[]> {
  const { data, error } = await supabase.rpc('get_task_template_library', {
    p_role_tag: opts.roleTag ?? null,
    p_include_inactive: opts.includeInactive ?? false,
  })
  if (error) {
    console.error(`${LOG_PREFIX} fetchTaskTemplateLibrary failed:`, error)
    throw new Error(error.message)
  }
  return (data as TaskTemplateLibraryEntry[] | null) ?? []
}

export async function fetchTaskTemplateDetail(
  templateId: string,
): Promise<TaskTemplateDetail> {
  const { data, error } = await supabase.rpc('get_task_template_detail', {
    p_template_id: templateId,
  })
  if (error) {
    console.error(`${LOG_PREFIX} fetchTaskTemplateDetail failed:`, error)
    throw new Error(error.message)
  }
  return data as TaskTemplateDetail
}

// ─── Template CRUD ───────────────────────────────────────────────────

export async function createTaskTemplate(
  input: CreateTemplateInput,
): Promise<TaskTemplate> {
  const { data, error } = await supabase.rpc('create_task_template', {
    p_name: input.name,
    p_description: input.description ?? null,
    p_role_tag: input.role_tag ?? null,
    p_is_onboarding: input.is_onboarding ?? false,
  })
  if (error) {
    console.error(`${LOG_PREFIX} createTaskTemplate failed:`, error)
    throw new Error(error.message)
  }
  return data as TaskTemplate
}

export async function updateTaskTemplate(
  templateId: string,
  patch: UpdateTemplateInput,
): Promise<TaskTemplate> {
  const { data, error } = await supabase.rpc('update_task_template', {
    p_template_id: templateId,
    p_name: patch.name ?? null,
    p_description: patch.description ?? null,
    p_role_tag: patch.role_tag ?? null,
    p_is_onboarding: patch.is_onboarding ?? null,
    p_is_active: patch.is_active ?? null,
  })
  if (error) {
    console.error(`${LOG_PREFIX} updateTaskTemplate failed:`, error)
    throw new Error(error.message)
  }
  return data as TaskTemplate
}

/** Archive (soft-delete) a template by flipping is_active=false.
 *  Phase 2 backend deliberately omitted a DELETE RPC — archiving
 *  preserves historical assignments that still reference the template. */
export async function archiveTaskTemplate(templateId: string): Promise<TaskTemplate> {
  return updateTaskTemplate(templateId, { is_active: false })
}

/** Unarchive — admin can re-enable a template without losing any items. */
export async function unarchiveTaskTemplate(templateId: string): Promise<TaskTemplate> {
  return updateTaskTemplate(templateId, { is_active: true })
}

/** Hard-delete a template and all its items. Past `assigned_tasks`
 *  that referenced it survive thanks to the FK ON DELETE SET NULL
 *  tweak shipped in PR #8 — members keep seeing their tasks with
 *  the copied title/description intact; only the `source_template_*`
 *  back-pointers become NULL. Admin-only. */
export async function deleteTaskTemplate(
  templateId: string,
): Promise<{
  success: boolean
  template_id: string
  template_name: string
  items_removed: number
  assignments_preserved: number
}> {
  const { data, error } = await supabase.rpc('delete_task_template', {
    p_template_id: templateId,
  })
  if (error) {
    console.error(`${LOG_PREFIX} deleteTaskTemplate failed:`, error)
    throw new Error(error.message)
  }
  return data as {
    success: boolean
    template_id: string
    template_name: string
    items_removed: number
    assignments_preserved: number
  }
}

export async function duplicateTaskTemplate(
  templateId: string,
  newName: string,
): Promise<TaskTemplateDetail> {
  const { data, error } = await supabase.rpc('duplicate_task_template', {
    p_template_id: templateId,
    p_new_name: newName,
  })
  if (error) {
    console.error(`${LOG_PREFIX} duplicateTaskTemplate failed:`, error)
    throw new Error(error.message)
  }
  return data as TaskTemplateDetail
}

// ─── Template items ──────────────────────────────────────────────────

export async function addTaskTemplateItem(
  templateId: string,
  input: AddTemplateItemInput,
): Promise<TaskTemplateItem> {
  const { data, error } = await supabase.rpc('add_task_template_item', {
    p_template_id: templateId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_category: input.category ?? null,
    p_sort_order: input.sort_order ?? 0,
    p_is_required: input.is_required ?? false,
    p_default_due_offset_days: input.default_due_offset_days ?? null,
  })
  if (error) {
    console.error(`${LOG_PREFIX} addTaskTemplateItem failed:`, error)
    throw new Error(error.message)
  }
  return data as TaskTemplateItem
}

export async function updateTaskTemplateItem(
  itemId: string,
  patch: UpdateTemplateItemInput,
): Promise<TaskTemplateItem> {
  const { data, error } = await supabase.rpc('update_task_template_item', {
    p_item_id: itemId,
    p_title: patch.title ?? null,
    p_description: patch.description ?? null,
    p_category: patch.category ?? null,
    p_sort_order: patch.sort_order ?? null,
    p_is_required: patch.is_required ?? null,
    p_default_due_offset_days: patch.default_due_offset_days ?? null,
  })
  if (error) {
    console.error(`${LOG_PREFIX} updateTaskTemplateItem failed:`, error)
    throw new Error(error.message)
  }
  return data as TaskTemplateItem
}

export async function deleteTaskTemplateItem(
  itemId: string,
): Promise<{ success: boolean; item_id: string; template_id: string }> {
  const { data, error } = await supabase.rpc('delete_task_template_item', {
    p_item_id: itemId,
  })
  if (error) {
    console.error(`${LOG_PREFIX} deleteTaskTemplateItem failed:`, error)
    throw new Error(error.message)
  }
  return data as { success: boolean; item_id: string; template_id: string }
}

// ─── Assign actions ──────────────────────────────────────────────────

export async function previewTemplateAssignment(
  templateId: string,
  selectedItemIds?: string[] | null,
): Promise<AssignTemplatePreview> {
  const { data, error } = await supabase.rpc('assign_template_preview', {
    p_template_id: templateId,
    p_template_item_ids: selectedItemIds && selectedItemIds.length > 0 ? selectedItemIds : null,
  })
  if (error) {
    console.error(`${LOG_PREFIX} previewTemplateAssignment failed:`, error)
    throw new Error(error.message)
  }
  return data as AssignTemplatePreview
}

export async function assignTemplateToMembers(
  templateId: string,
  memberIds: string[],
  overrides: TemplateAssignOverrides = {},
): Promise<AssignmentBatchSummary> {
  const { data, error } = await supabase.rpc('assign_template_to_members', {
    p_template_id: templateId,
    p_member_ids: memberIds,
    p_due_date: overrides.due_date ?? null,
    p_title_override: overrides.title_override ?? null,
    p_description_override: overrides.description_override ?? null,
    p_show_on_overview: overrides.show_on_overview ?? true,
  })
  if (error) {
    console.error(`${LOG_PREFIX} assignTemplateToMembers failed:`, error)
    throw new Error(error.message)
  }
  return data as AssignmentBatchSummary
}

export async function assignTemplateItemsToMembers(
  templateId: string,
  templateItemIds: string[],
  memberIds: string[],
  overrides: TemplateAssignOverrides = {},
): Promise<AssignmentBatchSummary> {
  const { data, error } = await supabase.rpc('assign_template_items_to_members', {
    p_template_id: templateId,
    p_template_item_ids: templateItemIds,
    p_member_ids: memberIds,
    p_due_date: overrides.due_date ?? null,
    p_title_override: overrides.title_override ?? null,
    p_description_override: overrides.description_override ?? null,
    p_show_on_overview: overrides.show_on_overview ?? true,
  })
  if (error) {
    console.error(`${LOG_PREFIX} assignTemplateItemsToMembers failed:`, error)
    throw new Error(error.message)
  }
  return data as AssignmentBatchSummary
}

// Query-key factory so page/component callers stay consistent with
// cache invalidation after mutations.
export const taskTemplateKeys = {
  all: ['task-templates'] as const,
  library: (roleTag?: string | null, includeInactive?: boolean) =>
    ['task-templates', 'library', roleTag ?? null, includeInactive ?? false] as const,
  detail: (templateId: string) => ['task-templates', 'detail', templateId] as const,
  recentBatches: (limit: number) => ['task-templates', 'recent-batches', limit] as const,
}

// ─── Recent template batches (PR #10 — cancel UI) ────────────────────
//
// Direct table read on `task_assignment_batches` — admin RLS allows
// full read, so no RPC needed. Joined with recipient + item counts
// so the UI can render "N recipients · M tasks" without follow-ups.
// Filtered to template-derived batches (template_full /
// template_partial); pure custom-task batches are handled on the Hub
// Assign widget's "Recently assigned" strip.

export interface RecentAssignmentBatch {
  id: string
  assignment_type: 'template_full' | 'template_partial'
  source_template_id: string
  title: string
  description: string | null
  assigned_by: string
  created_at: string
  recipient_count: number
  cancelled: boolean
}

export async function fetchRecentTemplateBatches(
  limit = 10,
): Promise<RecentAssignmentBatch[]> {
  const { data, error } = await supabase
    .from('task_assignment_batches')
    .select(
      `
        id, assignment_type, source_template_id, title, description,
        assigned_by, created_at,
        assignment_recipients (id, status)
      `,
    )
    .in('assignment_type', ['template_full', 'template_partial'])
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error(`${LOG_PREFIX} fetchRecentTemplateBatches failed:`, error)
    throw new Error(error.message)
  }
  type Row = {
    id: string
    assignment_type: 'template_full' | 'template_partial'
    source_template_id: string
    title: string
    description: string | null
    assigned_by: string
    created_at: string
    assignment_recipients: { id: string; status: string }[]
  }
  return ((data ?? []) as Row[]).map((b) => {
    const recipients = b.assignment_recipients ?? []
    const active = recipients.filter((r) => r.status === 'active').length
    const allCancelled = recipients.length > 0 && active === 0
    return {
      id: b.id,
      assignment_type: b.assignment_type,
      source_template_id: b.source_template_id,
      title: b.title,
      description: b.description,
      assigned_by: b.assigned_by,
      created_at: b.created_at,
      recipient_count: recipients.length,
      cancelled: allCancelled,
    }
  })
}

/** Cancel an assignment batch. Hides open tasks by default; completed
 *  tasks stay visible so history/streaks aren't rewritten. */
export async function cancelAssignmentBatch(
  batchId: string,
  hideOpenTasks = true,
): Promise<{ batch_id: string; cancelled_recipient_count: number; hidden_task_count: number }> {
  const { data, error } = await supabase.rpc('cancel_task_assignment_batch', {
    p_batch_id: batchId,
    p_hide_open_tasks: hideOpenTasks,
  })
  if (error) {
    console.error(`${LOG_PREFIX} cancelAssignmentBatch failed:`, error)
    throw new Error(error.message)
  }
  return data as {
    batch_id: string
    cancelled_recipient_count: number
    hidden_task_count: number
  }
}
