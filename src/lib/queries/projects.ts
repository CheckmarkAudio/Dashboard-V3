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
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Project[]
}

export async function fetchProjectDetail(projectId: string): Promise<{
  project: Project
  objectives: ProjectObjective[]
  tasks: ProjectTask[]
  updates: ProjectUpdate[]
}> {
  const [projectResult, objectivesResult, tasksResult, updatesResult] = await Promise.all([
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
  ])
  const error = projectResult.error ?? objectivesResult.error ?? tasksResult.error ?? updatesResult.error
  if (error) throw new Error(error.message)
  return {
    project: projectResult.data as Project,
    objectives: (objectivesResult.data ?? []) as ProjectObjective[],
    tasks: (tasksResult.data ?? []) as ProjectTask[],
    updates: (updatesResult.data ?? []) as ProjectUpdate[],
  }
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
