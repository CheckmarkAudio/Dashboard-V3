import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Search } from 'lucide-react'
import DashboardWidgetFrame from '../dashboard/DashboardWidgetFrame'
import { Button, Input } from '../ui'
import { TOOL_CATALOG, createTool, moveTool, removeTool, type ToolBoard, type ToolType, type ProjectTool, type BoardRecord } from '../../domain/projectTools/model'
import { fetchProjectTools, saveProjectTools, projectToolKeys } from '../../lib/queries/projectTools'
import ProjectToolContent from './ProjectToolContent'
import './ProjectToolsBoard.css'
import { useAuth } from '../../contexts/AuthContext'

const toolCollision: CollisionDetection = args => {
  if (!args.pointerCoordinates) return closestCenter(args)
  const hits = pointerWithin(args)
  const cards = hits.filter(hit => hit.id !== 'project-tool-drop')
  return cards.length ? cards : hits
}

function BankTool({ type, title, add, disabled }: {type:ToolType;title:string;add:()=>void;disabled:boolean}) {
  const {attributes,listeners,setNodeRef,isDragging} = useDraggable({id:`bank:${type}`,disabled})
  return <div ref={setNodeRef} className="pt-bank-tool" style={{opacity:isDragging?.5:1}}>
    <button type="button" {...attributes} {...listeners} disabled={disabled} className="pt-grip focus-ring" aria-label={`Drag ${title} into workspace`}><GripVertical size={18}/></button>
    <span>{title}</span><Button size="sm" variant="secondary" disabled={disabled} aria-label={`Add ${title}`} onClick={add}><Plus size={14}/>Add</Button>
  </div>
}
function ToolCard({tool,index,count,disabled,move,change,remove,children}: {tool:ProjectTool;index:number;count:number;disabled:boolean;move:(to:number)=>void;change:(tool:ProjectTool)=>void;remove:()=>void;children:ReactNode}) {
  const {attributes,listeners,setNodeRef,transform,transition,isDragging} = useSortable({id:tool.id,disabled})
  const [settings,setSettings] = useState(false)
  return <article ref={setNodeRef} data-tool-id={tool.id} className={`pt-tool ${tool.wide?'pt-wide':''}`} style={{transform:CSS.Transform.toString(transform),transition,opacity:isDragging?.35:1}}>
    <DashboardWidgetFrame title={tool.title} canMoveUp={!disabled&&index>0} canMoveDown={!disabled&&index<count-1} onMoveUp={()=>move(index-1)} onMoveDown={()=>move(index+1)}
      dragHandleProps={disabled?undefined:{attributes,listeners:listeners as never,isDragging}}>
      <fieldset disabled={disabled} className="pt-tool-body">
        <div className="pt-tool-actions"><Button size="sm" variant="ghost" aria-expanded={settings} onClick={()=>setSettings(!settings)}>Tool options</Button></div>
        {settings && <div className="pt-options"><Input label="Tool name" value={tool.title} maxLength={160} onChange={e=>change({...tool,title:e.target.value})}/><label className="pt-check"><input type="checkbox" checked={tool.wide} onChange={e=>change({...tool,wide:e.target.checked})}/>Full width</label><Button size="sm" variant="danger" onClick={remove}>Remove tool</Button></div>}
        {children}
      </fieldset>
    </DashboardWidgetFrame>
  </article>
}
function BoardGrid({children}: {children:ReactNode}) {
  const {setNodeRef,isOver}=useDroppable({id:'project-tool-drop'})
  return <div ref={setNodeRef} className={`pt-grid ${isOver?'pt-drop-active':''}`}>{children}</div>
}
export default function ProjectToolsBoard({projectId,canEdit,objectives,renderTasks,onDirtyChange}: {
  projectId:string;canEdit:boolean;objectives:{id:string;title:string}[];renderTasks:(objectiveId:string|null)=>ReactNode;onDirtyChange:(dirty:boolean)=>void
}) {
  const client=useQueryClient()
  const { user }=useAuth()
  const draftKey=['project-tools-draft',user?.id,projectId] as const
  const remembered=client.getQueryData<{draft:ToolBoard;base:BoardRecord}>(draftKey)
  const query=useQuery({queryKey:projectToolKeys.board(projectId),queryFn:()=>fetchProjectTools(projectId),refetchInterval:30000})
  const [draft,setDraft]=useState<ToolBoard|null>(remembered?.draft??null),[base,setBase]=useState<BoardRecord|null>(remembered?.base??null)
  const [saving,setSaving]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
  const [bank,setBank]=useState(false),[search,setSearch]=useState(''),[dragTitle,setDragTitle]=useState<string|null>(null)
  const busy=useRef(false)
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}))
  const board=draft??query.data?.content
  const dirty=draft!==null
  useEffect(()=>{client.setQueryDefaults(['project-tools-draft'],{gcTime:Infinity})},[client])
  useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false)},[dirty,onDirtyChange])
  function change(next:ToolBoard) {
    if (!canEdit||busy.current||!query.data) return
    if (!draft) setBase(query.data)
    client.setQueryData(draftKey,{draft:next,base:base??query.data})
    setDraft(next);setSaved(false);setError('')
  }
  function changeTool(tool:ProjectTool) { if(board) change({...board,tools:board.tools.map(t=>t.id===tool.id?tool:t)}) }
  function add(type:ToolType,target?:string) {
    if(!board||board.tools.length>=40)return
    const tools=[...board.tools],index=tools.findIndex(t=>t.id===target)
    tools.splice(index<0?tools.length:index,0,createTool(type));change({...board,tools})
  }
  function drop(event:DragEndEvent) {
    setDragTitle(null)
    if(!event.over||!board)return
    const id=String(event.active.id),target=String(event.over.id)
    if(id.startsWith('bank:')) { if(target==='project-tool-drop'||board.tools.some(t=>t.id===target))add(id.slice(5) as ToolType,target);return }
    const index=target==='project-tool-drop'?board.tools.length-1:board.tools.findIndex(t=>t.id===target)
    change(moveTool(board,id,index))
  }
  async function save() {
    if(!draft||!base||busy.current)return
    busy.current=true;setSaving(true);setError('')
    try {const record=await saveProjectTools(projectId,base.revision,draft);client.setQueryData(projectToolKeys.board(projectId),record);client.removeQueries({queryKey:draftKey,exact:true});setDraft(null);setBase(null);setSaved(true)}
    catch(e){setError(e instanceof Error?e.message:'Save failed. Your draft is still here.')}
    finally {busy.current=false;setSaving(false)}
  }
  function downloadDraft() {
    if (!draft) return
    const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}))
    const link=document.createElement('a');link.href=url;link.download='project-workspace-draft.json';link.click()
    window.setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  async function reload() {
    if(dirty&&!window.confirm('Discard your unsaved tool changes and load the latest saved workspace?'))return
    const result=await query.refetch()
    if(result.error){setError(result.error.message);return}
    client.removeQueries({queryKey:draftKey,exact:true});setDraft(null);setBase(null);setError('');setSaved(false)
  }
  if(query.isPending)return <section className="widget-card p-5" aria-busy="true">Loading project tools…</section>
  if(!board)return <section className="widget-card p-5"><h2 className="text-subtitle">Workspace · Beta</h2><p role="alert">{query.error?.message??'Could not load project tools.'}</p><Button variant="secondary" onClick={()=>void query.refetch()}>Retry</Button></section>
  const disabled=!canEdit||saving
  const filtered=TOOL_CATALOG.filter(t=>`${t.title} ${t.keywords}`.toLowerCase().includes(search.toLowerCase()))
  return <section className="project-tools" aria-label="Project workspace beta">
    <header className="pt-toolbar"><div className="pt-inline"><h2 className="text-subtitle">Workspace</h2><span className="pt-beta">Beta</span></div><div className="pt-inline"><span role="status">{saving?'Saving…':dirty?'Unsaved changes':saved?'Saved':''}</span>{canEdit&&<><Button variant="secondary" disabled={saving} aria-expanded={bank} iconLeft={<Plus size={16}/>} onClick={()=>setBank(!bank)}>Add tools</Button><Button disabled={!dirty||saving} loading={saving} onClick={()=>void save()}>Save workspace</Button>{dirty&&<Button variant="ghost" disabled={saving} onClick={()=>void reload()}>Discard changes</Button>}</>}</div></header>
    {!canEdit&&<p className="text-caption text-text-muted">Project members can edit this workspace.</p>}
    {(error||query.error)&&<div className="pt-error" role="alert"><p>{error||query.error?.message}</p><div className="pt-inline">{dirty&&<Button variant="secondary" onClick={()=>void save()} disabled={saving}>Retry save</Button>}{dirty&&<Button variant="secondary" onClick={downloadDraft}>Download draft</Button>}<Button variant="secondary" onClick={()=>void reload()} disabled={saving}>Load latest</Button></div></div>}
    {dirty&&base&&query.data&&query.data.revision!==base.revision&&!error&&<p role="status" className="pt-error">A newer version is available. Your draft is kept here; saving will check for a conflict.</p>}
    <DndContext sensors={sensors} collisionDetection={toolCollision} onDragStart={e=>setDragTitle(String(e.active.id).startsWith('bank:')?TOOL_CATALOG.find(t=>`bank:${t.type}`===e.active.id)?.title??'Tool':board.tools.find(t=>t.id===e.active.id)?.title??'Tool')} onDragCancel={()=>setDragTitle(null)} onDragEnd={drop}>
      {bank&&<aside className="pt-bank widget-card" aria-label="Tool bank"><div className="pt-inline"><Search size={16}/><h3 className="text-section">Tool bank</h3><Button size="sm" variant="ghost" onClick={()=>setBank(false)}>Close</Button></div><Input label="Find a tool" placeholder="Search tools…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="pt-bank-list">{filtered.map(t=><BankTool key={t.type} {...t} add={()=>add(t.type)} disabled={disabled||board.tools.length>=40}/>)}</div>{!filtered.length&&<p>No matching tools.</p>}{board.tools.length>=40&&<p>This project has reached its 40-tool limit.</p>}</aside>}
      <SortableContext items={board.tools.map(t=>t.id)} strategy={rectSortingStrategy}><BoardGrid>
        {!board.tools.length&&<div className="pt-empty"><p>Add a tool to start your workspace.</p>{canEdit&&<Button variant="secondary" onClick={()=>setBank(true)}>Browse tools</Button>}</div>}
        {board.tools.map((tool,index)=><ToolCard key={tool.id} tool={tool} index={index} count={board.tools.length} disabled={disabled} move={to=>change(moveTool(board,tool.id,to))} change={changeTool} remove={()=>{if(window.confirm(`Remove “${tool.title}” and its content? Existing project tasks will stay.`))change(removeTool(board,tool.id))}}><ProjectToolContent tool={tool} tools={board.tools} change={changeTool} disabled={disabled} objectives={objectives} renderTasks={renderTasks}/></ToolCard>)}
      </BoardGrid></SortableContext>
      <DragOverlay>{dragTitle&&<div className="pt-drag-preview widget-card"><GripVertical size={18}/>{dragTitle}</div>}</DragOverlay>
    </DndContext>
  </section>
}
