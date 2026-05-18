import { supabase } from './supabase'
import { extractEdgeFunctionError } from './edgeFunctionError'

const INBOUND_SYNC_TIMEOUT_MS = 30000

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

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
  outbound_pending_count?: number
  outbound_last_error?: string | null
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
  const { data, error } = await withTimeout(
    supabase.functions.invoke<{
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
    }),
    INBOUND_SYNC_TIMEOUT_MS,
    'Inbound Google Calendar sync took too long. Please try again after a hard refresh.',
  )

  if (error || !data?.ok || !data.summary) {
    throw new Error(data?.error || (await extractEdgeFunctionError(error, 'Failed to pull inbound Google Calendar changes')))
  }

  return { summary: data.summary }
}

export async function pushPendingGoogleCalendarBookings(): Promise<{
  summary: {
    attempted_count: number
    synced_count: number
    failed_count: number
    skipped_count: number
  }
}> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    summary?: {
      attempted_count: number
      synced_count: number
      failed_count: number
      skipped_count: number
    }
    error?: string
  }>('google-calendar-sync', {
    body: { action: 'retry_pending_sessions' },
  })

  if (error || !data?.ok || !data.summary) {
    throw new Error(data?.error || (await extractEdgeFunctionError(error, 'Failed to push pending Google Calendar bookings')))
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
    throw new Error(data?.error || (await extractEdgeFunctionError(error, 'Failed to sync session to Google Calendar')))
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
    throw new Error(data?.error || (await extractEdgeFunctionError(error, 'Failed to delete Google Calendar event')))
  }
}
