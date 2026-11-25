import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { createTool, moveTool, removeTool, type BoardRecord, type ProjectTool, type ToolBoard, type ToolType } from '../../domain/projectTools/model'
import { fetchProjectTools, saveProjectTools, projectToolKeys } from '../../lib/queries/projectTools'
import { useAuth } from '../../contexts/AuthContext'

export function useProjectToolBoard(projectId: string, canEdit: boolean, onDirtyChange: (dirty: boolean) => void) {
  const client = useQueryClient()
  const { user } = useAuth()
  const draftKey = ['project-tools-draft', user?.id, projectId] as const
  const remembered = client.getQueryData<{ draft: ToolBoard; base: BoardRecord }>(draftKey)
  const query = useQuery({ queryKey: projectToolKeys.board(projectId), queryFn: () => fetchProjectTools(projectId), refetchInterval: 30000 })
  const [draft, setDraft] = useState<ToolBoard | null>(remembered?.draft ?? null)
  const [base, setBase] = useState<BoardRecord | null>(remembered?.base ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [bank, setBank] = useState(false)
  const [search, setSearch] = useState('')
  const busy = useRef(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const board = draft ?? query.data?.content
  const dirty = draft !== null
  useEffect(() => { client.setQueryDefaults(['project-tools-draft'], { gcTime: Infinity }) }, [client])
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])
  function change(next: ToolBoard) {
    if (!canEdit || busy.current || !query.data) return
    if (!draft) setBase(query.data)
    client.setQueryData(draftKey, { draft: next, base: base ?? query.data })
    setDraft(next); setSaved(false); setError('')
  }
  function changeTool(tool: ProjectTool) { if (board) change({ ...board, tools: board.tools.map((item) => item.id === tool.id ? tool : item) }) }
  function add(type: ToolType, target?: string) {
    if (!board || board.tools.length >= 40) return
    const tools = [...board.tools]
    const index = tools.findIndex((item) => item.id === target)
    tools.splice(index < 0 ? tools.length : index, 0, createTool(type))
    change({ ...board, tools })
  }
  function remove(id: string) { if (board) change(removeTool(board, id)) }
  function drop(event: DragEndEvent) {
    if (!event.over || !board) return
    const id = String(event.active.id)
    const target = String(event.over.id)
    if (id.startsWith('bank:')) { if (target === 'project-tool-drop' || board.tools.some((item) => item.id === target)) add(id.slice(5) as ToolType, target); return }
    const index = target === 'project-tool-drop' ? board.tools.length - 1 : board.tools.findIndex((item) => item.id === target)
    change(moveTool(board, id, index))
  }
  async function save() {
    if (!draft || !base || busy.current) return
    busy.current = true; setSaving(true); setError('')
    try {
      const record = await saveProjectTools(projectId, base.revision, draft)
      client.setQueryData(projectToolKeys.board(projectId), record)
      client.removeQueries({ queryKey: draftKey, exact: true })
      setDraft(null); setBase(null); setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed. Your draft is still here.')
    } finally {
      busy.current = false; setSaving(false)
    }
  }
  function downloadDraft() {
    if (!draft) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'project-workspace-draft.json'; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function reload() {
    if (dirty && !window.confirm('Discard your unsaved tool changes and load the latest saved workspace?')) return
    const result = await query.refetch()
    if (result.error) { setError(result.error.message); return }
    client.removeQueries({ queryKey: draftKey, exact: true }); setDraft(null); setBase(null); setError(''); setSaved(false)
  }
  return {
    query, board, dirty, saving, saved, error, base, canEdit,
    change, changeTool, add, remove, drop, save, reload, downloadDraft,
    bank, setBank, search, setSearch, sensors,
    disabled: !canEdit || saving,
    stale: Boolean(dirty && base && query.data && query.data.revision !== base.revision && !error),
  }
}
