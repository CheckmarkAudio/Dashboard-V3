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
import { MessageSquare, Plus, X } from 'lucide-react'
import MemberAvatar from '../members/MemberAvatar'
import { dmKeys, dmThreadLabel, type DmThread } from '../../lib/queries/dms'
import { useDmThreads, useDmUnreadCount } from './useDmThreads'
import { useDmDock } from './DmDockContext'
import NewMessageDialog from './NewMessageDialog'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

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

export default function MessagesBell() {
  const queryClient = useQueryClient()
  const { openThread: openInDock } = useDmDock()
  const unread = useDmUnreadCount()
  const { data: threads = [] } = useDmThreads()
  const [open, setOpen] = useState(false)
  const [entered, setEntered] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

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
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center px-4 py-8 text-text-light">
                <MessageSquare size={20} className="mb-2" aria-hidden="true" />
                <p className="text-[12px]">No conversations yet.</p>
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
              <div className="space-y-0.5">
                {threads.map((t) => (
                  <ThreadRow key={t.channel_id} thread={t} onOpen={() => openThread(t.channel_id)} />
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

function ThreadRow({ thread, onOpen }: { thread: DmThread; onOpen: () => void }) {
  const label = dmThreadLabel(thread)
  const unread = thread.unread_count > 0
  const unreadLabel = thread.unread_count > 9 ? '9+' : String(thread.unread_count)
  const lead = thread.members[0] ?? null
  const preview = thread.latest_content?.trim() || 'No messages yet'
  const senderPrefix =
    thread.kind === 'group' && thread.latest_sender
      ? `${thread.latest_sender.split(' ')[0]}: `
      : ''

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open message thread with ${label}${unread ? `, ${thread.unread_count} unread` : ''}`}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left hover:bg-surface-hover transition-colors focus-ring"
    >
      <span className="relative shrink-0">
        <MemberAvatar member={lead} displayName={label} size="sm" />
        {unread && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-surface" aria-hidden="true" />
        )}
      </span>
      <span className="flex-1 min-w-0">
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
      </span>
      {unread && (
        <span className="shrink-0 inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full bg-rose-500/15 border border-rose-400/30 text-[10px] font-bold text-rose-400 tabular-nums">
          {unreadLabel} new
        </span>
      )}
    </button>
  )
}
