// Direct Messages data layer.
//
// A DM is a *private channel* (chat_channels.kind in 'dm' | 'group') — see
// migration 20260530120000_dm_channels.sql. This module wraps the server
// RPCs that create/list DM threads and reuses the existing chat read-
// tracking (mark_channel_read) so unread badges work the same as the forum.
//
// Display label rules (the stored channel `name`/`slug` are opaque unique
// tokens, so labels are always derived here):
//   • dm    → the other participant's display name
//   • group → the optional title (chat_channels.description), else a
//             comma-joined list of the other members' names

import { supabase } from '../supabase'

export type DmMember = {
  id: string
  display_name: string
  avatar_url: string | null
}

export type DmThread = {
  channel_id: string
  kind: 'dm' | 'group'
  /** Group title (chat_channels.description). Null for 1:1 DMs / untitled groups. */
  title: string | null
  /** The OTHER members (caller excluded), for label + avatars. */
  members: DmMember[]
  unread_count: number
  latest_id: string | null
  latest_content: string | null
  latest_sender: string | null
  latest_created_at: string | null
  last_read_at: string | null
}

export const dmKeys = {
  all: ['dm-threads'] as const,
  list: () => [...dmKeys.all, 'list'] as const,
}

/** All private threads the caller belongs to, newest activity first. */
export async function fetchDmThreads(): Promise<DmThread[]> {
  const { data, error } = await supabase.rpc('get_dm_threads')
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    channel_id: row.channel_id as string,
    kind: row.kind as 'dm' | 'group',
    title: (row.title as string | null) ?? null,
    members: Array.isArray(row.members) ? (row.members as DmMember[]) : [],
    unread_count: (row.unread_count as number) ?? 0,
    latest_id: (row.latest_id as string | null) ?? null,
    latest_content: (row.latest_content as string | null) ?? null,
    latest_sender: (row.latest_sender as string | null) ?? null,
    latest_created_at: (row.latest_created_at as string | null) ?? null,
    last_read_at: (row.last_read_at as string | null) ?? null,
  }))
}

/**
 * Open (or create) a 1:1 DM with another member. Idempotent server-side —
 * returns the existing two-person channel if one already exists.
 */
export async function findOrCreateDm(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('find_or_create_dm', { p_other: otherUserId })
  if (error) throw error
  return data as string
}

/** Create a new group thread with the given members (caller is auto-added). */
export async function createGroupDm(memberIds: string[], title?: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('create_group_dm', {
    p_members: memberIds,
    p_title: title ?? null,
  })
  if (error) throw error
  return data as string
}

/** Mark a thread read for the caller (reuses the shared chat read-tracking). */
export async function markDmRead(channelId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_channel_read', { p_channel_id: channelId })
  if (error) throw error
}

/**
 * Human label for a thread. Self is already excluded server-side, so this
 * works off `members` directly.
 */
export function dmThreadLabel(thread: Pick<DmThread, 'kind' | 'title' | 'members'>): string {
  if (thread.kind === 'group') {
    if (thread.title && thread.title.trim()) return thread.title.trim()
    const names = thread.members.map((m) => m.display_name.split(' ')[0])
    if (names.length === 0) return 'Group'
    if (names.length <= 3) return names.join(', ')
    return `${names.slice(0, 3).join(', ')} +${names.length - 3}`
  }
  return thread.members[0]?.display_name ?? 'Direct message'
}
