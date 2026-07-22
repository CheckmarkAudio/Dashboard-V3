import { supabase } from '../supabase'

const LOG_PREFIX = '[queries/presence]'

export interface PresenceSession {
  id: string
  member_id: string
  team_id: string
  started_at: string
  last_seen_at: string
  ended_at: string | null
  source: string
}

/** Open or extend the signed-in member's heartbeat presence session. */
export async function pingPresence(idleMinutes = 10): Promise<PresenceSession> {
  const { data, error } = await supabase.rpc('presence_ping', {
    p_idle_minutes: idleMinutes,
  })
  if (error) {
    console.error(`${LOG_PREFIX} pingPresence failed:`, error)
    throw new Error(error.message)
  }
  return data as PresenceSession
}

/** Close the signed-in member's open presence session, if one exists. */
export async function closePresence(): Promise<PresenceSession | null> {
  const { data, error } = await supabase.rpc('presence_close')
  if (error) {
    console.error(`${LOG_PREFIX} closePresence failed:`, error)
    throw new Error(error.message)
  }
  if (!data || (data as { id: string | null }).id === null) return null
  return data as PresenceSession
}
