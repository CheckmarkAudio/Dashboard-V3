import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'

/**
 * NotificationsPostActions — shared "Post" quick-action button that
 * sits above the NotificationsPanel on both the member Overview widget
 * and the admin Hub widget. Both widgets render the same
 * `<NotificationsPanel />` body; this component owns the Post action.
 *
 * **Post** opens a "Post to Forum" modal (channel picker + message
 * textarea); inserts a row into `chat_messages`. Anyone signed in can
 * post; Forum policies gate per-channel write access at the DB.
 *
 * The earlier "Channel" (create-channel) button was removed in PR #68
 * revision — channel creation belongs on the dedicated Forum page, not
 * the dashboard widgets.
 *
 * Channel list comes from the same `['overview-notifications']` cache
 * key that NotificationsPanel uses, so the two queries dedupe — no
 * extra network round trip.
 */

type ChannelRow = {
  channel_id: string
  channel_name: string
  channel_slug: string
}

async function fetchChannelsForPicker(): Promise<ChannelRow[]> {
  const { data, error } = await supabase.rpc('get_channel_notifications')
  if (error) throw error
  return (data ?? []) as ChannelRow[]
}

export default function NotificationsPostActions() {
  const [postOpen, setPostOpen] = useState(false)

  // Same cache key the panel uses → React Query dedupes.
  const { data: channels = [], refetch } = useQuery({
    queryKey: ['overview-notifications'],
    queryFn: fetchChannelsForPicker,
    refetchInterval: 60_000,
  })

  return (
    <>
      <div className="mb-2 shrink-0">
        <button
          type="button"
          onClick={() => setPostOpen(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-gold/15 text-gold ring-1 ring-gold/30 text-[11px] font-bold hover:bg-gold/25 transition-colors focus-ring"
        >
          <Send size={12} aria-hidden="true" /> Post
        </button>
      </div>

      {postOpen && (
        <PostToChannelModal
          channels={channels}
          onClose={() => { setPostOpen(false); void refetch() }}
        />
      )}
    </>
  )
}

function PostToChannelModal({
  channels,
  onClose,
}: {
  channels: ChannelRow[]
  onClose: () => void
}) {
  const { toast } = useToast()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [channelId, setChannelId] = useState(channels[0]?.channel_id ?? '')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!channelId || !content.trim()) return
    setSaving(true)
    try {
      const name = profile?.display_name ?? 'Admin'
      const { error } = await supabase.from('chat_messages').insert({
        channel_id: channelId,
        sender_name: name,
        sender_id: profile?.id ?? 'admin',
        sender_initial: name.charAt(0).toUpperCase(),
        content: content.trim(),
      })
      if (error) throw error
      toast('Posted', 'success')
      // Mark this channel read for the sender so their own message
      // doesn't bump their unread badge. Same fix as the inline-reply
      // path in NotificationsPanel. Errors here are non-fatal — the
      // post already succeeded.
      try {
        await supabase.rpc('mark_channel_read', { p_channel_id: channelId })
      } catch { /* noop */ }
      void queryClient.invalidateQueries({ queryKey: ['overview-notifications'] })
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Post failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-text">Post to Forum</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover" aria-label="Close">
            <X size={16} className="text-text-light" />
          </button>
        </div>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Channel</span>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          >
            {channels.map((c) => (
              <option key={c.channel_id} value={c.channel_id}>#{c.channel_name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Message</span>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want the team to know?"
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-text-light hover:text-text">Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={!channelId || !content.trim() || saving}
            className="px-4 py-2 rounded-lg bg-gold text-black text-sm font-bold disabled:opacity-50 hover:bg-gold-muted inline-flex items-center gap-1.5"
          >
            <Send size={13} /> {saving ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
