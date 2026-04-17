import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dev-placeholder'

if (!import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== 'true' && (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in values.'
  )
}

/**
 * Explicit client options tuned for production stability.
 *
 *   - persistSession + autoRefreshToken keep users signed in across
 *     refreshes without requiring them to re-authenticate.
 *   - detectSessionInUrl is critical for password recovery — it's how
 *     supabase-js picks up the recovery token from the email-link URL.
 *   - flowType 'pkce' is the more secure, recommended auth flow
 *     (standard for single-page apps).
 *
 * Supabase JS uses `navigator.locks` to coordinate token refreshes
 * across tabs. That lock occasionally releases mid-refresh and surfaces
 * as: "Lock 'lock:sb-…-auth-token' was released because another request
 * stole it." — a transient, retry-safe error. We handle it per-query
 * in `withSupabaseRetry` below instead of letting it hit the UI.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

/**
 * Run an async supabase operation with silent retries on transient,
 * known-recoverable errors (auth token lock contention, network
 * glitches). Errors that persist after all retries propagate.
 *
 * Use this around supabase reads that are worth retrying; avoid it on
 * write/mutation paths where a retry could duplicate a change.
 *
 * Example:
 *   const rows = await withSupabaseRetry(async () => {
 *     const { data, error } = await supabase.from('intern_users').select('*')
 *     if (error) throw error
 *     return data ?? []
 *   })
 */
export async function withSupabaseRetry<T>(
  fn: () => Promise<T>,
  {
    maxAttempts = 3,
    initialDelayMs = 200,
  }: { maxAttempts?: number; initialDelayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown
  let delay = initialDelayMs
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isTransientSupabaseError(err) || attempt === maxAttempts) throw err
      await new Promise((r) => setTimeout(r, delay))
      delay *= 2 // exponential backoff
    }
  }
  throw lastErr
}

/**
 * Classify a supabase/fetch error as "safe to retry silently."
 *
 * Matches:
 *   - Auth token lock contention (`Lock "lock:sb-…" was released…`)
 *   - "auth-token was released" variants
 *   - Network failures (`Failed to fetch`, `NetworkError`)
 *   - Aborts / timeouts (`AbortError`)
 *
 * Everything else (permission denied, not found, validation) bubbles up
 * so the user sees the real error and doesn't sit through retries on a
 * legitimately broken request.
 */
function isTransientSupabaseError(err: unknown): boolean {
  if (!err) return false
  const message = (() => {
    if (typeof err === 'string') return err
    if (err instanceof Error) return err.message
    if (typeof err === 'object' && err && 'message' in err) {
      const m = (err as { message?: unknown }).message
      if (typeof m === 'string') return m
    }
    return ''
  })()
  return /Lock "lock:sb-.*auth-token"|was released because another request stole it|Failed to fetch|NetworkError|AbortError|fetch failed/i.test(
    message,
  )
}
