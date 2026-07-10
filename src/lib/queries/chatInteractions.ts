import { supabase } from '../supabase'
import type { TeamMember } from '../../types'

export type ChatReaction = {
  id: string
  message_id: string
  channel_id: string
  user_id: string
  user_name: string
  emoji: string
  created_at: string
}

export type ChatMention = {
  id: string
  message_id: string
  channel_id: string
  mentioned_user_id: string
  mentioned_by: string
  mentioned_by_name: string
  token: string
  created_at: string
}

export type ReactionSummary = {
  emoji: string
  count: number
  mine: boolean
  names: string[]
}

export const QUICK_REACTIONS = ['👍', '❤️', '✅', '😂', '👀'] as const

export function mentionToken(member: Pick<TeamMember, 'display_name'>): string {
  return `@${member.display_name}`
}

export function extractMentionedMemberIds(content: string, members: Pick<TeamMember, 'id' | 'display_name'>[]): string[] {
  const ids = new Set<string>()
  for (const member of members) {
    const name = member.display_name.trim()
    if (!name) continue
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const bracketed = new RegExp(`@\\[\\s*${escapedName}\\s*\\]`, 'i')
    const plain = new RegExp(`(^|\\s)@${escapedName}(?=\\s|$|[.,!?;:])`, 'i')
    if (bracketed.test(content) || plain.test(content)) {
      ids.add(member.id)
    }
  }
  return [...ids]
}

export function summarizeReactions(reactions: ChatReaction[], currentUserId?: string | null): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary>()
  for (const reaction of reactions) {
    const existing = byEmoji.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      mine: false,
      names: [],
    }
    existing.count += 1
    existing.mine = existing.mine || reaction.user_id === currentUserId
    if (!existing.names.includes(reaction.user_name)) existing.names.push(reaction.user_name)
    byEmoji.set(reaction.emoji, existing)
  }
  return [...byEmoji.values()].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
}

export async function fetchChatReactions(messageIds: string[]): Promise<ChatReaction[]> {
  if (messageIds.length === 0) return []
  const { data, error } = await supabase
    .from('chat_message_reactions')
    .select('id, message_id, channel_id, user_id, user_name, emoji, created_at')
    .in('message_id', messageIds)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ChatReaction[]
}

export async function toggleChatReaction(input: {
  messageId: string
  channelId: string
  emoji: string
  userId: string
  userName: string
  existingMine?: boolean
}): Promise<void> {
  if (input.existingMine) {
    const { error } = await supabase
      .from('chat_message_reactions')
      .delete()
      .eq('message_id', input.messageId)
      .eq('user_id', input.userId)
      .eq('emoji', input.emoji)
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('chat_message_reactions')
    .insert({
      message_id: input.messageId,
      channel_id: input.channelId,
      user_id: input.userId,
      user_name: input.userName,
      emoji: input.emoji,
    })
  if (error) throw error
}

export async function addChatMessageMentions(messageId: string, mentionedUserIds: string[]): Promise<number> {
  if (mentionedUserIds.length === 0) return 0
  const { data, error } = await supabase.rpc('add_chat_message_mentions', {
    p_message_id: messageId,
    p_mentioned_user_ids: mentionedUserIds,
  })
  if (error) throw error
  return (data as number | null) ?? 0
}
