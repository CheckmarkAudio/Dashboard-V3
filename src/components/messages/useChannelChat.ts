// useChannelChat — minimal load + realtime + optimistic send for a single
// chat channel. Powers the floating dock windows (text-only for v1; the
// full Forum pane keeps attachments / unfurl / edit-delete). Works for any
// channel the caller can read — RLS gates DM/group access server-side.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export type ChatMessage = {
  id: string
  channel_id: string
  sender_id: string
  sender_name: string
  sender_initial: string
  content: string
  created_at: string
  /** Client-only optimistic state; never round-trips to the DB. */
  _status?: 'sending' | 'failed'
}

const COLS = 'id, channel_id, sender_id, sender_name, sender_initial, content, created_at'

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

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || !channelId || !profile) return
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
        _status: 'sending',
      }
      setMessages((prev) => [...prev, optimistic])
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({ channel_id: channelId, sender_id: userId, sender_name: name, sender_initial: initial, content: trimmed })
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

  return { messages, loading, send }
}
