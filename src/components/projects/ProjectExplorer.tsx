import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, LayoutTemplate, ListTodo, NotebookPen, Ruler, ShoppingBag, Trash2, X } from 'lucide-react'
import { Button, Input, Textarea } from '../ui'
import { useToast } from '../Toast'
import { convertMeasurement, createTool, type ProjectTool } from '../../domain/projectTools/model'
import { fetchProjectInspo, projectMediaKeys, uploadProjectInspo, deleteProjectInspo, PROJECT_MEDIA_UNAVAILABLE, type ProjectInspoImage } from '../../lib/queries/projectMedia'
import ProjectToolContent, { MeasurementValues } from './ProjectToolContent'
import { useProjectToolBoard } from './useProjectToolBoard'
import { EXPLORER_SECTIONS, collectExplorerItems, explorerStats, type ExplorerItem, type ExplorerSectionId, type ExplorerTask, type InspoImage } from './explorerItems'
import './ProjectExplorer.css'

const SECTION_ICONS = {
  summary: NotebookPen,
  tasks: ListTodo,
  measurements: Ruler,
  shopping: ShoppingBag,
  blueprints: LayoutTemplate,
  inspo: ImagePlus,
  notes: NotebookPen,
} as const

function toInspoImages(images: ProjectInspoImage[]): InspoImage[] {
  return images.map((image) => ({ id: image.id, title: image.title, src: image.public_url }))
}

function SketchThumb({ tool }: { tool: Extract<ProjectTool, { type: 'sketch' }> }) {
  return (
    <svg viewBox="0 0 1000 600" aria-hidden="true">
      {tool.strokes.map((stroke, index) => stroke.points.length === 1
        ? <circle key={index} cx={stroke.points[0]![0]} cy={stroke.points[0]![1]} r={stroke.width} fill="currentColor" />
        : <polyline key={index} points={stroke.points.map((point) => point.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth={stroke.width * 2} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  )
}

function TileThumb({ item, tools, inspo }: { item: ExplorerItem; tools: ProjectTool[]; inspo: InspoImage[] }) {
  const Icon = SECTION_ICONS[item.section]
  if (item.section === 'inspo') {
    const image = inspo.find((entry) => entry.id === item.inspoId)
    if (image) return <img src={image.src} alt="" />
  }
  if (item.section === 'blueprints') {
    const tool = tools.find((entry) => entry.id === item.toolId)
    if (tool?.type === 'sketch' && tool.strokes.length) return <SketchThumb tool={tool} />
  }
  return <Icon size={40} strokeWidth={1.6} />
}

export default function ProjectExplorer({
  projectId,
  teamId,
  userId,
  summary,
  canEdit,
  objectives,
  tasks,
  stats,
  renderTasks,
  onDirtyChange,
  onEditProject,
  previewSelect,
  mode = 'cards',
}: {
  projectId: string
  teamId: string
  userId?: string | null
  summary?: string | null
  canEdit: boolean
  objectives: { id: string; title: string }[]
  tasks: ExplorerTask[]
  stats: { objectivesDone: number; objectivesTotal: number }
  renderTasks: (objectiveId: string | null) => ReactNode
  onDirtyChange: (dirty: boolean) => void
  onEditProject?: () => void
  previewSelect?: string | null
  mode?: 'cards' | 'stats'
}) {
  const boardState = useProjectToolBoard(projectId, canEdit, onDirtyChange)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const inspoQuery = useQuery({
    queryKey: projectMediaKeys.inspo(projectId),
    queryFn: () => fetchProjectInspo(projectId),
  })
  const mediaAvailable = inspoQuery.data?.available === true
  const inspo = useMemo(() => toInspoImages(inspoQuery.data?.images ?? []), [inspoQuery.data])
  const [section, setSection] = useState<ExplorerSectionId | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(previewSelect ?? null)
  useEffect(() => {
    if (previewSelect) setSelectedId(previewSelect)
  }, [previewSelect])
  const tools = boardState.board?.tools ?? []
  const items = useMemo(
    () => collectExplorerItems({ summary, tasks, tools, inspo }),
    [summary, tasks, tools, inspo],
  )
  const counts = explorerStats(items, stats.objectivesDone, stats.objectivesTotal)
  const selected = items.find((item) => item.id === selectedId) ?? null
  const visibleSections = EXPLORER_SECTIONS.filter((entry) => (
    (section === 'all' || section === entry.id)
    && (items.some((item) => item.section === entry.id) || canEdit)
  ))

  function closePanel() { setSelectedId(null) }
  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closePanel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const uploadInspo = useMutation({
    mutationFn: (file: File) => {
      if (!userId) throw new Error('Sign in to upload inspiration images.')
      return uploadProjectInspo({ projectId, teamId, userId, file })
    },
    onSuccess: (image) => {
      void queryClient.invalidateQueries({ queryKey: projectMediaKeys.inspo(projectId) })
      setSelectedId(`inspo:${image.id}`)
      toast('Inspiration image saved.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const removeInspo = useMutation({
    mutationFn: (image: ProjectInspoImage) => deleteProjectInspo(image),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectMediaKeys.inspo(projectId) })
      closePanel()
      toast('Inspiration image removed.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  function onInspoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) uploadInspo.mutate(file)
  }

  function addMeasurement() {
    const board = boardState.board
    if (!board) return
    const existing = board.tools.find((tool): tool is Extract<ProjectTool, { type: 'measurements' }> => tool.type === 'measurements')
    const tool = existing ?? createTool('measurements')
    if (tool.type !== 'measurements') return
    const entry = { id: crypto.randomUUID(), name: 'New measurement', width: '', depth: '', height: '', unit: 'in' as const, notes: '' }
    const next = { ...tool, entries: [...tool.entries, entry] }
    const tools = existing ? board.tools.map((item) => item.id === next.id ? next : item) : [...board.tools, next]
    boardState.change({ ...board, tools })
    setSelectedId(`measure:${entry.id}`)
  }
  function addShoppingItem() {
    const board = boardState.board
    if (!board) return
    const existing = board.tools.find((tool): tool is Extract<ProjectTool, { type: 'shopping' }> => tool.type === 'shopping')
    const tool = existing ?? createTool('shopping')
    if (tool.type !== 'shopping') return
    const item = { id: crypto.randomUUID(), name: 'New item', done: false, measurementId: null as string | null }
    const next = { ...tool, items: [...tool.items, item] }
    const tools = existing ? board.tools.map((entry) => entry.id === next.id ? next : entry) : [...board.tools, next]
    boardState.change({ ...board, tools })
    setSelectedId(`shop:${item.id}`)
  }
  function addNote() {
    const board = boardState.board
    if (!board) return
    const tool = createTool('note')
    boardState.change({ ...board, tools: [...board.tools, tool] })
    setSelectedId(`tool:${tool.id}`)
  }
  function addSketch() {
    const board = boardState.board
    if (!board) return
    const tool = createTool('sketch')
    boardState.change({ ...board, tools: [...board.tools, tool] })
    setSelectedId(`tool:${tool.id}`)
  }

  const { query, board, dirty, saving, saved, error, stale, save, reload, downloadDraft, changeTool, disabled } = boardState
  const tab = mode

  if (query.isPending) return <section className="widget-card p-5" aria-busy="true">Loading project tools…</section>
  if (!board) return <section className="widget-card p-5"><h2 className="text-subtitle">Workspace · Beta</h2><p role="alert">{query.error?.message ?? 'Could not load project tools.'}</p><Button variant="secondary" onClick={() => void query.refetch()}>Retry</Button></section>

  const sheet = Boolean(selected && tab === 'cards')
  const selectedRecord = selected?.inspoId ? inspoQuery.data?.images.find((image: ProjectInspoImage) => image.id === selected.inspoId) : undefined

  return (
    <div className="project-deck">
      <div className="project-stat-row" aria-label="Project stats">
        <div className="project-stat-block"><strong>{counts.objectivesDone}/{counts.objectivesTotal}</strong><span>Objectives done</span></div>
        <div className="project-stat-block"><strong>{counts.tasksOpen}</strong><span>Tasks open</span></div>
        <div className="project-stat-block"><strong>{counts.shoppingTotal ? `${counts.shoppingDone}/${counts.shoppingTotal}` : '—'}</strong><span>Shopping</span></div>
        <div className="project-stat-block"><strong>{counts.itemCount}</strong><span>Items</span></div>
      </div>

      {(error || query.error) && (
        <div className="pt-error" role="alert">
          <p>{error || query.error?.message}</p>
          <div className="pt-inline">
            {dirty && <Button variant="secondary" onClick={() => void save()} disabled={saving}>Retry save</Button>}
            {dirty && <Button variant="secondary" onClick={downloadDraft}>Download draft</Button>}
            <Button variant="secondary" onClick={() => void reload()} disabled={saving}>Load latest</Button>
          </div>
        </div>
      )}
      {stale && <p role="status" className="pt-error">A newer version is available. Your draft is kept here; saving will check for a conflict.</p>}
      {inspoQuery.isError && <p role="alert" className="pt-error">{(inspoQuery.error as Error).message}</p>}

      {tab === 'stats' && (
        <div className="project-stats-page">
          <div className="project-stat-row">
            <div className="project-stat-block"><strong>{counts.objectivesDone}/{counts.objectivesTotal}</strong><span>Objectives complete</span></div>
            <div className="project-stat-block"><strong>{counts.tasksOpen}/{counts.tasksTotal}</strong><span>Tasks still open</span></div>
            <div className="project-stat-block"><strong>{counts.shoppingDone}/{counts.shoppingTotal}</strong><span>Shopping checked off</span></div>
            <div className="project-stat-block"><strong>{counts.itemCount}</strong><span>Explorable items</span></div>
          </div>
          <p className="text-caption text-text-muted">Shopping has no price field yet, so this view uses item counts instead of a budget total.</p>
        </div>
      )}

      {tab === 'cards' && (
        <>
          <div className="pt-toolbar">
            <div className="project-section-filters" role="group" aria-label="Filter items">
              <button type="button" className="focus-ring" aria-pressed={section === 'all'} onClick={() => setSection('all')}>All</button>
              {EXPLORER_SECTIONS.map((entry) => (
                <button key={entry.id} type="button" className="focus-ring" aria-pressed={section === entry.id} onClick={() => setSection(entry.id)}>
                  {entry.title}
                </button>
              ))}
            </div>
            <div className="pt-inline">
              <span role="status">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : saved ? 'Saved' : ''}</span>
              {canEdit && <Button disabled={!dirty || saving} loading={saving} onClick={() => void save()}>Save workspace</Button>}
            </div>
          </div>

          <div className="project-deck-body">
            <div className="project-deck-groups">
              {visibleSections.length === 0 && <p className="text-caption text-text-muted">Nothing in this group yet.</p>}
              {visibleSections.map((entry) => {
                const group = items.filter((item) => item.section === entry.id)
                return (
                  <section key={entry.id} aria-labelledby={`deck-${entry.id}`}>
                    <div className="project-deck-group-head">
                      <h2 id={`deck-${entry.id}`}>{entry.title}</h2>
                      <span>{group.length}</span>
                    </div>
                    <div className="project-tile-grid">
                      {group.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`project-tile focus-ring${selectedId === item.id ? ' is-selected' : ''}${item.done ? ' is-done' : ''}`}
                          aria-pressed={selectedId === item.id}
                          onClick={() => setSelectedId(item.id)}
                        >
                          <span className="project-tile-thumb"><TileThumb item={item} tools={tools} inspo={inspo} /></span>
                          <span className="project-tile-body">
                            <strong>{item.title}</strong>
                            {item.subtitle && <small>{item.subtitle}</small>}
                          </span>
                        </button>
                      ))}
                      {entry.id === 'inspo' && canEdit && mediaAvailable && (
                        <label className={`project-tile is-add${uploadInspo.isPending ? ' is-busy' : ''}`}>
                          <ImagePlus size={22} />
                          <span>{uploadInspo.isPending ? 'Uploading…' : 'Upload inspo'}</span>
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={uploadInspo.isPending} onChange={onInspoFile} />
                        </label>
                      )}
                      {entry.id === 'measurements' && canEdit && (
                        <button type="button" className="project-tile is-add focus-ring" onClick={addMeasurement}>
                          <Ruler size={22} /><span>Add measurement</span>
                        </button>
                      )}
                      {entry.id === 'shopping' && canEdit && (
                        <button type="button" className="project-tile is-add focus-ring" onClick={addShoppingItem}>
                          <ShoppingBag size={22} /><span>Add item</span>
                        </button>
                      )}
                      {entry.id === 'notes' && canEdit && (
                        <button type="button" className="project-tile is-add focus-ring" onClick={addNote}>
                          <NotebookPen size={22} /><span>Add note</span>
                        </button>
                      )}
                      {entry.id === 'blueprints' && canEdit && (
                        <button type="button" className="project-tile is-add focus-ring" onClick={addSketch}>
                          <LayoutTemplate size={22} /><span>Add blueprint</span>
                        </button>
                      )}
                      {entry.id === 'summary' && canEdit && !summary?.trim() && onEditProject && (
                        <button type="button" className="project-tile is-add focus-ring" onClick={onEditProject}>
                          <NotebookPen size={22} /><span>Add description</span>
                        </button>
                      )}
                    </div>
                    {entry.id === 'inspo' && inspoQuery.isSuccess && !mediaAvailable && (
                      <p className="text-caption text-text-muted" style={{ marginTop: 8 }}>{PROJECT_MEDIA_UNAVAILABLE}</p>
                    )}
                    {entry.id === 'tasks' && canEdit && group.length === 0 && (
                      <div className="project-empty-add">{renderTasks(null)}</div>
                    )}
                  </section>
                )
              })}
            </div>

            <aside className={`project-panel${sheet ? ' is-sheet' : ''}`} aria-label={selected ? 'Item details' : 'Your project'}>
              <div className="project-panel-head">
                <h2>{selected ? 'Details' : 'Your project'}</h2>
                {selected && <Button size="sm" variant="ghost" iconLeft={<X size={16} />} onClick={closePanel} aria-label="Close details">Close</Button>}
              </div>
              {selected ? (
                <ExplorerDetail
                  item={selected}
                  tools={tools}
                  inspo={inspo}
                  disabled={disabled}
                  changeTool={changeTool}
                  renderTasks={renderTasks}
                  objectives={objectives}
                  canEdit={canEdit}
                  inspoRecord={selectedRecord}
                  onDeleteInspo={selectedRecord ? () => removeInspo.mutate(selectedRecord) : undefined}
                  deletingInspo={removeInspo.isPending}
                  onEditProject={onEditProject}
                />
              ) : (
                <ul className="project-panel-list">
                  {EXPLORER_SECTIONS.map((entry) => {
                    const count = items.filter((item) => item.section === entry.id).length
                    return (
                      <li key={entry.id}>
                        <button type="button" className="focus-ring" onClick={() => setSection(entry.id)}>
                          <span>{entry.title}</span>
                          <span className="project-panel-count">{count}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </aside>
          </div>
          {sheet && <button type="button" className="project-sheet-backdrop" aria-label="Close details" onClick={closePanel} />}
        </>
      )}
    </div>
  )
}

function ExplorerDetail({
  item, tools, inspo, disabled, changeTool, renderTasks, objectives, canEdit, inspoRecord, onDeleteInspo, deletingInspo, onEditProject,
}: {
  item: ExplorerItem
  tools: ProjectTool[]
  inspo: InspoImage[]
  disabled: boolean
  changeTool: (tool: ProjectTool) => void
  renderTasks: (objectiveId: string | null) => ReactNode
  objectives: { id: string; title: string }[]
  canEdit: boolean
  inspoRecord?: ProjectInspoImage
  onDeleteInspo?: () => void
  deletingInspo?: boolean
  onEditProject?: () => void
}) {
  const tool = tools.find((entry) => entry.id === item.toolId)
  const Icon = SECTION_ICONS[item.section]
  if (item.section === 'summary') {
    return (
      <>
        <div className="project-panel-art"><Icon size={48} strokeWidth={1.5} /></div>
        <div className="project-panel-body">
          <h3>{item.title}</h3>
          <p>{item.subtitle}</p>
          {canEdit && onEditProject && <Button variant="secondary" size="sm" onClick={onEditProject}>Edit description</Button>}
        </div>
      </>
    )
  }
  if (item.section === 'inspo') {
    const image = inspo.find((entry) => entry.id === item.inspoId)
    return (
      <>
        <div className="project-panel-art">{image ? <img src={image.src} alt="" /> : <Icon size={48} />}</div>
        <div className="project-panel-body">
          <h3>{item.title}</h3>
          {canEdit && onDeleteInspo && inspoRecord && (
            <Button variant="danger" size="sm" iconLeft={<Trash2 size={14} />} loading={deletingInspo} onClick={onDeleteInspo}>
              Remove image
            </Button>
          )}
        </div>
      </>
    )
  }
  if (item.section === 'tasks') {
    return (
      <>
        <div className="project-panel-art"><Icon size={48} strokeWidth={1.5} /></div>
        <div className="project-panel-body">
          <h3>{item.title}</h3>
          {renderTasks(null)}
        </div>
      </>
    )
  }
  if (item.measurementId && tool?.type === 'measurements') {
    const entry = tool.entries.find((row) => row.id === item.measurementId)
    if (!entry) return null
    const update = (next: typeof entry) => changeTool({ ...tool, entries: tool.entries.map((row) => row.id === next.id ? next : row) })
    return (
      <>
        <div className="project-panel-art"><Icon size={48} strokeWidth={1.5} /></div>
        <div className="project-panel-body">
          <h3>{entry.name}</h3>
          <MeasurementValues entry={entry} />
          <fieldset disabled={disabled} className="pt-entry-edit">
            <Input label="Name" value={entry.name} maxLength={160} onChange={(event) => update({ ...entry, name: event.target.value })} />
            <label>Units
              <select aria-label="Measurement units" value={entry.unit} onChange={(event) => update(convertMeasurement(entry, event.target.value as typeof entry.unit))}>
                <option value="in">Inches</option>
                <option value="cm">Centimeters</option>
              </select>
            </label>
            <div className="pt-dimension-fields">
              {(['width', 'depth', 'height'] as const).map((key) => (
                <Input key={key} label={key[0]!.toUpperCase() + key.slice(1)} type="number" min="0.000001" max="100000" step="any" value={entry[key]} onChange={(event) => update({ ...entry, [key]: event.target.value })} />
              ))}
            </div>
            <Textarea label="Notes / clearance" value={entry.notes} maxLength={4000} rows={2} onChange={(event) => update({ ...entry, notes: event.target.value })} />
          </fieldset>
        </div>
      </>
    )
  }
  if (item.shoppingId && tool?.type === 'shopping') {
    const row = tool.items.find((entry) => entry.id === item.shoppingId)
    if (!row) return null
    const measurements = tools.flatMap((entry) => entry.type === 'measurements' ? entry.entries : [])
    const linked = measurements.find((entry) => entry.id === row.measurementId)
    return (
      <>
        <div className="project-panel-art"><Icon size={48} strokeWidth={1.5} /></div>
        <div className="project-panel-body">
          <h3>{row.name}</h3>
          <label className="pt-check">
            <input type="checkbox" checked={row.done} disabled={disabled} onChange={(event) => changeTool({ ...tool, items: tool.items.map((entry) => entry.id === row.id ? { ...entry, done: event.target.checked } : entry) })} />
            <span>Mark as bought</span>
          </label>
          <label className="pt-link-label">Measurements
            <select aria-label={`Measurements for ${row.name}`} disabled={disabled} value={row.measurementId ?? ''} onChange={(event) => changeTool({ ...tool, items: tool.items.map((entry) => entry.id === row.id ? { ...entry, measurementId: event.target.value || null } : entry) })}>
              <option value="">None</option>
              {measurements.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </label>
          {linked && <MeasurementValues entry={linked} />}
        </div>
      </>
    )
  }
  if (tool && (tool.type === 'note' || tool.type === 'sketch' || tool.type === 'tasks')) {
    return (
      <>
        <div className="project-panel-art">
          {tool.type === 'sketch' && tool.strokes.length ? <SketchThumb tool={tool} /> : <Icon size={48} strokeWidth={1.5} />}
        </div>
        <div className="project-panel-body">
          <h3>{tool.title}</h3>
          <fieldset disabled={disabled}>
            <ProjectToolContent tool={tool} tools={tools} change={changeTool} objectives={objectives} renderTasks={renderTasks} disabled={disabled} />
          </fieldset>
        </div>
      </>
    )
  }
  return (
    <div className="project-panel-body">
      <h3>{item.title}</h3>
      {item.subtitle && <p>{item.subtitle}</p>}
    </div>
  )
}
