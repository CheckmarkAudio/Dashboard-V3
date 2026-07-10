import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  getCommunicationSoundPreference,
  playCommunicationSound,
} from '../../lib/communicationSound'
import type { ChatMention, ChatReaction } from '../../lib/queries/chatInteractions'

type ChatMessageRow = {
  id: string
  channel_id: string
  sender_id: string
  sender_name: string
  content: string | null
}

type ChatChannelRow = {
  id: string
  name: string
  slug: string
  kind: string
}

type CommunicationNotice = {
  id: string
  kind: 'dm' | 'reaction' | 'mention'
  icon: string
  title: string
  body: string
  href: string
}

function messageSnippet(content: string | null | undefined): string {
  const clean = (content ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'message'
  return clean.length > 46 ? `${clean.slice(0, 43)}...` : clean
}

function channelHref(channel: ChatChannelRow, messageId?: string): string {
  const hash = messageId ? `#message-${messageId}` : ''
  if (channel.kind === 'dm' || channel.kind === 'group') {
    return `/content?dm=${channel.id}${hash}`
  }
  return `/content?channel=${encodeURIComponent(channel.slug || channel.id)}${hash}`
}

async function fetchChannel(channelId: string): Promise<ChatChannelRow | null> {
  const { data, error } = await supabase
    .from('chat_channels')
    .select('id, name, slug, kind')
    .eq('id', channelId)
    .maybeSingle()
  if (error) return null
  return data as ChatChannelRow | null
}

async function fetchMessage(messageId: string): Promise<ChatMessageRow | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, channel_id, sender_id, sender_name, content')
    .eq('id', messageId)
    .maybeSingle()
  if (error) return null
  return data as ChatMessageRow | null
}

export default function CommunicationNotifier() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [notices, setNotices] = useState<CommunicationNotice[]>([])
  const sound = getCommunicationSoundPreference(profile?.preferences)

  const dismiss = useCallback((id: string) => {
    setNotices((prev) => prev.filter((notice) => notice.id !== id))
  }, [])

  const pushNotice = useCallback(
    (notice: Omit<CommunicationNotice, 'id'>) => {
      const id = crypto.randomUUID()
      setNotices((prev) => [...prev.slice(-2), { id, ...notice }])
      playCommunicationSound(sound)
      window.setTimeout(() => dismiss(id), 5200)
    },
    [dismiss, sound],
  )

  useEffect(() => {
    if (!profile?.id) return

    const sub = supabase
      .channel(`communication-notifier-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const message = payload.new as ChatMessageRow
          if (message.sender_id === profile.id) return
          void (async () => {
            const channel = await fetchChannel(message.channel_id)
            if (!channel || (channel.kind !== 'dm' && channel.kind !== 'group')) return
            pushNotice({
              kind: 'dm',
              icon: '💬',
              title: `${message.sender_name} sent a DM`,
              body: messageSnippet(message.content),
              href: channelHref(channel, message.id),
            })
          })()
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_message_reactions' },
        (payload) => {
          const reaction = payload.new as ChatReaction
          if (reaction.user_id === profile.id) return
          void (async () => {
            const [message, channel] = await Promise.all([
              fetchMessage(reaction.message_id),
              fetchChannel(reaction.channel_id),
            ])
            if (!channel) return
            pushNotice({
              kind: 'reaction',
              icon: reaction.emoji,
              title: `${reaction.user_name} reacted`,
              body: messageSnippet(message?.content),
              href: channelHref(channel, reaction.message_id),
            })
          })()
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_message_mentions' },
        (payload) => {
          const mention = payload.new as ChatMention
          if (mention.mentioned_user_id !== profile.id || mention.mentioned_by === profile.id) return
          void (async () => {
            const [message, channel] = await Promise.all([
              fetchMessage(mention.message_id),
              fetchChannel(mention.channel_id),
            ])
            if (!channel) return
            pushNotice({
              kind: 'mention',
              icon: '@',
              title: `${mention.mentioned_by_name} pinged you`,
              body: messageSnippet(message?.content),
              href: channelHref(channel, mention.message_id),
            })
          })()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(sub)
    }
  }, [profile?.id, pushNotice])

  if (notices.length === 0) return null

  return (
    <div className="fixed right-4 top-24 z-[70] flex w-[300px] max-w-[calc(100vw-2rem)] flex-col gap-2 pointer-events-none">
      {notices.map((notice) => (
        <button
          key={notice.id}
          type="button"
          onClick={() => {
            dismiss(notice.id)
            navigate(notice.href)
          }}
          className="pointer-events-auto group flex items-center gap-3 rounded-2xl border border-border bg-surface/96 px-3 py-2.5 text-left shadow-xl backdrop-blur-md animate-slide-up hover:border-gold/35 hover:bg-surface-hover transition-colors focus-ring"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/12 border border-gold/25 text-lg font-black text-gold">
            {notice.icon === '@' ? <MessageSquare size={16} aria-hidden="true" /> : notice.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-text truncate">{notice.title}</span>
            <span className="block text-[11px] text-text-muted truncate">{notice.body}</span>
          </span>
          <span
            role="button"
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation()
              dismiss(notice.id)
            }}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-light opacity-0 group-hover:opacity-100 hover:text-text hover:bg-surface transition-all"
            aria-label="Dismiss communication notification"
          >
            <X size={12} aria-hidden="true" />
          </span>
        </button>
      ))}
    </div>
  )
}
