// Versioned, JSON-only project tools. The registry is the extension point for new tools.
export const TOOL_CATALOG = [
  { type: 'measurements', title: 'Measurements', keywords: 'furniture dimensions room width depth height sizes' },
  { type: 'shopping', title: 'Shopping list', keywords: 'buy store purchases checklist' },
  { type: 'tasks', title: 'Task list', keywords: 'work objectives checklist to do' },
  { type: 'note', title: 'Notes', keywords: 'text ideas writing' },
  { type: 'sketch', title: 'Sketchpad', keywords: 'hand drawn drawing handwriting pen pencil ipad tablet' },
] as const
export type ToolType = typeof TOOL_CATALOG[number]['type']
export interface Measurement { id: string; name: string; width: string; depth: string; height: string; unit: 'in' | 'cm'; notes: string }
export interface ShoppingItem { id: string; name: string; done: boolean; measurementId: string | null }
export interface Stroke { points: [number, number][]; width: number }
interface ToolBase { id: string; title: string; wide: boolean }
export type ProjectTool = ToolBase & (
  | { type: 'measurements'; entries: Measurement[] }
  | { type: 'shopping'; items: ShoppingItem[] }
  | { type: 'tasks'; objectiveId: string | null }
  | { type: 'note'; text: string }
  | { type: 'sketch'; strokes: Stroke[]; text: string }
)
export interface ToolBoard { version: 1; tools: ProjectTool[] }
export interface BoardRecord { project_id: string; revision: number; content: ToolBoard; updated_at: string }
export const emptyBoard = (): ToolBoard => ({ version: 1, tools: [] })
export function createTool(type: ToolType): ProjectTool {
  const base = { id: crypto.randomUUID(), title: TOOL_CATALOG.find(t => t.type === type)!.title, wide: type === 'sketch' }
  switch (type) {
    case 'measurements': return { ...base, type, entries: [] }
    case 'shopping': return { ...base, type, items: [] }
    case 'tasks': return { ...base, type, objectiveId: null }
    case 'note': return { ...base, type, text: '' }
    case 'sketch': return { ...base, type, strokes: [], text: '' }
  }
}
export function moveTool(board: ToolBoard, id: string, target: number): ToolBoard {
  const tools = [...board.tools], from = tools.findIndex(t => t.id === id)
  if (from < 0 || target < 0 || target >= tools.length) return board
  const [tool] = tools.splice(from, 1)
  tools.splice(target, 0, tool!)
  return { ...board, tools }
}
export function removeTool(board: ToolBoard, id: string): ToolBoard {
  const removed = board.tools.find(t => t.id === id)
  const entries = new Set(removed?.type === 'measurements' ? removed.entries.map(e => e.id) : [])
  return { ...board, tools: board.tools.filter(t => t.id !== id).map(t => t.type === 'shopping'
    ? { ...t, items: t.items.map(i => entries.has(i.measurementId ?? '') ? { ...i, measurementId: null } : i) } : t) }
}
export function convertMeasurement(entry: Measurement, unit: Measurement['unit']): Measurement {
  if (entry.unit === unit) return entry
  const factor = unit === 'cm' ? 2.54 : 1 / 2.54
  const convert = (value: string) => value === '' ? '' : String(Number((Number(value) * factor).toFixed(6)))
  return { ...entry, unit, width: convert(entry.width), depth: convert(entry.depth), height: convert(entry.height) }
}
const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
const name = (v: unknown) => text(v, 160) && (v as string).trim().length > 0
const id = (v: unknown) => text(v, 100) && (v as string).length > 0
const size = (v: unknown) => v === '' || (text(v, 24) && /^[0-9]+([.][0-9]+)?([eE][+-]?[0-9]{1,3})?$/.test(v as string) && Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 100000)
export function validateBoard(value: unknown): asserts value is ToolBoard {
  const fail = (message = 'This workspace contains invalid or oversized tool content.') => { throw new Error(message) }
  if (!object(value) || value.version !== 1 || !Array.isArray(value.tools) || value.tools.length > 40 || JSON.stringify(value).length > 750000) return fail()
  const ids = new Set<string>(), measurementIds = new Set<string>(), links: string[] = []
  for (const t of value.tools) {
    if (object(t) && !name(t.title)) return fail('Give every tool a name before saving (up to 160 characters).')
    if (!object(t) || !id(t.id) || ids.has(t.id as string) || !name(t.title) || typeof t.wide !== 'boolean') return fail()
    ids.add(t.id as string)
    if (t.type === 'measurements') {
      if (!Array.isArray(t.entries) || t.entries.length > 200) return fail()
      for (const e of t.entries) {
        if (!object(e) || !id(e.id) || measurementIds.has(e.id as string) || !name(e.name) || !['in','cm'].includes(e.unit as string) || !size(e.width) || !size(e.depth) || !size(e.height) || !text(e.notes, 4000)) return fail()
        measurementIds.add(e.id as string)
      }
    } else if (t.type === 'shopping') {
      if (!Array.isArray(t.items) || t.items.length > 200) return fail()
      const itemIds = new Set<string>()
      for (const e of t.items) {
        if (!object(e) || !id(e.id) || itemIds.has(e.id as string) || !name(e.name) || typeof e.done !== 'boolean' || !(e.measurementId === null || id(e.measurementId))) return fail()
        itemIds.add(e.id as string)
        if (e.measurementId) links.push(e.measurementId as string)
      }
    } else if (t.type === 'tasks') {
      if (!(t.objectiveId === null || id(t.objectiveId))) return fail()
    } else if (t.type === 'note' || t.type === 'sketch') {
      if (!text(t.text, 20000)) return fail()
      if (t.type === 'sketch') {
        if (!Array.isArray(t.strokes) || t.strokes.length > 300) return fail()
        for (const s of t.strokes) {
          if (!object(s) || ![2,4,8].includes(s.width as number) || !Array.isArray(s.points) || s.points.length < 1 || s.points.length > 1500) return fail()
          if (s.points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every((v: unknown, i: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= (i ? 600 : 1000)))) return fail()
        }
      }
    } else return fail()
  }
  if (links.some(link => !measurementIds.has(link))) return fail()
}
