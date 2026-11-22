import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { ImagePlus, LayoutTemplate, ListTodo, NotebookPen, Ruler, ShoppingBag, X } from 'lucide-react'
import { Button, Input, Textarea } from '../ui'
import { convertMeasurement, type ProjectTool } from '../../domain/projectTools/model'
import ProjectToolContent, { MeasurementValues } from './ProjectToolContent'
import { useProjectToolBoard } from './useProjectToolBoard'
import { EXPLORER_SECTIONS, collectExplorerItems, explorerStats, type ExplorerItem, type ExplorerSectionId, type ExplorerTask, type InspoImage } from './explorerItems'
import './ProjectExplorer.css'

const INSPO_KEY = 'checkmark-project-inspo-preview-v1'
const SECTION_ICONS = {
  summary: NotebookPen,
  tasks: ListTodo,
  measurements: Ruler,
  shopping: ShoppingBag,
  blueprints: LayoutTemplate,
  inspo: ImagePlus,
  notes: NotebookPen,
} as const

function readInspo(projectId: string): InspoImage[] {
  try {
    const raw = sessionStorage.getItem(`${INSPO_KEY}:${projectId}`)
    if (raw) return JSON.parse(raw) as InspoImage[]
  } catch { /* Preview-only memory. */ }
  if (projectId.startsWith('sample-')) {
    return [
      { id: 'inspo-gold', title: 'Gold tone reference', src: '/project-art/gold-mic.svg' },
      { id: 'inspo-vinyl', title: 'Artwork mood', src: '/project-art/vinyl.svg' },
    ]
  }
  return []
}

function writeInspo(projectId: string, items: InspoImage[]) {
  try { sessionStorage.setItem(`${INSPO_KEY}:${projectId}`, JSON.stringify(items)) } catch { /* Preview-only memory. */ }
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
  return <Icon size={32} strokeWidth={1.6} />
}

export default function ProjectExplorer({
  projectId,
  summary,
  canEdit,
  objectives,
  tasks,
  stats,
  renderTasks,
  onDirtyChange,
  previewSelect,
  mode = 'cards',
}: {
  projectId: string
  summary?: string | null
  canEdit: boolean
  objectives: { id: string; title: string }[]
  tasks: ExplorerTask[]
  stats: { objectivesDone: number; objectivesTotal: number }
  renderTasks: (objectiveId: string | null) => ReactNode
  onDirtyChange: (dirty: boolean) => void
  previewSelect?: string | null
  mode?: 'cards' | 'stats'
}) {
  const boardState = useProjectToolBoard(projectId, canEdit, onDirtyChange)
  const { query, board, dirty, saving, saved, error, changeTool, save, reload, downloadDraft, disabled, stale } = boardState
  const tools = board?.tools ?? []
  const [inspo, setInspo] = useState<InspoImage[]>(() => readInspo(projectId))
  const [section, setSection] = useState<ExplorerSectionId | 'all'>('all')
  const tab = mode
  const [selectedId, setSelectedId] = useState<string | null>(previewSelect ?? null)

  useEffect(() => {
    if (previewSelect) setSelectedId(previewSelect)
  }, [previewSelect])

  const items = useMemo(
    () => collectExplorerItems({ summary, tasks, tools, inspo }),
    [summary, tasks, tools, inspo],
  )
  const counts = explorerStats(items, stats.objectivesDone, stats.objectivesTotal)
  const selected = items.find((item) => item.id === selectedId) ?? null
  const visibleSections = EXPLORER_SECTIONS.filter((entry) => (section === 'all' || section === entry.id) && items.some((item) => item.section === entry.id))

  function closePanel() { setSelectedId(null) }
  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closePanel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  function addInspo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    const src = URL.createObjectURL(file)
    const next = [...inspo, { id: crypto.randomUUID(), title: file.name.replace(/\.[^.]+$/, ''), src, local: true }]
    setInspo(next)
    writeInspo(projectId, next)
  }

  if (query.isPending) return <section className="widget-card p-5" aria-busy="true">Loading project tools…</section>
  if (!board) return <section className="widget-card p-5"><h2 className="text-subtitle">Workspace · Beta</h2><p role="alert">{query.error?.message ?? 'Could not load project tools.'}</p><Button variant="secondary" onClick={() => void query.refetch()}>Retry</Button></section>

  const sheet = Boolean(selected && tab === 'cards')

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
                      {entry.id === 'inspo' && canEdit && (
                        <label className="project-tile" style={{ cursor: 'pointer', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <ImagePlus size={22} />
                          <span>Upload inspo</span>
                          <input type="file" accept="image/*" className="sr-only" onChange={addInspo} />
                        </label>
                      )}
                    </div>
                    {entry.id === 'inspo' && (
                      <p className="text-caption text-text-muted" style={{ marginTop: 8 }}>
                        Inspiration images are preview-only in this browser until a project media link exists.
                      </p>
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
  item, tools, inspo, disabled, changeTool, renderTasks, objectives,
}: {
  item: ExplorerItem
  tools: ProjectTool[]
  inspo: InspoImage[]
  disabled: boolean
  changeTool: (tool: ProjectTool) => void
  renderTasks: (objectiveId: string | null) => ReactNode
  objectives: { id: string; title: string }[]
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
          <p className="text-caption text-text-muted">Preview-only inspiration. A project-linked media field is needed to save this to the studio library.</p>
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
