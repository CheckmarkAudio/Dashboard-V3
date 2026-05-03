// Phase 6.3.5 — Assignment queries for the admin Hub's "Tasks" tab.
//
// Centralizes the read/write paths for assigning things to a team
// member: recurring templates, client projects, education students,
// and artist-pipeline entries. Keeps TeamManager.tsx (Add Member
// flow) and the Hub's MemberAssignmentsPanel on the same code path so
// new assignment types can be added in one place.
//
// KPI assignment is intentionally NOT here. KPIs are measurements
// (`kpi_entries`) not assignments — there's no single table to flip.
// If/when KPI *definitions* become owned-by-member, extend this file.

import { supabase } from '../supabase'
import type {
  ReportTemplate,
  TaskAssignment,
  Project,
  EducationStudent,
  ArtistPipelineEntry,
} from '../../types'
import type {
  AssignedTask,
  AssignmentBatchSummary,
  AssignmentNotification,
  CustomTaskAssignmentPayload,
} from '../../types/assignments'

// ─── Template assignments (task_assignments rows) ────────────────────

/** Row shape we need for the templates section: the assignment id plus
 * the joined template record. `position` is included so the UI can warn
 * when a row is position-scoped (removing it affects multiple members). */
export interface MemberTemplateAssignment {
  assignment_id: string
  template: ReportTemplate
  position: string | null
}

/** Fetch every active task_assignments row tied to this member, either
 * directly (`intern_id = memberId`) or via their position. The UI
 * differentiates the two because unassigning a position-scoped row
 * affects every member in that position. */
export async function loadMemberTemplateAssignments(
  memberId: string,
  memberPosition: string | null,
): Promise<MemberTemplateAssignment[]> {
  // OR filter: intern_id = memberId OR (position = memberPosition AND intern_id IS NULL)
  // supabase-js doesn't support the NULL-check inside an `.or()`, so we
  // run two queries and merge.
  const direct = supabase
    .from('task_assignments')
    .select('id, position, report_templates(*)')
    .eq('intern_id', memberId)
    .eq('is_active', true)

  const positional = memberPosition
    ? supabase
        .from('task_assignments')
        .select('id, position, report_templates(*)')
        .eq('position', memberPosition)
        .is('intern_id', null)
        .eq('is_active', true)
    : Promise.resolve({ data: [] as unknown[], error: null })

  const [directRes, positionalRes] = await Promise.all([direct, positional])
  if ((directRes as { error: unknown }).error) {
    console.error('[queries/assignments] direct lookup failed:', (directRes as { error: unknown }).error)
  }
  if ((positionalRes as { error: unknown }).error) {
    console.error('[queries/assignments] positional lookup failed:', (positionalRes as { error: unknown }).error)
  }

  const rows = [
    ...((directRes as { data: unknown[] | null }).data ?? []),
    ...((positionalRes as { data: unknown[] | null }).data ?? []),
  ] as Array<{ id: string; position: string | null; report_templates: ReportTemplate | null }>

  return rows
    .filter((r) => r.report_templates !== null)
    .map((r) => ({
      assignment_id: r.id,
      template: r.report_templates as ReportTemplate,
      position: r.position,
    }))
}

/** Add templates to a member. Direct (intern_id) assignments only —
 * position-scoped rows are managed elsewhere. Returns the rows written. */
export async function assignTemplatesDirect(
  memberId: string,
  templateIds: string[],
  assignedBy: string | null | undefined,
): Promise<TaskAssignment[]> {
  if (templateIds.length === 0) return []
  const inserts = templateIds.map((template_id) => ({
    template_id,
    intern_id: memberId,
    position: null as string | null,
    is_active: true,
    assigned_by: assignedBy ?? null,
  }))
  const { data, error } = await supabase
    .from('task_assignments')
    .insert(inserts)
    .select('*')
  if (error) {
    console.error('[queries/assignments] assignTemplatesDirect failed:', error)
    throw new Error(error.message)
  }
  return (data ?? []) as TaskAssignment[]
}

/** Remove a single task_assignments row. The UI confirms before
 * calling this so we don't need a soft-delete path. */
export async function removeTemplateAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('task_assignments')
    .delete()
    .eq('id', assignmentId)
  if (error) {
    console.error('[queries/assignments] removeTemplateAssignment failed:', error)
    throw new Error(error.message)
  }
}

// ─── Generic "flip assigned_to" assignment tables ────────────────────
// projects, education_students, artist_pipeline all share the same
// shape: a single `assigned_to uuid` column on the row. We expose a
// typed reader for each plus a shared writer.

export async function loadProjectsForMember(memberId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('assigned_to', memberId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[queries/assignments] loadProjectsForMember failed:', error)
    return []
  }
  return (data ?? []) as Project[]
}

/** Fetch projects currently without an assignee, or (if `includeAll`)
 * every project regardless of assignee. The picker uses `includeAll`
 * and flags already-assigned rows with a warning. */
export async function loadAssignableProjects(includeAll = false): Promise<Project[]> {
  const q = supabase
    .from('projects')
    .select('*')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
  const { data, error } = includeAll ? await q : await q.is('assigned_to', null)
  if (error) {
    console.error('[queries/assignments] loadAssignableProjects failed:', error)
    return []
  }
  return (data ?? []) as Project[]
}

export async function setProjectAssignee(
  projectId: string,
  memberId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ assigned_to: memberId })
    .eq('id', projectId)
  if (error) {
    console.error('[queries/assignments] setProjectAssignee failed:', error)
    throw new Error(error.message)
  }
}

export async function loadStudentsForMember(memberId: string): Promise<EducationStudent[]> {
  const { data, error } = await supabase
    .from('education_students')
    .select('*')
    .eq('assigned_to', memberId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[queries/assignments] loadStudentsForMember failed:', error)
    return []
  }
  return (data ?? []) as EducationStudent[]
}

export async function loadAssignableStudents(includeAll = false): Promise<EducationStudent[]> {
  const q = supabase
    .from('education_students')
    .select('*')
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
  const { data, error } = includeAll ? await q : await q.is('assigned_to', null)
  if (error) {
    console.error('[queries/assignments] loadAssignableStudents failed:', error)
    return []
  }
  return (data ?? []) as EducationStudent[]
}

export async function setStudentAssignee(
  studentId: string,
  memberId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('education_students')
    .update({ assigned_to: memberId })
    .eq('id', studentId)
  if (error) {
    console.error('[queries/assignments] setStudentAssignee failed:', error)
    throw new Error(error.message)
  }
}

export async function loadArtistsForMember(memberId: string): Promise<ArtistPipelineEntry[]> {
  const { data, error } = await supabase
    .from('artist_pipeline')
    .select('*')
    .eq('assigned_to', memberId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[queries/assignments] loadArtistsForMember failed:', error)
    return []
  }
  return (data ?? []) as ArtistPipelineEntry[]
}

export async function loadAssignableArtists(includeAll = false): Promise<ArtistPipelineEntry[]> {
  const q = supabase
    .from('artist_pipeline')
    .select('*')
    .neq('stage', 'alumni')
    .order('created_at', { ascending: false })
  const { data, error } = includeAll ? await q : await q.is('assigned_to', null)
  if (error) {
    console.error('[queries/assignments] loadAssignableArtists failed:', error)
    return []
  }
  return (data ?? []) as ArtistPipelineEntry[]
}

export async function setArtistAssignee(
  artistId: string,
  memberId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('artist_pipeline')
    .update({ assigned_to: memberId })
    .eq('id', artistId)
  if (error) {
    console.error('[queries/assignments] setArtistAssignee failed:', error)
    throw new Error(error.message)
  }
}

// ─── Assignment-backed task queries ───────────────────────────────────

function normalizeAssignedTask(task: Partial<AssignedTask>): AssignedTask {
  return {
    id: task.id ?? '',
    title: task.title ?? 'Untitled task',
    description: task.description ?? null,
    category: task.category ?? null,
    sort_order: task.sort_order ?? 0,
    is_required: task.is_required ?? false,
    is_completed: task.is_completed ?? false,
    completed_at: task.completed_at ?? null,
    due_date: task.due_date ?? null,
    visible_on_overview: task.visible_on_overview ?? true,
    source_type: task.source_type ?? 'custom',
    source_template_id: task.source_template_id ?? null,
    source_template_item_id: task.source_template_item_id ?? null,
    created_at: task.created_at ?? new Date(0).toISOString(),
    updated_at: task.updated_at ?? task.created_at ?? new Date(0).toISOString(),
    scope: task.scope ?? 'member',
    assigned_to: task.assigned_to ?? null,
    assigned_to_name: task.assigned_to_name ?? null,
    can_complete: task.can_complete ?? false,
    batch: task.batch ?? null,
    studio_space: task.studio_space ?? null,
  }
}

function normalizeAssignedTasks(rows: unknown): AssignedTask[] {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => normalizeAssignedTask((row ?? {}) as Partial<AssignedTask>))
}

function remapAssignmentRpcError(error: { message?: string } | null, fallback: string): Error {
  const message = error?.message ?? fallback
  if (
    message.includes('Could not find the function public.get_team_assigned_tasks') ||
    message.includes('Could not find the function public.get_studio_assigned_tasks')
  ) {
    return new Error('This view needs the assigned_tasks scope migration before it can load real data.')
  }
  return new Error(message)
}

export async function fetchMemberAssignedTasks(
  userId: string,
  opts: { includeCompleted?: boolean; onlyOverview?: boolean } = {},
): Promise<AssignedTask[]> {
  const { data, error } = await supabase.rpc('get_member_assigned_tasks', {
    p_user_id: userId,
    p_include_completed: opts.includeCompleted ?? false,
    p_only_overview: opts.onlyOverview ?? false,
  })
  if (error) {
    console.error('[queries/assignments] fetchMemberAssignedTasks failed:', error)
    throw new Error(error.message)
  }
  return normalizeAssignedTasks(data)
}

export async function fetchTeamAssignedTasks(
  userId: string,
  opts: { includeCompleted?: boolean } = {},
): Promise<AssignedTask[]> {
  const { data, error } = await supabase.rpc('get_team_assigned_tasks', {
    p_user_id: userId,
    p_include_completed: opts.includeCompleted ?? false,
  })
  if (error) {
    console.error('[queries/assignments] fetchTeamAssignedTasks failed:', error)
    throw remapAssignmentRpcError(error, 'Could not load team tasks.')
  }
  return normalizeAssignedTasks(data)
}

export async function fetchStudioAssignedTasks(
  userId: string,
  opts: { includeCompleted?: boolean } = {},
): Promise<AssignedTask[]> {
  const { data, error } = await supabase.rpc('get_studio_assigned_tasks', {
    p_user_id: userId,
    p_include_completed: opts.includeCompleted ?? false,
  })
  if (error) {
    console.error('[queries/assignments] fetchStudioAssignedTasks failed:', error)
    throw remapAssignmentRpcError(error, 'Could not load studio tasks.')
  }
  return normalizeAssignedTasks(data)
}

export async function completeAssignedTask(
  taskId: string,
  isCompleted: boolean,
): Promise<AssignedTask> {
  const { data, error } = await supabase.rpc('complete_assigned_task', {
    p_assigned_task_id: taskId,
    p_is_completed: isCompleted,
  })
  if (error) {
    console.error('[queries/assignments] completeAssignedTask failed:', error)
    throw new Error(error.message)
  }
  return normalizeAssignedTask((data ?? {}) as Partial<AssignedTask>)
}

export async function fetchAssignmentNotifications(
  userId: string,
  opts: { unreadOnly?: boolean; limit?: number } = {},
): Promise<AssignmentNotification[]> {
  const { data, error } = await supabase.rpc('get_assignment_notifications', {
    p_user_id: userId,
    p_unread_only: opts.unreadOnly ?? false,
    p_limit: opts.limit ?? 20,
  })
  if (error) {
    console.error('[queries/assignments] fetchAssignmentNotifications failed:', error)
    throw new Error(error.message)
  }
  return (data as AssignmentNotification[] | null) ?? []
}

export async function markAssignmentNotificationRead(
  notificationId: string,
): Promise<{ success: boolean; notification_id: string; is_read: boolean; read_at: string | null }> {
  const { data, error } = await supabase.rpc('mark_assignment_notification_read', {
    p_notification_id: notificationId,
  })
  if (error) {
    console.error('[queries/assignments] markAssignmentNotificationRead failed:', error)
    throw new Error(error.message)
  }
  return data as { success: boolean; notification_id: string; is_read: boolean; read_at: string | null }
}

/** PR #48 — bulk-acknowledge every unread assignment notification for
 *  the caller in one shot. Server-side filter is `recipient_id =
 *  auth.uid() AND is_read = false`, so the call is purely self-service
 *  and never touches another user's rows. */
export async function markAllAssignmentNotificationsRead(): Promise<{
  success: boolean
  notifications_marked: number
}> {
  const { data, error } = await supabase.rpc('mark_all_assignment_notifications_read')
  if (error) {
    console.error('[queries/assignments] markAllAssignmentNotificationsRead failed:', error)
    throw new Error(error.message)
  }
  return data as { success: boolean; notifications_marked: number }
}

/**
 * Admin assigns a custom task. Atomic (batch + recipients + tasks +
 * notifications in one transaction).
 *
 * PR #14 adds scope support:
 *   - scope='member' (default): one task row per memberId, each with
 *     its own notification (existing behavior).
 *   - scope='studio': single shared task row, no assignee, no
 *     notifications. memberIds is ignored server-side.
 */
export async function assignCustomTaskToMembers(
  memberIds: string[],
  payload: CustomTaskAssignmentPayload,
): Promise<AssignmentBatchSummary> {
  const { data, error } = await supabase.rpc('assign_custom_task_to_members', {
    p_member_ids: memberIds,
    p_title: payload.title,
    p_description: payload.description ?? null,
    p_category: payload.category ?? null,
    p_due_date: payload.due_date ?? null,
    p_is_required: payload.is_required ?? false,
    p_show_on_overview: payload.show_on_overview ?? true,
    p_scope: payload.scope ?? 'member',
  })
  if (error) {
    console.error('[queries/assignments] assignCustomTaskToMembers failed:', error)
    throw new Error(error.message)
  }
  return data as AssignmentBatchSummary
}

/**
 * PR #42 — multi-task variant. The new row-by-row +Task modal
 * submits a list of task drafts (custom rows + items pulled from a
 * template) as ONE batch via this RPC. Each recipient gets a single
 * "N new tasks" notification instead of N separate ones.
 */
export interface CustomTaskDraft {
  title: string
  description?: string | null
  category?: string | null
  due_date?: string | null
  is_required?: boolean
  show_on_overview?: boolean
  /** Only meaningful for studio-scope tasks. Server CHECK enforces it
   * is one of `'Control Room' | 'Studio A' | 'Studio B'` and that the
   * surrounding scope is `'studio'`. Member-scope drafts ignore it. */
  studio_space?: 'Control Room' | 'Studio A' | 'Studio B' | null
}

export async function assignCustomTasksToMembers(
  memberIds: string[],
  tasks: CustomTaskDraft[],
  opts: { scope?: 'member' | 'studio'; batchTitle?: string | null } = {},
): Promise<AssignmentBatchSummary & { batch_title: string }> {
  const { data, error } = await supabase.rpc('assign_custom_tasks_to_members', {
    p_member_ids: memberIds,
    p_tasks: tasks,
    p_batch_title: opts.batchTitle ?? null,
    p_scope: opts.scope ?? 'member',
  })
  if (error) {
    console.error('[queries/assignments] assignCustomTasksToMembers failed:', error)
    throw new Error(error.message)
  }
  return data as AssignmentBatchSummary & { batch_title: string }
}
