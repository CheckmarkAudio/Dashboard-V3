import type { ProjectTool } from '../../domain/projectTools/model'

export const EXPLORER_SECTIONS = [
  { id: 'summary', title: 'Summary' },
  { id: 'tasks', title: 'Tasks' },
  { id: 'measurements', title: 'Measurements' },
  { id: 'shopping', title: 'Shopping list' },
  { id: 'blueprints', title: 'Layout blueprints' },
  { id: 'inspo', title: 'Inspo' },
  { id: 'notes', title: 'Notes' },
] as const

export type ExplorerSectionId = typeof EXPLORER_SECTIONS[number]['id']

export interface ExplorerTask {
  id: string
  title: string
  is_completed: boolean
  project_objective_id?: string | null
}

export interface InspoImage {
  id: string
  title: string
  src: string
  local?: boolean
}

export interface ExplorerItem {
  id: string
  section: ExplorerSectionId
  title: string
  subtitle?: string
  done?: boolean
  toolId?: string
  measurementId?: string
  shoppingId?: string
  taskId?: string
  inspoId?: string
}

export function collectExplorerItems(input: {
  summary?: string | null
  tasks: ExplorerTask[]
  tools: ProjectTool[]
  inspo: InspoImage[]
}): ExplorerItem[] {
  const items: ExplorerItem[] = []
  const summary = input.summary?.trim()
  if (summary) {
    items.push({ id: 'summary', section: 'summary', title: 'Project summary', subtitle: summary })
  }
  for (const task of input.tasks) {
    items.push({
      id: `task:${task.id}`,
      section: 'tasks',
      title: task.title,
      done: task.is_completed,
      taskId: task.id,
    })
  }
  for (const tool of input.tools) {
    if (tool.type === 'measurements') {
      for (const entry of tool.entries) {
        const dims = [entry.width, entry.depth, entry.height].filter(Boolean).join(' × ')
        items.push({
          id: `measure:${entry.id}`,
          section: 'measurements',
          title: entry.name,
          subtitle: dims ? `${dims} ${entry.unit}` : entry.unit,
          toolId: tool.id,
          measurementId: entry.id,
        })
      }
    } else if (tool.type === 'shopping') {
      for (const entry of tool.items) {
        items.push({
          id: `shop:${entry.id}`,
          section: 'shopping',
          title: entry.name,
          done: entry.done,
          toolId: tool.id,
          shoppingId: entry.id,
        })
      }
    } else if (tool.type === 'sketch') {
      items.push({
        id: `tool:${tool.id}`,
        section: 'blueprints',
        title: tool.title,
        subtitle: tool.text.trim() || (tool.strokes.length ? `${tool.strokes.length} stroke${tool.strokes.length === 1 ? '' : 's'}` : 'Empty sketch'),
        toolId: tool.id,
      })
    } else if (tool.type === 'note') {
      items.push({
        id: `tool:${tool.id}`,
        section: 'notes',
        title: tool.title,
        subtitle: tool.text.trim() || 'Empty note',
        toolId: tool.id,
      })
    }
  }
  for (const image of input.inspo) {
    items.push({
      id: `inspo:${image.id}`,
      section: 'inspo',
      title: image.title,
      subtitle: 'Inspiration',
      inspoId: image.id,
    })
  }
  return items
}

export function explorerStats(items: ExplorerItem[], objectiveDone: number, objectiveTotal: number) {
  const tasks = items.filter((item) => item.section === 'tasks')
  const shopping = items.filter((item) => item.section === 'shopping')
  return {
    objectivesDone: objectiveDone,
    objectivesTotal: objectiveTotal,
    tasksOpen: tasks.filter((item) => !item.done).length,
    tasksTotal: tasks.length,
    shoppingDone: shopping.filter((item) => item.done).length,
    shoppingTotal: shopping.length,
    itemCount: items.length,
  }
}
