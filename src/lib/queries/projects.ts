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
  title: string
  due_date: string | null
  is_completed: boolean
  completed_at: string | null
  sort_order: number
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
  tasks: ProjectTask[]
  updates: ProjectUpdate[]
}> {
  const [projectResult, tasksResult, updatesResult] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase
      .from('assigned_tasks')
      .select('id, project_id, title, due_date, is_completed, completed_at, sort_order')
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
  const error = projectResult.error ?? tasksResult.error ?? updatesResult.error
  if (error) throw new Error(error.message)
  return {
    project: projectResult.data as Project,
    tasks: (tasksResult.data ?? []) as ProjectTask[],
    updates: (updatesResult.data ?? []) as ProjectUpdate[],
  }
}

export async function createProject(input: {
  title: string
  objective?: string
  targetDate?: string
}): Promise<Project> {
  const { data, error } = await supabase.rpc('create_project', {
    p_title: input.title,
    p_objective: input.objective || null,
    p_target_date: input.targetDate || null,
  })
  if (error) throw new Error(error.message)
  return data as Project
}

export async function addProjectTask(input: {
  projectId: string
  title: string
  dueDate?: string
}): Promise<ProjectTask> {
  const { data, error } = await supabase.rpc('add_project_task', {
    p_project_id: input.projectId,
    p_title: input.title,
    p_due_date: input.dueDate || null,
  })
  if (error) throw new Error(error.message)
  return data as ProjectTask
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
