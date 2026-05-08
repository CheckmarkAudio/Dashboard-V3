import { supabase } from './supabase'

export interface GoogleCalendarConnectionStatus {
  google_email: string
  calendar_id: string
  created_at: string
  updated_at: string
  last_sync_error: string | null
  inbound_last_synced_at?: string | null
  inbound_last_sync_error?: string | null
  inbound_last_sync_summary?: {
    processed_count?: number
    updated_count?: number
    cancelled_count?: number
    unchanged_count?: number
    skipped_count?: number
  } | null
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function fetchGoogleCalendarStatus(): Promise<{
  connected: boolean
  connection: GoogleCalendarConnectionStatus | null
}> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    connected: boolean
    connection: GoogleCalendarConnectionStatus | null
    error?: string
  }>('google-calendar-auth', {
    body: { action: 'status' },
  })

  if (error || !data?.ok) {
    throw new Error(data?.error || error?.message || 'Failed to load Google Calendar status')
  }

  return {
    connected: data.connected,
    connection: data.connection,
  }
}

export async function startGoogleCalendarConnect(redirectTo: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    auth_url?: string
    error?: string
  }>('google-calendar-auth', {
    body: { action: 'start', redirect_to: redirectTo },
  })

  if (error || !data?.ok || !data.auth_url) {
    throw new Error(data?.error || error?.message || 'Failed to start Google Calendar connection')
  }

  return data.auth_url
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    error?: string
  }>('google-calendar-auth', {
    body: { action: 'disconnect' },
  })

  if (error || !data?.ok) {
    throw new Error(data?.error || error?.message || 'Failed to disconnect Google Calendar')
  }
}

export async function pullInboundGoogleCalendarChanges(): Promise<{
  summary: {
    processed_count: number
    updated_count: number
    cancelled_count: number
    unchanged_count: number
    skipped_count: number
  }
}> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    summary?: {
      processed_count: number
      updated_count: number
      cancelled_count: number
      unchanged_count: number
      skipped_count: number
    }
    error?: string
  }>('google-calendar-sync', {
    body: { action: 'pull_inbound_changes' },
  })

  if (error || !data?.ok || !data.summary) {
    throw new Error(data?.error || errorMessage(error, 'Failed to pull inbound Google Calendar changes'))
  }

  return { summary: data.summary }
}

export async function syncSessionToGoogleCalendar(sessionId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    error?: string
  }>('google-calendar-sync', {
    body: { action: 'upsert_session', session_id: sessionId },
  })

  if (error || !data?.ok) {
    throw new Error(data?.error || errorMessage(error, 'Failed to sync session to Google Calendar'))
  }
}

export async function deleteSessionEventFromGoogleCalendar(googleEventId: string | null | undefined): Promise<void> {
  if (!googleEventId) return

  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    error?: string
  }>('google-calendar-sync', {
    body: { action: 'delete_session_event', google_event_id: googleEventId },
  })

  if (error || !data?.ok) {
    throw new Error(data?.error || errorMessage(error, 'Failed to delete Google Calendar event'))
  }
}
