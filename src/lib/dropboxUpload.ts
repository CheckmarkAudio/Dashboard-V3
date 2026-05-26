// 2026-05-20 — Direct browser → Dropbox chunked uploader.
//
// Used by the Media page (src/pages/AddMedia.tsx). Replaces the old
// multipart-POST-through-edge-function pattern which was capped at
// 150MB (Dropbox single-shot endpoint hard limit) and bottlenecked
// by the edge function's ~256MB memory budget.
//
// User direction: support the same single-file ceiling Dropbox.com
// itself supports (350GB web). Per Dropbox's docs, the browser-side
// path requires `upload_session/start` → N × `upload_session/append_v2`
// → `upload_session/finish`. We chunk by 32MB (8 × 4MB, the minimum
// Dropbox-required granularity), read each chunk lazily via
// `file.slice()` so the browser never holds the whole file in memory,
// and POST the chunks directly to Dropbox content endpoints using a
// short-lived access token minted by our edge function.
//
// FLOW
//   1. POST {action:'token'} to upload-to-dropbox edge function
//      → returns {access_token, expires_in}
//   2. Slice file at 32MB boundaries
//   3. Chunk 0: POST to upload_session/start with body=chunk
//      → returns {session_id}
//   4. Chunks 1..n-1: POST to upload_session/append_v2 with
//      cursor={session_id, offset} and body=chunk
//   5. Last chunk: same append_v2 as middle chunks. The finish
//      happens server-side (so the browser can't tamper with the
//      target path).
//   6. POST {action:'finalize', session_id, total_bytes,
//            original_filename, content_type} to edge function
//      → edge computes the canonical member-scoped path, calls
//        upload_session/finish, creates share link, inserts
//        media_submissions row, returns the row.
//
// PROGRESS
//   Reported as bytes-uploaded / total-bytes. Updates after each
//   chunk completes (so granularity is 32MB). Per-byte progress
//   inside a chunk would require XHR-with-progress instead of fetch
//   — overkill for this UX.

import { supabase } from './supabase'

// 32MB. Must be a multiple of 4MB per Dropbox's append_v2 contract.
// 32MB = 8 × 4MB. Larger chunks = fewer HTTP round trips but worse
// retry granularity if a single chunk fails. 32MB is a common
// sweet spot for the kind of files this app handles.
const CHUNK_SIZE = 32 * 1024 * 1024

// Number of retry attempts per chunk before bailing. A flaky chunk
// can usually retry past a transient network blip; a chunk that
// fails twice probably indicates a real problem.
const CHUNK_RETRIES = 2

export interface UploadedSubmission {
  id: string
  member_id: string
  drive_file_id: string
  drive_view_url: string | null
  original_filename: string
  stored_filename: string
  size_bytes: number
  content_type: string | null
  created_at: string
}

export interface UploadOptions {
  /** Called after every chunk completes. `bytes` is cumulative. */
  onProgress?: (bytes: number, total: number) => void
  /** Cancel an in-flight upload. The current chunk's fetch is aborted. */
  signal?: AbortSignal
}

export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled')
    this.name = 'UploadCancelledError'
  }
}

/**
 * Upload a single file to Dropbox via chunked sessions. Resolves
 * with the `media_submissions` row once the edge function commits.
 * Throws on any failure (with a descriptive message).
 */
export async function uploadFileToDropbox(
  file: File,
  opts: UploadOptions = {},
): Promise<UploadedSubmission> {
  const sessionId = await streamFileToDropboxSession(file, opts)

  // Ask the edge function to commit the session + create the share
  // link + insert the metadata row.
  const submission = await finalizeUpload({
    session_id: sessionId,
    total_bytes: file.size,
    original_filename: file.name,
    content_type: file.type || null,
  })

  return submission
}

// 2026-05-26 — Forum chat reuses the chunked-upload + commit flow but
// finalizes through a different edge action so the file lands in the
// `/forum/<channel>/<user>/...` Dropbox layout instead of the
// per-member submission folder, and no `media_submissions` row is
// inserted.
export interface ForumDropboxAttachment {
  kind: 'video' | 'audio'
  url: string
  name: string
  mime: string | null
  size: number
}

export interface UploadForumFileToDropboxOpts extends UploadOptions {
  channelId: string
  kind: 'video' | 'audio'
}

export async function uploadForumFileToDropbox(
  file: File,
  opts: UploadForumFileToDropboxOpts,
): Promise<ForumDropboxAttachment> {
  const sessionId = await streamFileToDropboxSession(file, opts)

  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    attachment?: ForumDropboxAttachment
    error?: string
  }>('upload-to-dropbox', {
    body: {
      action: 'finalize-forum',
      session_id: sessionId,
      total_bytes: file.size,
      original_filename: file.name,
      content_type: file.type || null,
      channel_id: opts.channelId,
      kind: opts.kind,
    },
  })
  if (error || !data?.ok || !data.attachment) {
    throw new Error(data?.error ?? error?.message ?? 'Failed to finalize forum upload')
  }
  return data.attachment
}

/**
 * Mint a Dropbox token + stream the file's bytes in 32 MB chunks
 * directly to Dropbox's content endpoints, returning the session id
 * the caller can pass to whichever finalize action is appropriate
 * for the destination layout (member folder vs. forum folder).
 */
async function streamFileToDropboxSession(
  file: File,
  opts: UploadOptions,
): Promise<string> {
  if (file.size === 0) throw new Error('File is empty.')

  const token = await mintDropboxToken(opts.signal)

  let sessionId: string | null = null
  let offset = 0
  const total = file.size

  while (offset < total) {
    if (opts.signal?.aborted) throw new UploadCancelledError()
    const end = Math.min(offset + CHUNK_SIZE, total)
    const chunk = file.slice(offset, end)

    if (sessionId === null) {
      sessionId = await dropboxSessionStart(token, chunk, opts.signal)
    } else {
      await dropboxSessionAppend(token, sessionId, offset, chunk, opts.signal)
    }

    offset = end
    opts.onProgress?.(offset, total)
  }

  if (sessionId === null) {
    // Shouldn't happen — we already checked file.size > 0.
    throw new Error('Upload session never opened.')
  }
  return sessionId
}

// ─── Edge function calls ────────────────────────────────────────

async function mintDropboxToken(signal?: AbortSignal): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    access_token?: string
    error?: string
  }>('upload-to-dropbox', {
    body: { action: 'token' },
  })
  if (signal?.aborted) throw new UploadCancelledError()
  if (error || !data?.ok || !data.access_token) {
    throw new Error(data?.error ?? error?.message ?? 'Failed to mint Dropbox token')
  }
  return data.access_token
}

interface FinalizePayload {
  session_id: string
  total_bytes: number
  original_filename: string
  content_type: string | null
}

async function finalizeUpload(payload: FinalizePayload): Promise<UploadedSubmission> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    submission?: UploadedSubmission
    warning?: string
    error?: string
  }>('upload-to-dropbox', {
    body: { action: 'finalize', ...payload },
  })
  if (error || !data?.ok) {
    throw new Error(data?.error ?? error?.message ?? 'Failed to finalize upload')
  }
  if (!data.submission) {
    // Upload landed but history insert failed. Surface as warning-
    // shaped error so the caller knows the file IS in Dropbox even
    // though the row is missing.
    throw new Error(data.warning ?? 'Upload finalized but history row not inserted')
  }
  return data.submission
}

// ─── Dropbox content API calls ──────────────────────────────────

async function dropboxSessionStart(
  accessToken: string,
  chunk: Blob,
  signal?: AbortSignal,
): Promise<string> {
  return await withRetries(
    async () => {
      const res = await fetch('https://content.dropboxapi.com/2/files/upload_session/start', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({ close: false }),
        },
        body: chunk,
        signal,
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Dropbox upload_session/start failed (${res.status}): ${txt}`)
      }
      const data = await res.json() as { session_id?: string }
      if (!data.session_id) throw new Error('Dropbox start did not return a session_id')
      return data.session_id
    },
    'session start',
    signal,
  )
}

async function dropboxSessionAppend(
  accessToken: string,
  sessionId: string,
  offset: number,
  chunk: Blob,
  signal?: AbortSignal,
): Promise<void> {
  await withRetries(
    async () => {
      const res = await fetch('https://content.dropboxapi.com/2/files/upload_session/append_v2', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            cursor: { session_id: sessionId, offset },
            close: false,
          }),
        },
        body: chunk,
        signal,
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Dropbox upload_session/append_v2 failed (${res.status}): ${txt}`)
      }
    },
    `append @${offset}`,
    signal,
  )
}

// ─── Retry helper ───────────────────────────────────────────────

async function withRetries<T>(
  fn: () => Promise<T>,
  label: string,
  signal?: AbortSignal,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= CHUNK_RETRIES; attempt++) {
    if (signal?.aborted) throw new UploadCancelledError()
    try {
      return await fn()
    } catch (err) {
      if (err instanceof UploadCancelledError) throw err
      // AbortError → user cancelled, don't retry
      if (err instanceof Error && err.name === 'AbortError') throw new UploadCancelledError()
      lastErr = err
      if (attempt === CHUNK_RETRIES) break
      // Small backoff between retries (250ms, 500ms)
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }
  throw lastErr instanceof Error
    ? new Error(`${label}: ${lastErr.message}`)
    : new Error(`${label}: unknown failure`)
}
