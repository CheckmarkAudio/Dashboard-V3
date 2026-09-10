import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Plus } from 'lucide-react'
import { useDmThreads } from '../messages/useDmThreads'
import { useDmDock } from '../messages/DmDockContext'
import NewMessageDialog from '../messages/NewMessageDialog'
import { dmKeys, dmThreadLabel } from '../../lib/queries/dms'

/** The summary and this list use the same DM query, so counts open matching work. */
export default function OverviewMessagesPanel() {
  const query = useDmThreads()
  const queryClient = useQueryClient()
  const { openThread } = useDmDock()
  const [showNew, setShowNew] = useState(false)
  const threads = [...(query.data ?? [])].sort((a, b) => Number(b.unread_count > 0) - Number(a.unread_count > 0))
  return <div className="min-h-[280px]">
    <div className="flex items-center justify-between gap-3 mb-3">
      <p className="text-xs text-text-muted">Unread conversations first</p>
      <button type="button" onClick={() => setShowNew(true)} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold focus-ring"><Plus size={14} />New message</button>
    </div>
    {query.isLoading ? <p role="status" className="p-5 text-sm text-text-muted">Loading messages…</p>
      : query.isError ? <div className="p-5 text-sm"><p>Could not load messages.</p><button type="button" onClick={() => void query.refetch()} className="text-gold mt-2 focus-ring">Try again</button></div>
      : threads.length === 0 ? <p className="p-5 text-sm text-text-muted">No conversations yet. Start a new message to connect with your team.</p>
      : <div className="divide-y divide-border">{threads.map(thread => <button key={thread.channel_id} type="button" onClick={() => openThread(thread.channel_id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-surface-alt focus-ring">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-gold/15 text-sm text-gold">{dmThreadLabel(thread).slice(0, 1)}</span>
        <span className="flex-1 min-w-0"><strong className="block truncate text-sm">{dmThreadLabel(thread)}</strong><span className="block truncate mt-1 text-xs text-text-muted">{thread.latest_content || 'Open conversation'}</span></span>
        {thread.unread_count > 0 && <span className="rounded-full bg-gold/15 px-2 py-1 text-xs text-gold">{thread.unread_count} unread</span>}
        <ArrowUpRight size={15} className="text-gold shrink-0" aria-hidden="true" />
      </button>)}</div>}
    {showNew && <NewMessageDialog onClose={() => setShowNew(false)} onCreated={channelId => {
      setShowNew(false)
      void queryClient.invalidateQueries({ queryKey: dmKeys.list() })
      openThread(channelId)
    }} />}
  </div>
}
