import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { usePresence } from '../contexts/PresenceContext'
import { supabase } from '../lib/supabase'
import { fetchTeamMembers, teamMemberKeys } from '../lib/queries/teamMembers'
import MemberAvatar from '../components/members/MemberAvatar'
import MediaPicker from '../components/forum/MediaPicker'
import AttachmentDisplay from '../components/forum/AttachmentDisplay'
import LinkifiedText from '../components/forum/LinkifiedText'
import CreateChannelDialog from '../components/forum/CreateChannelDialog'
import { chatColorTokens, resolveChatColorKey } from '../lib/forum/chatColor'
import { OWNER_EMAIL } from '../domain/permissions'
import type { ChatAttachment } from '../lib/forum/attachments'
import { Send, Hash, Plus, Users } from 'lucide-react'
import type { TeamMember } from '../types'

type Channel = { id: string; name: string; slug: string; description: string }
type Message = {
  id: string
  channel_id: string
  sender_name: string
  sender_id: string
  sender_initial: string
  content: string
  created_at: string
  attachments?: ChatAttachment[] | null
}

export default function Content() {
  useDocumentTitle('Forum - Checkmark Workspace')
  const { profile, isAdmin } = useAuth()
  const { isOnline } = usePresence()
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  // 2026-05-20 — Admin-only "create channel" dialog. Opens from
  // the small +New button next to the Channels sidebar header.
  // RLS (admins_can_insert_channels) gates the actual INSERT, so
  // hiding the trigger for non-admins is a UX nicety, not a
  // security boundary.
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Team members for the sidebar. Shares cache with other pages via
  // teamMemberKeys.list() so reloading the Forum doesn't re-fetch.
  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const activeMembers = (teamQuery.data ?? []).filter(
    (m) => m.status?.toLowerCase() !== 'inactive',
  )
  // Sort: online first, then alphabetical. Stable sort within each
  // group so the list doesn't jiggle as presence flips.
  const sortedMembers = [...activeMembers].sort((a, b) => {
    const aOn = isOnline(a.id)
    const bOn = isOnline(b.id)
    if (aOn !== bOn) return aOn ? -1 : 1
    return a.display_name.localeCompare(b.display_name)
  })

  // Load channels — extracted so the create-channel callback can
  // refresh the list without a full reload.
  const loadChannels = useCallback(async (): Promise<Channel[]> => {
    const { data } = await supabase.from('chat_channels').select('*').order('created_at')
    const list = data ?? []
    setChannels(list)
    return list
  }, [])

  useEffect(() => {
    void loadChannels().then((list) => {
      if (list.length > 0 && !activeChannel) setActiveChannel(list[0]!)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load messages for active channel — explicit columns now since
  // we added `attachments` jsonb (selecting * is brittle when the
  // schema grows).
  const loadMessages = useCallback(async () => {
    if (!activeChannel) return
    const { data } = await supabase
      .from('chat_messages')
      .select('id, channel_id, sender_name, sender_id, sender_initial, content, created_at, attachments')
      .eq('channel_id', activeChannel.id)
      .order('created_at', { ascending: true })
    if (data) setMessages(data as Message[])
  }, [activeChannel])

  useEffect(() => { loadMessages() }, [loadMessages])

  // Realtime subscription
  useEffect(() => {
    if (!activeChannel) return
    const sub = supabase
      .channel(`messages-${activeChannel.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${activeChannel.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [activeChannel])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset pending attachments when switching channels — they were
  // uploaded against the previous channel's path, but more
  // importantly the user's intent was to send them THERE.
  useEffect(() => {
    setPendingAttachments([])
    setInput('')
  }, [activeChannel?.id])

  // Send message — text + attachments (either can be empty, but
  // not both). Uploads already happened in MediaPicker; this just
  // composes the row.
  const sendMessage = async () => {
    if (!activeChannel) return
    const trimmed = input.trim()
    if (!trimmed && pendingAttachments.length === 0) return
    if (sending) return

    const name = profile?.display_name ?? 'User'
    const id = profile?.id ?? 'dev-user'
    const initial = name.charAt(0).toUpperCase()
    setSending(true)
    try {
      const { error } = await supabase.from('chat_messages').insert({
        channel_id: activeChannel.id,
        sender_name: name,
        sender_id: id,
        sender_initial: initial,
        content: trimmed,
        attachments: pendingAttachments,
      })
      if (error) throw error
      setInput('')
      setPendingAttachments([])
    } finally {
      setSending(false)
    }
  }

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    } catch { return '' }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gold/20 border-t-gold" /></div>
  }

  // Lookup helper for messages — avatar/profile photo + presence
  // dot need the full TeamMember row, not just sender_name on the
  // chat row.
  const memberById = new Map(activeMembers.map((m) => [m.id, m]))

  const canSend = (input.trim().length > 0 || pendingAttachments.length > 0) && !sending

  return (
    <div className="max-w-6xl mx-auto animate-fade-in flex flex-col">
      <h1 className="text-[28px] font-extrabold tracking-tight text-text mb-3">Forum</h1>

      {/* Lean 8 — chat fills the available height (was a hard
          h-[500px] before). Min-height keeps it usable on tiny
          screens. The Troubleshooting form moved to a global corner
          button (see TroubleshootingButton.tsx mounted in Layout). */}
      <div className="flex h-[calc(100vh-180px)] min-h-[480px] bg-surface rounded-2xl border border-border overflow-hidden">
        {/* Sidebar: Channels + Members */}
        <div className="w-[220px] border-r border-border flex flex-col shrink-0">
          {/* Channels */}
          <div className="px-3 pt-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-text-light uppercase tracking-wider">Channels</p>
              {/* 2026-05-20 — Admin-only "+ New" trigger. Hidden
                  for members; RLS gates the actual INSERT, so this
                  is UX nicety, not a security boundary. */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowCreateChannel(true)}
                  aria-label="Create a new channel"
                  title="Create a new channel"
                  className="inline-flex items-center justify-center w-5 h-5 rounded-md text-text-light hover:text-gold hover:bg-gold/10 transition-colors focus-ring"
                >
                  <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="space-y-0.5">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    activeChannel?.id === ch.id ? 'bg-gold/10 text-gold' : 'text-text-muted hover:text-text hover:bg-white/[0.03]'
                  }`}
                >
                  <Hash size={13} className={activeChannel?.id === ch.id ? 'text-gold' : 'text-text-light'} />
                  <span className="text-[13px] font-medium tracking-tight truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Members — Lean 8 presence dots replace the always-green
              static dot. Online = currently has the app open in any
              tab (PresenceContext). Members sort online-first. */}
          <div className="px-3 pt-3 pb-4 mt-auto border-t border-border/50 overflow-y-auto">
            <p className="text-[10px] font-semibold text-text-light uppercase tracking-wider mb-2 flex items-center gap-1">
              <Users size={10} /> Members
            </p>
            <div className="space-y-1.5">
              {sortedMembers.length === 0 && !teamQuery.isLoading && (
                <p className="text-[11px] text-text-light italic">No members yet</p>
              )}
              {sortedMembers.map((m) => (
                <MemberRow key={m.id} member={m} online={isOnline(m.id)} />
              ))}
            </div>
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel header */}
          <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-[15px] font-bold text-text tracking-tight flex items-center gap-1.5">
                <Hash size={14} className="text-gold" />
                {activeChannel?.name ?? 'Select a channel'}
              </h2>
              {activeChannel?.description && (
                <p className="text-[11px] text-text-light mt-0.5">{activeChannel.description}</p>
              )}
            </div>
            <span className="text-[10px] text-text-light">{messages.length} messages</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <p className="text-[13px] text-text-light text-center py-8">No messages yet. Start the conversation!</p>
            )}
            {messages.map((msg) => {
              const isMe = profile?.id === msg.sender_id
              const member = memberById.get(msg.sender_id)
              return (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  member={member}
                  isMe={isMe}
                  time={formatTime(msg.created_at)}
                />
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input — MediaPicker stacks above the input row
              when there are pending attachments OR when the picker
              popover is open. Send is disabled until there's text
              OR at least one attachment. */}
          {activeChannel && (
            <div className="px-5 py-3 border-t border-border shrink-0 space-y-2">
              <MediaPicker
                channelId={activeChannel.id}
                userId={profile?.id ?? 'anon'}
                pending={pendingAttachments}
                onAdd={(a) => setPendingAttachments((prev) => [...prev, a])}
                onRemove={(idx) =>
                  setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))
                }
                disabled={sending}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendMessage()
                    }
                  }}
                  placeholder={`Message #${activeChannel.name}...`}
                  className="flex-1 bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-[14px] placeholder:text-text-light focus:border-gold"
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={!canSend}
                  className={`px-4 py-2.5 rounded-xl transition-all ${
                    canSend ? 'bg-gold text-black hover:bg-gold-muted' : 'bg-surface-alt text-text-light border border-border cursor-not-allowed'
                  }`}
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2026-05-20 — Admin "create channel" dialog. Rendered at the
          page level so it can portal over the sidebar without
          layout-flow side effects. */}
      {showCreateChannel && (
        <CreateChannelDialog
          existing={channels.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
          onClose={() => setShowCreateChannel(false)}
          onCreated={(created) => {
            // Refresh list from server (single source of truth) so
            // sort order matches what other tabs will see on reload.
            void loadChannels().then((list) => {
              const fresh = list.find((c) => c.id === created.id)
              if (fresh) setActiveChannel(fresh)
            })
          }}
        />
      )}
    </div>
  )
}

// ─── Pieces ────────────────────────────────────────────────────────

/**
 * Chat bubble. Mine = right-aligned with a gold tint, theirs =
 * left-aligned with the surface tint. Avatar is on the OUTER edge
 * either way (right edge for me, left edge for them).
 *
 * 2026-05-13 — sender_name now uses a per-member chat color
 * (resolved via `team_members.preferences.chat_color` with a hash
 * fallback) so the chat doesn't read as one long wall of gold.
 * Attachments render below the text via `<AttachmentDisplay>`.
 */
function ChatBubble({
  message,
  member,
  isMe,
  time,
}: {
  message: Message
  member: TeamMember | undefined
  isMe: boolean
  time: string
}) {
  // Per-member chat color. Override comes from the member's own
  // preferences when we have the row; falls back to a deterministic
  // hash of the sender_id otherwise so anonymous reads still get a
  // stable color.
  const overrideColor = (member?.preferences as Record<string, unknown> | null | undefined)?.chat_color
  // Owner = Checkmark — always rendered in brand gold so their
  // messages read as the studio voice sitewide (2026-05-17).
  const isOwner = member?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()
  const colorKey = resolveChatColorKey(message.sender_id, overrideColor, { isOwner })
  const tokens = chatColorTokens(colorKey)
  const attachments = Array.isArray(message.attachments) ? message.attachments : []

  return (
    <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      <span className={`shrink-0 inline-flex rounded-full ring-2 ${tokens.ring}`}>
        <MemberAvatar
          member={member ?? null}
          displayName={message.sender_name}
          size="sm"
        />
      </span>
      <div className={`flex flex-col min-w-0 max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-baseline gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className={`text-[12px] font-semibold tracking-tight ${tokens.text}`}>
            {isMe ? 'You' : message.sender_name}
          </span>
          <span className="text-[10px] text-text-light">{time}</span>
        </div>
        {message.content && (
          <div
            className={`mt-0.5 px-3 py-2 rounded-2xl text-[14px] leading-relaxed break-words whitespace-pre-wrap ${
              isMe
                ? 'bg-gold/15 text-text border border-gold/25 rounded-br-sm'
                : 'bg-surface-alt text-text-muted border border-border rounded-bl-sm'
            }`}
          >
            {/* 2026-05-20 — Replaced inert `{message.content}` with
                <LinkifiedText> so pasted URLs render as clickable
                anchors. Preserves whitespace + newlines via the
                outer `whitespace-pre-wrap`. */}
            <LinkifiedText text={message.content} />
          </div>
        )}
        {attachments.length > 0 && (
          <AttachmentDisplay attachments={attachments} ownBubble={isMe} />
        )}
      </div>
    </div>
  )
}

/**
 * Member sidebar row with presence dot. Click jumps to their
 * profile (matches the rest of the app — every member name in the
 * UI routes to /profile/:id).
 */
function MemberRow({ member, online }: { member: TeamMember; online: boolean }) {
  return (
    <a
      href={`/profile/${member.id}`}
      className="flex items-center gap-2 py-0.5 -mx-1 px-1 rounded hover:bg-surface-alt/60 transition-colors"
      title={online ? `${member.display_name} · online` : `${member.display_name} · offline`}
    >
      <span className="relative shrink-0">
        <MemberAvatar member={member} size="xs" />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-surface ${
            online ? 'bg-emerald-400' : 'bg-text-light/40'
          }`}
          aria-hidden="true"
        />
      </span>
      <span className="text-[11px] text-text-muted truncate">{member.display_name}</span>
    </a>
  )
}
