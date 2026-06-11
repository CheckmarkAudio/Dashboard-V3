// DmDock — Facebook-Messenger-style floating chat dock.
//
// Mounted in Layout (outside the routed <Outlet/>) so open conversations
// stay put as the user moves between pages. Each open thread is either an
// expanded chat window or a collapsed "head" in the bottom-right corner.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Minus, Send, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import MemberAvatar from '../members/MemberAvatar'
import LinkifiedText from '../forum/LinkifiedText'
import MediaPicker from '../forum/MediaPicker'
import AttachmentDisplay from '../forum/AttachmentDisplay'
import { useToast } from '../Toast'
import type { ChatAttachment } from '../../lib/forum/attachments'
import { inferForumKind, uploadForumFile } from '../../lib/forum/upload'
import { dmKeys, dmThreadLabel, markDmRead, type DmThread } from '../../lib/queries/dms'
import { useDmDock } from './DmDockContext'
import { useDmThreads } from './useDmThreads'
import { useChannelChat } from './useChannelChat'

export default function DmDock() {
  const { profile } = useAuth()
  const { open, minimized, closeThread, toggleMinimize } = useDmDock()
  const { data: threads = [] } = useDmThreads()

  if (!profile || open.length === 0) return null

  const byId = new Map(threads.map((t) => [t.channel_id, t]))

  return (
    <div className="fixed bottom-0 right-4 z-[55] flex items-end gap-3 pointer-events-none">
      {open.map((channelId) => (
        <DmChatWindow
          key={channelId}
          channelId={channelId}
          thread={byId.get(channelId)}
          minimized={Boolean(minimized[channelId])}
          onToggleMinimize={() => toggleMinimize(channelId)}
          onClose={() => closeThread(channelId)}
        />
      ))}
    </div>
  )
}

function DmChatWindow({
  channelId,
  thread,
  minimized,
  onToggleMinimize,
  onClose,
}: {
  channelId: string
  thread: DmThread | undefined
  minimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
}) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { messages, loading, send } = useChannelChat(channelId)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<ChatAttachment[]>([])
  const [dragDepth, setDragDepth] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!channelId || !profile?.id) return
      const accepted: File[] = []
      const skipped: string[] = []
      for (const f of files) {
        if (inferForumKind(f) === null) skipped.push(f.name)
        else accepted.push(f)
      }
      if (skipped.length > 0) {
        toast(
          skipped.length === 1
            ? `${skipped[0]} isn't an image, video, or audio file.`
            : `${skipped.length} files weren't image / video / audio.`,
          'error',
        )
      }
      if (accepted.length === 0) return
      await Promise.all(
        accepted.map(async (file) => {
          try {
            const attachment = await uploadForumFile({ file, channelId, userId: profile.id })
            setPending((prev) => [...prev, attachment])
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Upload failed', 'error')
          }
        }),
      )
    },
    [channelId, profile?.id, toast],
  )

  const dragHasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes('Files')
  const onDragEnter = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    setDragDepth((d) => d + 1)
  }
  const onDragLeave = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    setDragDepth((d) => Math.max(0, d - 1))
  }
  const onDragOver = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  const onDrop = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    setDragDepth(0)
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length > 0) void uploadFiles(files)
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it?.kind === 'file') {
        const f = it.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length > 0) void uploadFiles(files)
  }

  const label = thread ? dmThreadLabel(thread) : 'Conversation'
  const lead = thread?.members[0] ?? null
  const unread = thread?.unread_count ?? 0

  // Auto-scroll to newest while expanded.
  useEffect(() => {
    if (!minimized) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, minimized])

  // Mark read while the window is open + expanded (clears the bell badge).
  useEffect(() => {
    if (minimized || loading) return
    void markDmRead(channelId)
      .then(() => queryClient.invalidateQueries({ queryKey: dmKeys.list() }))
      .catch(() => {})
  }, [channelId, minimized, loading, messages.length, queryClient])

  const canSend = input.trim().length > 0 || pending.length > 0
  const submit = () => {
    if (!canSend) return
    const t = input.trim()
    const atts = pending
    setInput('')
    setPending([])
    void send(t, atts)
  }

  // ── Minimized: a head with an unread dot ──
  if (minimized) {
    return (
      <button
        type="button"
        onClick={onToggleMinimize}
        className="pointer-events-auto relative mb-3 rounded-full shadow-lg ring-2 ring-surface hover:scale-105 transition-transform focus-ring"
        title={label}
        aria-label={`Open conversation with ${label}${unread > 0 ? `, ${unread} unread` : ''}`}
      >
        <MemberAvatar member={lead} displayName={label} size="lg" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none tabular-nums ring-2 ring-surface">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    )
  }

  // ── Expanded: full chat window ──
  return (
    <div
      className="pointer-events-auto relative mb-0 w-[320px] max-w-[calc(100vw-2rem)] h-[440px] max-h-[calc(100vh-5rem)] flex flex-col bg-surface border border-border rounded-t-2xl shadow-2xl overflow-hidden animate-slide-up"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPaste={onPaste}
    >
      {dragDepth > 0 && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center gap-1 rounded-t-2xl border-2 border-dashed border-gold/70 bg-gold/10 backdrop-blur-sm">
          <span className="text-gold font-semibold text-[13px]">Drop to attach</span>
          <span className="text-gold/60 text-[11px]">image · video · audio</span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-surface-alt/40 shrink-0">
        <button
          type="button"
          onClick={onToggleMinimize}
          className="flex items-center gap-2 min-w-0 flex-1 text-left focus-ring rounded-lg -m-1 p-1 hover:bg-surface-hover transition-colors"
          title="Minimize"
        >
          <MemberAvatar member={lead} displayName={label} size="sm" />
          <span className="text-[13px] font-bold text-text truncate">{label}</span>
        </button>
        <button
          type="button"
          onClick={onToggleMinimize}
          aria-label="Minimize conversation"
          className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-ring"
        >
          <Minus size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close conversation"
          className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-ring"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold/20 border-t-gold" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-[12px] text-text-light text-center py-6">No messages yet. Say hi 👋</p>
        ) : (
          messages.map((m) => {
            const isMe = profile?.id === m.sender_id
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${m._status === 'sending' ? 'opacity-70' : ''}`}>
                <div
                  className={`px-3 py-1.5 rounded-2xl text-[13px] leading-relaxed break-words whitespace-pre-wrap max-w-[80%] ${
                    isMe
                      ? 'bg-gold/15 text-text border border-gold/25 rounded-br-sm'
                      : 'bg-surface-alt text-text-muted border border-border rounded-bl-sm'
                  }`}
                  title={m._status === 'failed' ? 'Failed to send' : undefined}
                >
                  {/* Group threads: show who said it. */}
                  {!isMe && thread?.kind === 'group' && (
                    <span className="block text-[10px] font-semibold text-gold/80 mb-0.5">{m.sender_name}</span>
                  )}
                  {m.content && <LinkifiedText text={m.content} />}
                  {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                    <div className={m.content ? 'mt-1.5' : ''}>
                      <AttachmentDisplay attachments={m.attachments} ownBubble={isMe} lazy={false} />
                    </div>
                  )}
                  {m._status === 'failed' && <span className="block text-[10px] text-rose-400 mt-0.5">Failed — tap to retry</span>}
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Composer — MediaPicker (same as the Forum) stacks above the
          input row; renders the pending-attachment strip itself. */}
      <div className="px-2.5 py-2 border-t border-border shrink-0 space-y-2">
        <MediaPicker
          channelId={channelId}
          userId={profile?.id ?? 'anon'}
          pending={pending}
          onAdd={(a) => setPending((prev) => [...prev, a])}
          onRemove={(idx) => setPending((prev) => prev.filter((_, i) => i !== idx))}
        />
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={`Message ${label.split(' ')[0]}…`}
            className="flex-1 min-w-0 bg-surface-alt border border-border rounded-xl px-3 py-2 text-[13px] placeholder:text-text-light focus:border-gold focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
            className={`shrink-0 p-2 rounded-xl transition-all ${
              canSend ? 'bg-gold text-black hover:bg-gold-muted' : 'bg-surface-alt text-text-light border border-border cursor-not-allowed'
            }`}
          >
            <Send size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

