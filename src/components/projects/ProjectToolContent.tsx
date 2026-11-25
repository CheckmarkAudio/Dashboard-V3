import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Button, Input, Textarea } from '../ui'
import { convertMeasurement, type Measurement, type ProjectTool, type Stroke } from '../../domain/projectTools/model'

export function MeasurementValues({ entry }: { entry: Measurement }) {
  return <div className="pt-measure-values" aria-label={`Measurements in ${entry.unit === 'in' ? 'inches' : 'centimeters'}`}>
    <span className="pt-unit">{entry.unit === 'in' ? 'Inches' : 'Centimeters'}</span>
    {(['width','depth','height'] as const).map(key => <span key={key}><small>{key[0]!.toUpperCase() + key.slice(1)}</small><strong>{entry[key] || '—'}</strong></span>)}
  </div>
}
function Measurements({ tool, change }: { tool: Extract<ProjectTool, {type:'measurements'}>; change: (tool: ProjectTool) => void }) {
  const [name, setName] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  function update(entry: Measurement) { change({ ...tool, entries: tool.entries.map(e => e.id === entry.id ? entry : e) }) }
  return <>
    {tool.entries.map(entry => <details key={entry.id} open={open === entry.id}>
      <summary onClick={event => { event.preventDefault(); setOpen(open === entry.id ? null : entry.id) }}><strong>{entry.name}</strong><MeasurementValues entry={entry} /></summary>
      <div className="pt-entry-edit">
        <Input label="Name" value={entry.name} maxLength={160} onChange={e => update({ ...entry, name: e.target.value })} />
        <label>Units<select aria-label="Measurement units" value={entry.unit} onChange={e => update(convertMeasurement(entry, e.target.value as Measurement['unit']))}><option value="in">Inches</option><option value="cm">Centimeters</option></select></label>
        <div className="pt-dimension-fields">{(['width','depth','height'] as const).map(key => <Input key={key} label={key[0]!.toUpperCase() + key.slice(1)} type="number" min="0.000001" max="100000" step="any" value={entry[key]} onChange={e => update({ ...entry, [key]: e.target.value })} />)}</div>
        <Textarea label="Notes / clearance" value={entry.notes} maxLength={4000} rows={2} onChange={e => update({ ...entry, notes: e.target.value })} />
        <Button size="sm" variant="secondary" onClick={() => setOpen(null)}>Done</Button>
      </div>
    </details>)}
    <form className="pt-add-form" onSubmit={event => { event.preventDefault(); if (!name.trim() || tool.entries.length >= 200) return; const entry: Measurement = { id: crypto.randomUUID(), name: name.trim(), width:'', depth:'', height:'', unit:'in', notes:'' }; change({ ...tool, entries: [...tool.entries, entry] }); setName(''); setOpen(entry.id) }}>
      <Input label="Furniture or space" placeholder="e.g. Closet opening" value={name} maxLength={160} onChange={e => setName(e.target.value)} />
      <Button type="submit" disabled={!name.trim() || tool.entries.length >= 200}>Add</Button>
    </form>
  </>
}
function Shopping({ tool, measurements, change }: { tool: Extract<ProjectTool, {type:'shopping'}>; measurements: Measurement[]; change: (tool: ProjectTool) => void }) {
  const [name,setName] = useState('')
  return <>
    {tool.items.map(item => { const entry = measurements.find(e => e.id === item.measurementId); return <div className="pt-shopping-item" key={item.id}>
      <label className="pt-check"><input type="checkbox" checked={item.done} onChange={e => change({ ...tool, items: tool.items.map(i => i.id === item.id ? { ...i, done:e.target.checked } : i) })} /><span className={item.done ? 'line-through text-text-muted' : ''}>{item.name}</span></label>
      <label className="pt-link-label">Measurements<select aria-label={`Measurements for ${item.name}`} value={item.measurementId ?? ''} onChange={e => change({ ...tool, items: tool.items.map(i => i.id === item.id ? { ...i, measurementId:e.target.value || null } : i) })}><option value="">None</option>{measurements.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      {entry && <div className="pt-linked-measure"><MeasurementValues entry={entry} />{entry.notes && <p>{entry.notes}</p>}</div>}
      <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Remove “${item.name}” from this shopping list?`)) change({ ...tool, items: tool.items.filter(i => i.id !== item.id) }) }}>Remove item</Button>
    </div> })}
    <form className="pt-add-form" onSubmit={e => { e.preventDefault(); if (!name.trim() || tool.items.length >= 200) return; change({ ...tool, items:[...tool.items,{id:crypto.randomUUID(),name:name.trim(),done:false,measurementId:null}] }); setName('') }}>
      <Input label="Shopping item" value={name} maxLength={160} onChange={e => setName(e.target.value)} /><Button type="submit" disabled={!name.trim() || tool.items.length >= 200}>Add</Button>
    </form>
  </>
}
function Sketchpad({ tool, change, disabled }: { tool: Extract<ProjectTool,{type:'sketch'}>; change:(tool:ProjectTool)=>void; disabled:boolean }) {
  const [finger,setFinger] = useState(false), [width,setWidth] = useState(4)
  const [active,setActive] = useState<Stroke | null>(null)
  const stroke = useRef<Stroke | null>(null), pointer = useRef<number | null>(null)
  function position(event: PointerEvent<SVGSVGElement>): [number,number] {
    const rect = event.currentTarget.getBoundingClientRect()
    return [Math.round(Math.max(0,Math.min(1000,(event.clientX-rect.left)/rect.width*1000))*100)/100, Math.round(Math.max(0,Math.min(600,(event.clientY-rect.top)/rect.height*600))*100)/100]
  }
  function finish(event: PointerEvent<SVGSVGElement>, cancelled = false) {
    if (pointer.current !== event.pointerId) return
    const next = stroke.current
    pointer.current = null; stroke.current = null; setActive(null)
    if (!cancelled && next) change({ ...tool, strokes:[...tool.strokes,next] })
  }
  const strokes = active ? [...tool.strokes,active] : tool.strokes
  return <>
    <div className="pt-inline">
      <label>Pen<select aria-label="Pen width" value={width} onChange={e => setWidth(Number(e.target.value))}><option value="2">Fine</option><option value="4">Medium</option><option value="8">Bold</option></select></label>
      <label className="pt-check"><input type="checkbox" checked={finger} onChange={e => setFinger(e.target.checked)} />Draw with finger</label>
      <Button variant="secondary" size="sm" disabled={!tool.strokes.length} onClick={() => change({ ...tool, strokes:tool.strokes.slice(0,-1) })}>Undo stroke</Button>
    </div>
    <svg className="pt-sketch" viewBox="0 0 1000 600" role="img" aria-label="Hand-drawn note. Use a pen or mouse; enable Draw with finger for touch. A typed description is available below."
      style={{touchAction:'none'}}
      onPointerDown={event => {
        if (disabled || pointer.current !== null || (event.pointerType === 'touch' && !finger) || event.button !== 0 || tool.strokes.length >= 300) return
        event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId)
        stroke.current = { width, points:[position(event)] }; setActive(stroke.current)
      }}
      onPointerMove={event => {
        if (pointer.current !== event.pointerId || !stroke.current || stroke.current.points.length >= 1500) return
        const point = position(event), last = stroke.current.points[stroke.current.points.length-1]!
        if (Math.hypot(point[0]-last[0],point[1]-last[1]) < 1) return
        stroke.current = {...stroke.current,points:[...stroke.current.points,point]}; setActive(stroke.current)
      }} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event,true)} onLostPointerCapture={event => finish(event,true)}>
      {strokes.map((s,i) => s.points.length === 1 ? <circle key={i} cx={s.points[0]![0]} cy={s.points[0]![1]} r={s.width/2} fill="currentColor" /> : <polyline key={i} points={s.points.map(p=>p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    {tool.strokes.length >= 300 && <p role="status">This sketchpad is full. Add another to keep drawing.</p>}
    <Textarea label="Caption / typed notes" value={tool.text} maxLength={20000} rows={2} onChange={e => change({...tool,text:e.target.value})} />
  </>
}
export default function ProjectToolContent({ tool, tools, change, objectives, renderTasks, disabled }: {
  tool:ProjectTool; tools:ProjectTool[]; change:(tool:ProjectTool)=>void; objectives:{id:string;title:string}[]; renderTasks:(objectiveId:string|null)=>ReactNode; disabled:boolean
}) {
  switch(tool.type) {
    case 'measurements': return <Measurements tool={tool} change={change} />
    case 'shopping': return <Shopping tool={tool} measurements={tools.flatMap(t=>t.type==='measurements'?t.entries:[])} change={change} />
    case 'note': return <Textarea label="Note" rows={7} value={tool.text} maxLength={20000} onChange={e=>change({...tool,text:e.target.value})} />
    case 'sketch': return <Sketchpad tool={tool} change={change} disabled={disabled} />
    case 'tasks': return <><label>Show tasks from<select aria-label="Show tasks from" value={tool.objectiveId??''} onChange={e=>change({...tool,objectiveId:e.target.value||null})}><option value="">All project tasks</option>{objectives.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>{tool.objectiveId && !objectives.some(o=>o.id===tool.objectiveId) ? <p role="alert">This objective was removed. Choose another list.</p> : renderTasks(tool.objectiveId)}</>
  }
}
