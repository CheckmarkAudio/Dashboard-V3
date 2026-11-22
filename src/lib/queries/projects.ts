import { supabase } from '../supabase'

export type ProjectStatus = 'planned' | 'active' | 'paused' | 'completed' | 'archived'

export interface Project {
  id: string
  team_id: string
  owner_id: string
  title: string
  objective: string | null
  status: ProjectStatus
  target_date: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  is_pinned?: boolean
  cover_url?: string | null
}

export interface ProjectMember {
  member_id: string
  display_name: string
  avatar_url: string | null
}

export interface ProjectTeamMember {
  id: string
  display_name: string
  avatar_url: string | null
  role: string | null
}

export interface ProjectTask {
  id: string
  project_id: string
  project_objective_id: string | null
  title: string
  due_date: string | null
  is_completed: boolean
  completed_at: string | null
  sort_order: number
}

export interface ProjectObjective {
  id: string
  project_id: string
  title: string
  sort_order: number
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

export interface ProjectUpdate {
  id: string
  project_id: string
  task_id: string | null
  author_id: string
  note: string
  created_at: string
}

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  cardMeta: (ids: string[]) => [...projectKeys.all, 'card-meta', ...ids] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
}

export async function fetchProjects(): Promise<Project[]> {
  const [projectsResult, pinsResult] = await Promise.all([
    supabase.from('projects').select('*').neq('status', 'archived').order('updated_at', { ascending: false }),
    supabase.from('project_pins').select('project_id'),
  ])
  const error = projectsResult.error ?? pinsResult.error
  if (error) throw new Error(error.message)
  const pinned = new Set((pinsResult.data ?? []).map((row) => row.project_id as string))
  return ((projectsResult.data ?? []) as Project[])
    .map((project) => ({ ...project, is_pinned: pinned.has(project.id) }))
    .sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)))
}

export interface ProjectCardMeta {
  objectiveCount: number
  completedCount: number
  members: ProjectMember[]
}

function memberFromJoin(row: any): ProjectMember {
  const joined = Array.isArray(row.member) ? row.member[0] : row.member
  return {
    member_id: row.member_id as string,
    display_name: joined?.display_name ?? 'Team member',
    avatar_url: joined?.avatar_url ?? null,
  }
}

export async function fetchProjectCardMeta(projectIds: string[]): Promise<Record<string, ProjectCardMeta>> {
  const meta: Record<string, ProjectCardMeta> = {}
  for (const id of projectIds) meta[id] = { objectiveCount: 0, completedCount: 0, members: [] }
  if (projectIds.length === 0) return meta
  const [objectivesResult, membersResult] = await Promise.all([
    supabase.from('project_objectives').select('project_id, is_completed').in('project_id', projectIds),
    supabase.from('project_members').select('project_id, member_id, member:team_members!project_members_member_id_fkey(display_name, avatar_url)').in('project_id', projectIds),
  ])
  const error = objectivesResult.error ?? membersResult.error
  if (error) throw new Error(error.message)
  for (const row of objectivesResult.data ?? []) {
    const entry = meta[row.project_id as string]
    if (!entry) continue
    entry.objectiveCount += 1
    if (row.is_completed) entry.completedCount += 1
  }
  for (const row of membersResult.data ?? []) {
    const entry = meta[(row as { project_id: string }).project_id]
    if (entry) entry.members.push(memberFromJoin(row))
  }
  return meta
}

export async function fetchProjectDetail(projectId: string): Promise<{
  project: Project
  objectives: ProjectObjective[]
  tasks: ProjectTask[]
  updates: ProjectUpdate[]
  members: ProjectMember[]
  teamMembers: ProjectTeamMember[]
  currentMemberId: string | null
}> {
  const [projectResult, objectivesResult, tasksResult, updatesResult, membersResult, teamResult, userResult] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase
      .from('project_objectives')
      .select('id, project_id, title, sort_order, is_completed, completed_at, created_at')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('assigned_tasks')
      .select('id, project_id, project_objective_id, title, due_date, is_completed, completed_at, sort_order')
      .eq('project_id', projectId)
      .order('is_completed', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('project_updates')
      .select('id, project_id, task_id, author_id, note, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase.from('project_members').select('member_id, member:team_members!project_members_member_id_fkey(display_name, avatar_url)').eq('project_id', projectId),
    supabase.from('team_members').select('id, display_name, avatar_url, role').eq('status', 'active').order('display_name'),
    supabase.auth.getUser(),
  ])
  const error = projectResult.error ?? objectivesResult.error ?? tasksResult.error ?? updatesResult.error ?? membersResult.error ?? teamResult.error
  if (error) throw new Error(error.message)
  const members = (membersResult.data ?? []).map((row: any) => memberFromJoin(row))
  return {
    project: projectResult.data as Project,
    objectives: (objectivesResult.data ?? []) as ProjectObjective[],
    tasks: (tasksResult.data ?? []) as ProjectTask[],
    updates: (updatesResult.data ?? []) as ProjectUpdate[],
    members,
    teamMembers: (teamResult.data ?? []) as ProjectTeamMember[],
    currentMemberId: userResult.data.user?.id ?? null,
  }
}

export async function setProjectPin(projectId: string, isPinned: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_project_pin', { p_project_id: projectId, p_is_pinned: isPinned })
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function setProjectMember(input: { projectId: string; memberId: string; isMember: boolean }): Promise<void> {
  const { error } = await supabase.rpc('set_project_member', {
    p_project_id: input.projectId,
    p_member_id: input.memberId,
    p_is_member: input.isMember,
  })
  if (error) throw new Error(error.message)
}

export async function completeProjectTask(taskId: string, isCompleted: boolean): Promise<ProjectTask> {
  const { data, error } = await supabase.rpc('complete_project_task', {
    p_task_id: taskId,
    p_is_completed: isCompleted,
  })
  if (error) throw new Error(error.message)
  return data as ProjectTask
}

export async function createProject(input: {
  title: string
  description?: string
  targetDate?: string
  objectives?: string[]
}): Promise<Project> {
  const { data, error } = await supabase.rpc('create_project_with_objectives', {
    p_title: input.title,
    p_description: input.description || null,
    p_target_date: input.targetDate || null,
    p_objectives: input.objectives ?? [],
  })
  if (error) throw new Error(error.message)
  return data as Project
}

export async function addProjectObjective(input: {
  projectId: string
  title: string
}): Promise<ProjectObjective> {
  const { data, error } = await supabase.rpc('add_project_objective', {
    p_project_id: input.projectId,
    p_title: input.title,
  })
  if (error) throw new Error(error.message)
  return data as ProjectObjective
}

export async function addProjectObjectiveTask(input: {
  projectId: string
  objectiveId: string
  title: string
  dueDate?: string
}): Promise<ProjectTask> {
  const { data, error } = await supabase.rpc('add_project_objective_task', {
    p_project_id: input.projectId,
    p_objective_id: input.objectiveId,
    p_title: input.title,
    p_due_date: input.dueDate || null,
  })
  if (error) throw new Error(error.message)
  return data as ProjectTask
}

export async function completeProjectObjective(
  objectiveId: string,
  isCompleted: boolean,
): Promise<ProjectObjective> {
  const { data, error } = await supabase.rpc('complete_project_objective', {
    p_objective_id: objectiveId,
    p_is_completed: isCompleted,
  })
  if (error) throw new Error(error.message)
  return data as ProjectObjective
}

export async function updateProjectDetails(input: {
  projectId: string
  title: string
  description?: string
  targetDate?: string
}): Promise<Project> {
  const { data, error } = await supabase.rpc('update_project_details', {
    p_project_id: input.projectId,
    p_title: input.title,
    p_description: input.description || null,
    p_target_date: input.targetDate || null,
  })
  if (error) throw new Error(error.message)
  return data as Project
}

export async function archiveProject(projectId: string): Promise<Project> {
  const { data, error } = await supabase.rpc('archive_project', { p_project_id: projectId })
  if (error) throw new Error(error.message)
  return data as Project
}

export async function completeProject(
  projectId: string,
  isCompleted: boolean,
): Promise<Project> {
  const { data, error } = await supabase.rpc('complete_project', {
    p_project_id: projectId,
    p_is_completed: isCompleted,
  })
  if (error) throw new Error(error.message)
  return data as Project
}

export async function updateProjectObjective(input: {
  objectiveId: string
  title: string
}): Promise<ProjectObjective> {
  const { data, error } = await supabase.rpc('update_project_objective', {
    p_objective_id: input.objectiveId,
    p_title: input.title,
  })
  if (error) throw new Error(error.message)
  return data as ProjectObjective
}

export async function deleteProjectObjective(objectiveId: string): Promise<number> {
  const { data, error } = await supabase.rpc('delete_project_objective', {
    p_objective_id: objectiveId,
  })
  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : 0
}

export async function reorderProjectObjectives(input: {
  projectId: string
  objectiveIds: string[]
}): Promise<void> {
  const { error } = await supabase.rpc('reorder_project_objectives', {
    p_project_id: input.projectId,
    p_objective_ids: input.objectiveIds,
  })
  if (error) throw new Error(error.message)
}

export async function updateProjectTask(input: {
  taskId: string
  title: string
  dueDate?: string
}): Promise<ProjectTask> {
  const { data, error } = await supabase.rpc('update_project_task', {
    p_task_id: input.taskId,
    p_title: input.title,
    p_due_date: input.dueDate || null,
  })
  if (error) throw new Error(error.message)
  return data as ProjectTask
}

export async function deleteProjectTask(taskId: string): Promise<string> {
  const { data, error } = await supabase.rpc('delete_project_task', { p_task_id: taskId })
  if (error) throw new Error(error.message)
  return data as string
}

export async function addProjectProgressNote(input: {
  projectId: string
  taskId: string | null
  note: string
}): Promise<ProjectUpdate> {
  const { data, error } = await supabase.rpc('add_project_progress_note', {
    p_project_id: input.projectId,
    p_task_id: input.taskId,
    p_note: input.note,
  })
  if (error) throw new Error(error.message)
  return data as ProjectUpdate
}
