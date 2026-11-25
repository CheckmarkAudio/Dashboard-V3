import { validateBoard, type BoardRecord } from '../domain/projectTools/model.ts'
import { sampleProjects, sampleTables } from './fixtures.ts'

// Dev-only adapter. No network or persistent storage. Only synthetic IDs accepted.
export function sampleProjectToolRpc(rpc: string, args: Record<string, unknown>): {body:unknown;status:number} | null {
  if(rpc!=='save_project_toolboard')return null
  if(!sampleProjects.some(p=>p.id===args.p_project_id))return {body:{message:'Unknown sample project',code:'42501'},status:403}
  try {validateBoard(args.p_content)} catch(e) {return {body:{message:(e as Error).message,code:'22023'},status:400}}
  const rows=sampleTables.project_toolboards??=[]
  const index=rows.findIndex(r=>r.project_id===args.p_project_id),old=rows[index]
  if(args.p_revision!==(old?.revision??0))return {body:{message:'Workspace changed',code:'40001'},status:409}
  const row:BoardRecord={project_id:String(args.p_project_id),revision:Number(args.p_revision)+1,content:args.p_content,updated_at:new Date().toISOString()}
  if(index<0)rows.push(row as unknown as Record<string,unknown>);else rows[index]=row as unknown as Record<string,unknown>
  return {body:row,status:200}
}
