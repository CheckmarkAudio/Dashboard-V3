import { sampleTables, sampleTasks, sampleSessions, sampleThreads, today } from './fixtures.ts'

// Deliberately no network fallback. Unknown reads are empty; all writes fail
// explicitly. This adapter cannot upload, send messages, or modify live records.
export const sampleFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init)
  const url = new URL(request.url)
  const method = (init?.method ?? request.method).toUpperCase()
  const headers = new Headers(init?.headers ?? request.headers)
  const respond = (body: unknown, status = 200, count?: number) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json', ...(count === undefined ? {} : {'Content-Range':`0-${Math.max(0,count-1)}/${count}`})}})
  const blocked = () => respond({ message:'Sample preview is read-only. No changes were saved.', code:'SAMPLE_READ_ONLY' }, 403)
  if (url.pathname.includes('/rpc/')) {
    const rpc = url.pathname.split('/').pop()
    if (rpc === 'get_dm_threads') return respond(sampleThreads)
    if (rpc === 'find_or_create_dm') {
      const body = JSON.parse(typeof init?.body === 'string' ? init.body : await request.text())
      const thread = sampleThreads.find(item => item.members.some(member => member.id === body.p_other))
      return thread ? respond(thread.channel_id) : blocked()
    }
    if (rpc === 'member_overview_snapshot') return respond({today_note:null,must_do:{submission_type:'daily',submission:null},today_sessions:sampleSessions,primary_kpi:null,kpi_entries:[],streak:0,checklist:{source:'member_overview_snapshot',frequency:'daily',date_key:today,target_user_id:'dev-user',items:[],instance_id:null,pending_requests:[]}})
    if (rpc === 'get_member_assigned_tasks') {
      const params = JSON.parse((typeof init?.body === 'string' ? init.body : await request.text()) || '{}')
      return respond(sampleTasks.filter(task => task.assigned_to === params.p_user_id))
    }
    if (['get_team_assigned_tasks','admin_list_all_assigned_tasks'].includes(rpc ?? '')) return respond(sampleTasks)
    if (rpc === 'admin_list_all_sessions') return respond(sampleSessions)
    if (rpc === 'get_my_open_clock_entry') return respond(null)
    if (rpc === 'get_team_site_branding') return respond({})
    if (['get_studio_assigned_tasks','get_assignment_notifications','get_task_template_library','get_task_template_detail','get_clients','search_clients','get_pending_task_requests','get_my_task_requests','get_my_incoming_reassign_requests','get_my_outgoing_pending_reassign_requests','admin_recent_assignments','admin_recent_approvals','admin_currently_clocked_in','admin_list_clock_entries','get_my_open_clock_entry'].includes(rpc ?? '')) return respond([])
    return blocked()
  }
  if (!url.pathname.includes('/rest/v1/') || !['GET','HEAD'].includes(method)) return blocked()
  const table = url.pathname.split('/').pop() ?? ''
  let rows = [...(sampleTables[table] ?? [])]
  for (const [key, value] of url.searchParams) {
    if (value.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === value.slice(3))
    if (value.startsWith('neq.')) rows = rows.filter(row => String(row[key]) !== value.slice(4))
    if (value.startsWith('gte.')) rows = rows.filter(row => String(row[key]) >= value.slice(4))
    if (value.startsWith('in.(')) rows = rows.filter(row => value.slice(4, -1).split(',').includes(String(row[key])))
    if (value.startsWith('lte.')) rows = rows.filter(row => String(row[key]) <= value.slice(4))
  }
  const count = rows.length
  const limit = Number(url.searchParams.get('limit'))
  if (limit > 0) rows = rows.slice(0, limit)
  if (headers.get('accept')?.includes('vnd.pgrst.object+json')) return respond(rows[0] ?? null)
  return respond(rows, 200, count)
}
