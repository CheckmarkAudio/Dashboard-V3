// Shared helper for surfacing the real error message from a Supabase
// edge function call.
//
// `supabase.functions.invoke()` rejects with a `FunctionsHttpError`
// when the function returns a non-2xx status. The error itself just
// says "Edge Function returned a non-2xx status code" — the actual
// JSON body we returned (e.g. `{ ok: false, error: "Member not found" }`)
// is parked on `error.context` as a `Response` object.
//
// Without reading `error.context`, every edge-function 4xx surfaces in
// the UI as the same opaque message. This helper:
//   1. Tries to parse the response body as JSON
//   2. Returns the most specific human-readable string it can find
//      (matches `errorMessage()` precedence: message → error →
//      error_description)
//   3. Falls back to the raw text body, then the original error's
//      message, then the caller-supplied fallback.

import { FunctionsHttpError } from '@supabase/supabase-js'

interface ErrorBag {
  message?: unknown
  error?: unknown
  error_description?: unknown
}

/** Pick the most specific human-readable string out of any object. */
function pickReadable(bag: unknown): string | null {
  if (!bag || typeof bag !== 'object') return null
  const e = bag as ErrorBag
  if (typeof e.message === 'string' && e.message.trim()) return e.message
  if (typeof e.error === 'string' && e.error.trim()) return e.error
  if (typeof e.error_description === 'string' && e.error_description.trim())
    return e.error_description
  return null
}

/**
 * Extract the most useful error message we can from whatever
 * `supabase.functions.invoke()` returned in its `error` slot. Async
 * because `FunctionsHttpError.context` is a `Response` we have to
 * read.
 *
 * Caller-supplied `fallback` is only used when nothing readable
 * could be found — never preferred over a real message.
 */
export async function extractEdgeFunctionError(
  err: unknown,
  fallback: string,
): Promise<string> {
  if (!err) return fallback

  // FunctionsHttpError — the most common shape. `context` is a
  // Response object whose body is the JSON we returned from the
  // function (e.g. `{ ok: false, error: "Member not found" }`).
  if (err instanceof FunctionsHttpError && err.context instanceof Response) {
    // Clone before reading — Response bodies are single-use, and a
    // future caller (or a console.log on the same error) could try to
    // read it again.
    try {
      const text = await err.context.clone().text()
      if (text) {
        try {
          const json = JSON.parse(text)
          const fromJson = pickReadable(json)
          if (fromJson) return fromJson
        } catch {
          // Not JSON — fall through to returning the raw text body.
        }
        return text
      }
    } catch {
      // Body already consumed or network blip — fall through.
    }
  }

  // Plain Error / string / Supabase PostgrestError.
  if (typeof err === 'string') return err
  if (err instanceof Error && err.message) return err.message
  const fromObject = pickReadable(err)
  if (fromObject) return fromObject

  return fallback
}
