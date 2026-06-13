// useChannelChat — load + realtime + optimistic send for a single chat
// channel. Powers the floating dock windows. Supports text + media
// attachments (same `chat_messages.attachments` jsonb + forum upload path
// the Forum pane uses). Works for any channel the caller can read — RLS
// gates DM/group access server-side.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { ChatAttachment } from '../../lib/forum/attachments'

export type ChatMessage = {
  id: string
  channel_id: string
  sender_id: string
  sender_name: string
  sender_initial: string
  content: string
  created_at: string
  attachments?: ChatAttachment[] | null
  /** Client-only optimistic state; never round-trips to the DB. */
  _status?: 'sending' | 'failed'
}

const COLS = 'id, channel_id, sender_id, sender_name, sender_initial, content, created_at, attachments'

export function useChannelChat(channelId: string | null) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)

  // Initial load whenever the channel changes.
  useEffect(() => {
    if (!channelId) {
      setMessages([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select(COLS)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
      if (!cancelled) {
        setMessages((data ?? []) as ChatMessage[])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [channelId])

  // Realtime: INSERT / UPDATE / DELETE, mirroring the Forum pane.
  useEffect(() => {
    if (!channelId) return
    const sub = supabase
      .channel(`dock-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const incoming = payload.new as ChatMessage
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]))
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const updated = payload.new as ChatMessage
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const oldId = (payload.old as { id?: string }).id
          if (oldId) setMessages((prev) => prev.filter((m) => m.id !== oldId))
        },
      )
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  }, [channelId])

  const deleteMessage = useCallback(
    async (id: string) => {
      // Optimistic: remove immediately so the UI feels instant.
      setMessages((prev) => prev.filter((m) => m.id !== id))
      await supabase.from('chat_messages').delete().eq('id', id)
      // Realtime DELETE event will also fire but deduplication is harmless.
    },
    [],
  )

  const editMessage = useCallback(
    async (id: string, newContent: string) => {
      const trimmed = newContent.trim()
      if (!trimmed) return
      // Optimistic update.
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: trimmed } : m)),
      )
      await supabase
        .from('chat_messages')
        .update({ content: trimmed })
        .eq('id', id)
      // Realtime UPDATE event reconciles any drift.
    },
    [],
  )

  const send = useCallback(
    async (text: string, attachments: ChatAttachment[] = []) => {
      const trimmed = text.trim()
      // Allow attachment-only messages (e.g. just an image, no caption).
      if ((!trimmed && attachments.length === 0) || !channelId || !profile) return
      const name = profile.display_name ?? 'User'
      const userId = profile.id
      const initial = name.charAt(0).toUpperCase()
      const pendingId = crypto.randomUUID()
      const optimistic: ChatMessage = {
        id: pendingId,
        channel_id: channelId,
        sender_id: userId,
        sender_name: name,
        sender_initial: initial,
        content: trimmed,
        created_at: new Date().toISOString(),
        attachments,
        _status: 'sending',
      }
      setMessages((prev) => [...prev, optimistic])
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({ channel_id: channelId, sender_id: userId, sender_name: name, sender_initial: initial, content: trimmed, attachments })
          .select(COLS)
          .single()
        if (error || !data) throw error ?? new Error('send failed')
        // Swap optimistic → real; realtime echo dedupes by id.
        setMessages((prev) => prev.map((m) => (m.id === pendingId ? (data as ChatMessage) : m)))
      } catch {
        setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, _status: 'failed' } : m)))
      }
    },
    [channelId, profile],
  )

  return { messages, loading, send, deleteMessage, editMessage }
}
