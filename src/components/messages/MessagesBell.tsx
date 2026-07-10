// MessagesBell — top-bar Direct Messages dropdown.
//
// Sits just left of the NotificationsBell and mirrors its interaction
// model (anchored portal dropdown, ease-out-expo open/close, outside-
// click / Escape to close). Lists the caller's DM + group threads with
// unread badges; a row opens the thread in the Forum DM view, and
// "New message" launches the member picker.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, MessageSquare, Plus, Send, X } from 'lucide-react'
import MemberAvatar from '../members/MemberAvatar'
import { dmKeys, dmThreadLabel, markDmRead, type DmThread } from '../../lib/queries/dms'
import { useDmThreads, useDmUnreadCount } from './useDmThreads'
import { useDmDock } from './DmDockContext'
import NewMessageDialog from './NewMessageDialog'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  notificationWorkflowKey,
  useNotificationWorkflow,
  type NotificationWorkflowStatus,
} from '../notifications/notificationWorkflow'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const RECENT_THREAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

type ThreadDisplayStatus = 'new' | NotificationWorkflowStatus

const STATUS_RANK: Record<ThreadDisplayStatus, number> = {
  new: 0,
  started: 1,
  replied: 1,
  resolved: 2,
}

const STATUS_STYLES: Record<ThreadDisplayStatus, string> = {
  new: 'bg-rose-500/15 border-rose-400/30 text-rose-400',
  started: 'bg-lime-500/15 border-lime-400/30 text-lime-300',
  replied: 'bg-lime-500/15 border-lime-400/30 text-lime-300',
  resolved: 'bg-surface-alt border-border text-text-light',
}

function StatusBadge({ status, count }: { status: ThreadDisplayStatus; count: number }) {
  const label = status === 'new' ? `${count > 9 ? '9+' : count} new` : status
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full border text-[10px] font-bold tabular-nums capitalize ${STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  )
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

function isRecentThread(thread: DmThread): boolean {
  if (!thread.latest_created_at) return false
  return Date.now() - new Date(thread.latest_created_at).getTime() <= RECENT_THREAD_WINDOW_MS
}

export default function MessagesBell() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const workflow = useNotificationWorkflow()
  const { openThread: openInDock } = useDmDock()
  const unread = useDmUnreadCount()
  const { data: threads = [] } = useDmThreads()
  const [open, setOpen] = useState(false)
  const [entered, setEntered] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null)
  const [confirmingResolveId, setConfirmingResolveId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const getThreadKey = (thread: DmThread) => notificationWorkflowKey('dm', thread.channel_id)
  const getThreadStatus = (thread: DmThread): ThreadDisplayStatus =>
    workflow.getRecord(getThreadKey(thread))?.status ?? (thread.unread_count > 0 ? 'new' : 'started')
  const visibleThreads = [...threads]
    .filter((thread) => thread.unread_count > 0 || isRecentThread(thread) || workflow.getRecord(getThreadKey(thread)))
    .sort((a, b) => {
      const rankDelta = STATUS_RANK[getThreadStatus(a)] - STATUS_RANK[getThreadStatus(b)]
      if (rankDelta !== 0) return rankDelta
      return new Date(b.latest_created_at ?? 0).getTime() - new Date(a.latest_created_at ?? 0).getTime()
    })

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      if (!buttonRef.current) return
      const r = buttonRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) { setEntered(false); return }
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (buttonRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const openThread = (channelId: string) => {
    setOpen(false)
    // Pop the conversation into the floating dock so it follows the
    // user across pages (Messenger-style), rather than navigating away.
    openInDock(channelId)
  }

  const markThreadRead = (channelId: string) => {
    const nowIso = new Date().toISOString()
    queryClient.setQueryData<DmThread[]>(dmKeys.list(), (prev) =>
      prev?.map((thread) =>
        thread.channel_id === channelId
          ? { ...thread, unread_count: 0, last_read_at: nowIso }
          : thread,
      ) ?? prev,
    )
    void markDmRead(channelId)
      .then(() => queryClient.invalidateQueries({ queryKey: dmKeys.list() }))
      .catch(() => queryClient.invalidateQueries({ queryKey: dmKeys.list() }))
  }

  const startThread = (thread: DmThread) => {
    const current = workflow.getRecord(getThreadKey(thread))?.status
    if (current !== 'resolved' && current !== 'replied') workflow.setStarted(getThreadKey(thread))
    if (thread.unread_count > 0) markThreadRead(thread.channel_id)
  }

  const resolveThread = (thread: DmThread) => {
    workflow.setResolved(getThreadKey(thread))
    markThreadRead(thread.channel_id)
    setConfirmingResolveId(null)
  }

  const togglePreview = (thread: DmThread) => {
    const channelId = thread.channel_id
    setExpandedThreadId((current) => {
      const next = current === channelId ? null : channelId
      if (next !== channelId) setReplyText('')
      if (next === channelId) startThread(thread)
      setConfirmingResolveId(null)
      return next
    })
  }

  const handleResolveClick = (thread: DmThread) => {
    if (confirmingResolveId === thread.channel_id) {
      resolveThread(thread)
      return
    }
    setConfirmingResolveId(thread.channel_id)
  }

  const sendQuickReply = async (thread: DmThread) => {
    const text = replyText.trim()
    if (!text || !profile || replyBusy) return
    setReplyBusy(true)
    try {
      const name = profile.display_name ?? 'Member'
      const { error } = await supabase.from('chat_messages').insert({
        channel_id: thread.channel_id,
        sender_name: name,
        sender_id: profile.id,
        sender_initial: name.charAt(0).toUpperCase(),
        content: text,
      })
      if (error) throw error
      setReplyText('')
      workflow.setReplied(getThreadKey(thread))
      markThreadRead(thread.channel_id)
      void queryClient.invalidateQueries({ queryKey: dmKeys.list() })
    } catch {
      void queryClient.invalidateQueries({ queryKey: dmKeys.list() })
    } finally {
      setReplyBusy(false)
    }
  }

  const onCreated = (channelId: string) => {
    void queryClient.invalidateQueries({ queryKey: dmKeys.list() })
    openThread(channelId)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Open messages${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative shrink-0 inline-flex h-10 items-center gap-2 px-2.5 rounded-xl text-text-muted hover:bg-surface-hover hover:text-gold transition-colors focus-ring ${
          open ? 'text-gold bg-white/[0.04] ring-1 ring-white/10' : ''
        }`}
        title="Messages"
      >
        <MessageSquare size={16} aria-hidden="true" />
        <span className="hidden xl:inline text-[12px] font-bold tracking-tight">Messages</span>
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none tabular-nums ring-2 ring-bg"
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Messages"
          tabIndex={-1}
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            zIndex: 60,
            transformOrigin: 'top right',
            opacity: entered ? 1 : 0,
            transform: entered ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(-4px)',
            transition: `opacity 180ms ${EASE}, transform 180ms ${EASE}`,
            willChange: 'opacity, transform',
          }}
          className="w-[360px] max-w-[calc(100vw-32px)] bg-surface/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.18),0_8px_24px_rgba(0,0,0,0.32),0_16px_48px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden focus:outline-none"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
            <div>
              <p className="text-[13px] font-bold text-text">Messages</p>
              <p className="text-[11px] text-text-light">Direct chats with teammates</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowNew(true)}
                aria-label="New message"
                title="New message"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-gold hover:bg-gold/10 transition-colors focus-ring"
              >
                <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
                New
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close messages"
                className="p-1 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text transition-colors focus-ring"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="p-2 max-h-[min(480px,70vh)] overflow-y-auto scroll-smooth">
            {visibleThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center px-4 py-8 text-text-light">
                <MessageSquare size={20} className="mb-2" aria-hidden="true" />
                <p className="text-[12px]">No message follow-ups right now.</p>
                <button
                  type="button"
                  onClick={() => setShowNew(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold text-black text-[12px] font-bold hover:bg-gold-muted transition-colors focus-ring"
                >
                  <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
                  New message
                </button>
              </div>
            ) : (
              <div className="divide-y divide-theme overflow-hidden rounded-xl border border-border bg-surface-alt/20">
                {visibleThreads.map((t) => (
                  <ThreadRow
                    key={t.channel_id}
                    thread={t}
                    status={getThreadStatus(t)}
                    expanded={expandedThreadId === t.channel_id}
                    confirmingResolve={confirmingResolveId === t.channel_id}
                    replyText={expandedThreadId === t.channel_id ? replyText : ''}
                    replyBusy={replyBusy && expandedThreadId === t.channel_id}
                    onTogglePreview={() => togglePreview(t)}
                    onOpen={() => {
                      startThread(t)
                      openThread(t.channel_id)
                    }}
                    onReplyChange={setReplyText}
                    onResolveClick={() => handleResolveClick(t)}
                    onSendReply={() => void sendQuickReply(t)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {showNew && (
        <NewMessageDialog onClose={() => setShowNew(false)} onCreated={onCreated} />
      )}
    </>
  )
}

function ThreadRow({
  thread,
  status,
  expanded,
  confirmingResolve,
  replyText,
  replyBusy,
  onTogglePreview,
  onOpen,
  onReplyChange,
  onResolveClick,
  onSendReply,
}: {
  thread: DmThread
  status: ThreadDisplayStatus
  expanded: boolean
  confirmingResolve: boolean
  replyText: string
  replyBusy: boolean
  onTogglePreview: () => void
  onOpen: () => void
  onReplyChange: (value: string) => void
  onResolveClick: () => void
  onSendReply: () => void
}) {
  const label = dmThreadLabel(thread)
  const unread = thread.unread_count > 0
  const lead = thread.members[0] ?? null
  const preview = thread.latest_content?.trim() || 'No messages yet'
  const senderPrefix =
    thread.kind === 'group' && thread.latest_sender
      ? `${thread.latest_sender.split(' ')[0]}: `
      : ''

  return (
    <div className={`transition-colors ${status === 'resolved' ? 'bg-surface-alt/30 opacity-75' : expanded ? 'bg-violet-500/10' : status === 'new' ? 'bg-gold/8' : 'hover:bg-surface-hover'}`}>
      <div className="flex items-start gap-3 px-2 py-2">
        <button
          type="button"
          onClick={onTogglePreview}
          aria-expanded={expanded}
          aria-label={`Preview message thread with ${label}${unread ? `, ${thread.unread_count} unread` : ''}`}
          className="relative shrink-0 rounded-full focus-ring"
        >
          <MemberAvatar member={lead} displayName={label} size="sm" />
          {unread && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-surface" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onTogglePreview}
          aria-expanded={expanded}
          className="flex-1 min-w-0 text-left rounded-lg -my-1 py-1 focus-ring"
        >
          <span className="flex items-center justify-between gap-2">
            <span className={`text-[13px] truncate ${unread ? 'font-bold text-text' : 'font-semibold text-text-muted'}`}>
              {label}
            </span>
            <span className="shrink-0 text-[10px] text-text-light tabular-nums">
              {relativeTime(thread.latest_created_at)}
            </span>
          </span>
          <span className={`block text-[12px] truncate mt-0.5 ${unread ? 'text-text' : 'text-text-light'}`}>
            {senderPrefix}{preview}
          </span>
        </button>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <StatusBadge status={status} count={thread.unread_count} />
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-violet-500/15 text-violet-200 text-[10px] font-bold hover:bg-violet-500/25 transition-colors focus-ring"
          >
            <ExternalLink size={10} strokeWidth={2.6} aria-hidden="true" />
            Open
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 animate-fade-in">
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-violet-300/80 mb-1">
              {thread.latest_sender ?? label}
            </p>
            <p className="text-[12px] text-text whitespace-pre-wrap break-words line-clamp-4 leading-snug">
              {preview}
            </p>
          </div>
          <textarea
            rows={2}
            value={replyText}
            onChange={(e) => onReplyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                onSendReply()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                onTogglePreview()
              }
            }}
            placeholder={`Reply to ${label}...`}
            className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-violet-500/25 text-[12px] text-text placeholder:text-text-light focus:border-violet-400/60 focus:outline-none resize-none min-h-[54px]"
          />
          <div className="flex items-center justify-between gap-2">
            {status !== 'resolved' ? (
              <button
                type="button"
                onClick={onResolveClick}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/10 transition-colors focus-ring"
              >
                <Check size={11} strokeWidth={2.8} aria-hidden="true" />
                {confirmingResolve ? 'Finish' : 'Resolve'}
              </button>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70">
                Resolved
              </span>
            )}
            <button
              type="button"
              onClick={onSendReply}
              disabled={!replyText.trim() || replyBusy}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-violet-500 text-white text-[11px] font-bold hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
            >
              <Send size={11} aria-hidden="true" />
              {replyBusy ? 'Sending...' : 'Send'}
            </button>
          </div>
          {confirmingResolve && (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200">
              Notification resolved? Click Finish to complete.
            </div>
          )}
          <p className="text-[10px] text-text-light/70">Cmd/Ctrl + Enter to send. Resolved items move to the bottom for 7 days.</p>
        </div>
      )}
    </div>
  )
}
