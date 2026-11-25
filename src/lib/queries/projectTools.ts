import { supabase } from '../supabase'
import { emptyBoard, validateBoard, type BoardRecord, type ToolBoard } from '../../domain/projectTools/model'

export const projectToolKeys = { board: (projectId: string) => ['project-tools', projectId] as const }
export async function fetchProjectTools(projectId: string): Promise<BoardRecord> {
  const { data, error } = await supabase.from('project_toolboards').select('project_id, revision, content, updated_at').eq('project_id', projectId).maybeSingle()
  if (error) throw new Error(['42P01','PGRST205'].includes(error.code) ? 'Project tools are awaiting the beta database update. Your existing project tasks are still available below.' : error.message)
  const record = data ?? { project_id: projectId, revision: 0, content: emptyBoard(), updated_at: '' }
  validateBoard(record.content)
  return record as BoardRecord
}
export async function saveProjectTools(projectId: string, revision: number, content: ToolBoard): Promise<BoardRecord> {
  validateBoard(content)
  const { data, error } = await supabase.rpc('save_project_toolboard', { p_project_id: projectId, p_revision: revision, p_content: content })
  if (error) throw new Error(error.code === '40001' ? 'Someone else updated this workspace. Your draft is still here. Copy any changes you need, then load the latest version.' : error.message)
  if (!data || data.revision !== revision + 1) throw new Error('The save could not be confirmed. Your draft is still here.')
  validateBoard(data.content)
  return data as BoardRecord
}
