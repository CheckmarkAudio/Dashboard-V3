// Add Media page — `/add-media`
//
// User ask (2026-05-14): "make a folder that you can drag in photos and
// have it go straight to [Google Drive] ... per-member folder ... the
// submission history should be viewable."
//
// Drop files into the dropzone → POSTed one at a time to the
// `upload-to-drive` edge function → land in `/Checkmark Media/<member
// name>/<timestamp>_<filename>` on the owner's Drive. The submission
// history below the dropzone reads from `media_submissions`, scoped by
// RLS so each member sees their own (admins see everyone's).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileUp,
  FolderOpen,
  ImageIcon,
  Inbox,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { Badge, PageHeader } from '../components/ui'
import { uploadFileToDropbox, UploadCancelledError } from '../lib/dropboxUpload'

// 2026-05-14 pivoted from Drive → Dropbox after Google killed
// service-account quotas on personal accounts. The env var name is
// vendor-neutral so a future swap doesn't require touching the page.
const PARENT_FOLDER_LINK_KEY = 'VITE_MEDIA_PARENT_FOLDER_LINK'
const PARENT_FOLDER_LINK = (import.meta.env[PARENT_FOLDER_LINK_KEY] as string | undefined) ?? null

// 2026-05-20 — 10GB cap. Matches Dropbox's mobile-app ceiling, which
// is a sensible upper bound for browser-based uploads (matches the
// memory + interruption tolerance of a real-world web session).
// Achieved via chunked upload sessions — the browser streams 32MB
// chunks directly to Dropbox content endpoints using a short-lived
// access token. No data passes through our edge function. For files
// bigger than 10GB, the right answer is Dropbox desktop sync.
const MAX_FILE_BYTES = 10 * 1024 * 1024 * 1024
const MAX_FILE_LABEL = '10GB'

interface MediaSubmissionRow {
  id: string
  member_id: string
  drive_file_id: string
  drive_view_url: string | null
  original_filename: string
  stored_filename: string
  size_bytes: number
  content_type: string | null
  created_at: string
  // 2026-05-26 — joined from team_members so each row shows who
  // submitted it. Page is now a shared team library (per Bridget's
  // direction), not a private per-member feed.
  submitter?: { display_name: string | null } | null
}

// Image extensions used as a fallback when content_type is null on
// legacy rows. Matches the set served by Dropbox raw URLs without
// transcoding.
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'heic', 'heif', 'tiff', 'tif', 'bmp']

function isImageRow(row: MediaSubmissionRow): boolean {
  if (row.content_type?.startsWith('image/')) return true
  const ext = row.original_filename.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTS.includes(ext)
}

/**
 * Turn a Dropbox share URL (`?dl=0`) into a hot-linkable form so an
 * `<img src=...>` can stream pixels straight from Dropbox's CDN. The
 * same trick the forum-media edge function uses for video/audio.
 */
function toRawDropboxUrl(shareUrl: string): string {
  try {
    const u = new URL(shareUrl)
    u.searchParams.delete('dl')
    u.searchParams.set('raw', '1')
    return u.toString()
  } catch {
    return shareUrl
  }
}

/**
 * Fetch a properly-sized JPEG thumbnail from Dropbox via our edge
 * function. Returns a `data:` URL ready to use as `<img src=…>`.
 *
 * Why: row thumbnails are 48px squares, but the raw share URL gives
 * the full original file (the biggest entry in current data is ~14
 * MB). At 18 rows that's ~36 MB downloaded per page-open just to
 * downsize in CSS. Dropbox's `files/get_thumbnail_v2` returns a
 * ~20 KB JPEG at w256h256, so this drops thumbnail bandwidth ~100×.
 *
 * staleTime: Infinity — file contents don't change once uploaded.
 * retry: 1 — single transient retry; row falls back to icon either
 * way if it stays broken.
 * The edge function returns `{ ok: false, error: 'not_thumbnailable' }`
 * at HTTP 200 when Dropbox can't render a preview (rare for the
 * supported MIMEs but possible for unusual encodings), so the hook
 * returns null rather than throwing.
 */
function useDropboxThumbnail(fileId: string | null | undefined): string | null {
  const { data } = useQuery({
    queryKey: ['dropbox-thumb', fileId] as const,
    enabled: Boolean(fileId),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean
        b64?: string
        mime?: string
        error?: string
      }>('upload-to-dropbox', {
        body: { action: 'thumbnail', file_id: fileId },
      })
      if (error) throw new Error(error.message)
      if (!data?.ok || !data.b64) return null
      return `data:${data.mime ?? 'image/jpeg'};base64,${data.b64}`
    },
  })
  return data ?? null
}

interface PendingUpload {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
  /** Bytes uploaded so far (only meaningful while status='uploading' or 'done'). */
  progressBytes?: number
  /** Abort controller for cancelling an in-flight upload. */
  controller?: AbortController
}

export default function AddMedia() {
  useDocumentTitle('Media - Checkmark Workspace')
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const [dragOver, setDragOver] = useState(false)
  const [pending, setPending] = useState<PendingUpload[]>([])

  const memberId = profile?.id
  const memberName = profile?.display_name ?? 'Member'

  // ─── Submission history ───────────────────────────────────────
  // 2026-05-26 — Page is now a shared team library: anyone signed in
  // sees every submission, with the submitter's name on each row.
  // RLS (migration 20260526120000) gates this to authenticated team
  // members only; anonymous JWTs still get nothing.
  const historyKey = useMemo(() => ['media-submissions', 'team'] as const, [])
  const history = useQuery({
    queryKey: historyKey,
    enabled: Boolean(memberId),
    queryFn: async (): Promise<MediaSubmissionRow[]> => {
      const { data, error } = await supabase
        .from('media_submissions')
        .select('*, submitter:team_members!media_submissions_member_id_fkey(display_name)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as MediaSubmissionRow[]
    },
    staleTime: 30_000,
  })

  // 2026-05-26 — Lightbox for clicked image previews. Single state
  // is enough — only one image is "zoomed" at a time.
  const [lightbox, setLightbox] = useState<MediaSubmissionRow | null>(null)
  // Close on Escape so the modal feels native.
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  // ─── Upload pipeline ──────────────────────────────────────────
  const enqueueFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files)
      if (list.length === 0) return

      const next: PendingUpload[] = []
      for (const file of list) {
        const id = `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`
        if (file.size > MAX_FILE_BYTES) {
          next.push({
            id,
            file,
            status: 'error',
            error: `File too large (${formatBytes(file.size)}). Cap is ${MAX_FILE_LABEL}.`,
          })
        } else if (file.size === 0) {
          next.push({ id, file, status: 'error', error: 'File is empty.' })
        } else {
          next.push({ id, file, status: 'queued' })
        }
      }
      setPending((prev) => [...prev, ...next])
    },
    [],
  )

  // Process the queue serially — one file at a time keeps the UI
  // progress bar focused on a single number and prevents the user's
  // upstream bandwidth from being split across simultaneous uploads.
  //
  // ⚠️ Bug fix 2026-05-14 (kept): previously this used a `cancelled`
  // flag in an effect that re-ran every time `pending` changed. The
  // setPending(...uploading...) call inside the effect mutated
  // `pending`, retriggering the effect, which fired the cleanup and
  // flipped `cancelled = true` BEFORE the response landed. Net result:
  // the row stayed at "Uploading…" forever. Now gated via a ref so
  // each in-flight upload owns its own state lifetime.
  //
  // 2026-05-20 — Rewritten to use uploadFileToDropbox (chunked
  // sessions, direct browser→Dropbox). The old multipart-form-POST-
  // through-edge-function path is gone — see src/lib/dropboxUpload.ts.
  const inFlightRef = useRef(false)
  useEffect(() => {
    if (inFlightRef.current) return
    const next = pending.find((p) => p.status === 'queued')
    if (!next) return

    inFlightRef.current = true
    const controller = new AbortController()

    const run = async () => {
      setPending((prev) =>
        prev.map((p) =>
          p.id === next.id ? { ...p, status: 'uploading', progressBytes: 0, controller } : p,
        ),
      )

      try {
        const submission = await uploadFileToDropbox(next.file, {
          signal: controller.signal,
          onProgress: (bytes) => {
            setPending((prev) =>
              prev.map((p) =>
                p.id === next.id ? { ...p, progressBytes: bytes } : p,
              ),
            )
          },
        })

        setPending((prev) =>
          prev.map((p) =>
            p.id === next.id
              ? { ...p, status: 'done', progressBytes: next.file.size, controller: undefined }
              : p,
          ),
        )
        // Fold the new submission into the history cache so the row
        // appears instantly without waiting for refetch.
        queryClient.setQueryData<MediaSubmissionRow[]>(historyKey, (prev) => {
          const existing = prev ?? []
          return [submission as MediaSubmissionRow, ...existing]
        })
      } catch (err) {
        // User-cancelled uploads vanish from the queue; everything
        // else surfaces as an error row the user can retry by re-
        // dropping the file.
        if (err instanceof UploadCancelledError) {
          setPending((prev) => prev.filter((p) => p.id !== next.id))
        } else {
          const msg = err instanceof Error ? err.message : 'Upload failed'
          setPending((prev) =>
            prev.map((p) =>
              p.id === next.id
                ? { ...p, status: 'error', error: msg, controller: undefined }
                : p,
            ),
          )
        }
      } finally {
        inFlightRef.current = false
      }
    }

    void run()
  }, [pending, historyKey, queryClient])

  const clearDone = () => setPending((prev) => prev.filter((p) => p.status !== 'done'))
  const dismiss = (id: string) =>
    setPending((prev) => {
      const row = prev.find((p) => p.id === id)
      row?.controller?.abort()
      return prev.filter((p) => p.id !== id)
    })

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer?.files) enqueueFiles(e.dataTransfer.files)
    },
    [enqueueFiles],
  )

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) enqueueFiles(e.target.files)
      e.target.value = ''
    },
    [enqueueFiles],
  )

  return (
    <div className="max-w-[1100px] mx-auto space-y-6 animate-fade-in">
      <PageHeader
        icon={FolderOpen}
        title="Media"
        actions={
          PARENT_FOLDER_LINK ? (
            <a
              href={PARENT_FOLDER_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-surface-alt text-text border border-border hover:border-border-light hover:text-gold transition-colors text-[13px] font-semibold"
            >
              <FolderOpen size={14} aria-hidden="true" />
              Browse all submissions
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : null
        }
      />

      {/* ─── Dropzone ───────────────────────────────────────── */}
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'block rounded-2xl border-2 border-dashed transition-all duration-150 cursor-pointer',
          dragOver
            ? 'border-gold bg-gold/10'
            : 'border-border bg-surface-alt/40 hover:border-border-light hover:bg-surface-alt/60',
        ].join(' ')}
      >
        <input
          type="file"
          multiple
          onChange={onPick}
          className="sr-only"
          aria-label="Choose files to upload"
        />
        <div className="px-6 py-12 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gold/15 ring-1 ring-gold/30 text-gold flex items-center justify-center">
            <UploadCloud size={26} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-text">
              Drop media here, or click to choose
            </p>
            <p className="text-[12px] text-text-muted mt-1">
              Files go to <span className="font-semibold text-text">Checkmark Media Drop › {memberName}</span> · cap {MAX_FILE_LABEL} per file
            </p>
          </div>
        </div>
      </label>

      {/* ─── Pending uploads ────────────────────────────────── */}
      {pending.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface-alt/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-text-light">
              This batch
            </p>
            {pending.some((p) => p.status === 'done') && (
              <button
                type="button"
                onClick={clearDone}
                className="text-[11px] font-semibold text-text-muted hover:text-gold transition-colors"
              >
                Clear completed
              </button>
            )}
          </div>
          <ul className="divide-y divide-theme">
            {pending.map((p) => {
              const pct =
                p.status === 'uploading' && p.progressBytes !== undefined && p.file.size > 0
                  ? Math.min(100, Math.round((p.progressBytes / p.file.size) * 100))
                  : p.status === 'done'
                    ? 100
                    : 0
              const uploadedBytes = p.progressBytes ?? 0
              return (
                <li key={p.id} className="px-4 py-2.5 flex items-center gap-2.5">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-surface ring-1 ring-border flex items-center justify-center">
                    {p.status === 'uploading' ? (
                      <Loader2 size={13} className="animate-spin text-gold" aria-hidden="true" />
                    ) : p.status === 'done' ? (
                      <CheckCircle2 size={13} className="text-emerald-300" aria-hidden="true" />
                    ) : p.status === 'error' ? (
                      <AlertCircle size={13} className="text-rose-300" aria-hidden="true" />
                    ) : (
                      <FileUp size={13} className="text-text-light" aria-hidden="true" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-text truncate">
                      {p.file.name}
                    </p>
                    <p className="text-[11px] text-text-light truncate mt-0.5">
                      {p.status === 'queued' && `Queued · ${formatBytes(p.file.size)}`}
                      {p.status === 'uploading' && (
                        <>
                          Uploading · {formatBytes(uploadedBytes)} / {formatBytes(p.file.size)}
                          {' · '}
                          {pct}%
                        </>
                      )}
                      {p.status === 'done' && `Uploaded · ${formatBytes(p.file.size)}`}
                      {p.status === 'error' && (p.error ?? 'Upload failed')}
                    </p>
                    {/* Progress bar — only meaningful for active +
                        completed uploads; queued shows nothing, error
                        leaves the row at whatever it reached. */}
                    {(p.status === 'uploading' || p.status === 'done') && (
                      <div
                        className="mt-1.5 h-1 w-full rounded-full bg-surface-alt overflow-hidden"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={`h-full transition-all duration-200 ease-out ${
                            p.status === 'done' ? 'bg-emerald-500' : 'bg-gold'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {/* During upload, X cancels via AbortController.
                      After done/error, X just dismisses the row. */}
                  {(p.status === 'done' || p.status === 'error' || p.status === 'uploading') && (
                    <button
                      type="button"
                      onClick={() => dismiss(p.id)}
                      aria-label={p.status === 'uploading' ? `Cancel ${p.file.name}` : `Dismiss ${p.file.name}`}
                      title={p.status === 'uploading' ? 'Cancel upload' : 'Dismiss'}
                      className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-text-light hover:text-text hover:bg-surface-hover transition-colors focus-ring"
                    >
                      <X size={13} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ─── Team submissions ───────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface-alt/40 overflow-hidden">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-text">Team submissions</h2>
          {history.data && history.data.length > 0 && (
            <Badge variant="neutral" size="sm">
              {history.data.length}
            </Badge>
          )}
        </header>

        {history.error ? (
          <div className="px-4 py-6 text-[12px] text-rose-300">
            Failed to load history. {history.error instanceof Error ? history.error.message : ''}
          </div>
        ) : history.isLoading ? (
          <div className="px-4 py-10 flex items-center justify-center text-text-light">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          </div>
        ) : (history.data?.length ?? 0) === 0 ? (
          <div className="px-4 py-10 flex flex-col items-center text-center text-text-light">
            <Inbox size={20} className="mb-1.5" aria-hidden="true" />
            <p className="text-[12px] italic">No submissions yet — drop something above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-theme max-h-[560px] overflow-y-auto">
            {history.data!.map((row) => (
              <MediaRow key={row.id} row={row} onPreview={setLightbox} />
            ))}
          </ul>
        )}
      </section>

      {/* ─── Lightbox overlay ──────────────────────────────────
         Triggered by clicking an image thumbnail. Image bytes are
         streamed directly from Dropbox via the raw URL form. Background
         scrim closes; the image itself doesn't, so the user can pinch-
         zoom or right-click → save without accidental dismissal. */}
      {lightbox && lightbox.drive_view_url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${lightbox.original_filename}`}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface/80 ring-1 ring-border text-text hover:text-gold transition-colors flex items-center justify-center focus-ring"
            aria-label="Close preview"
          >
            <X size={18} />
          </button>
          <figure
            onClick={(e) => e.stopPropagation()}
            className="max-w-[92vw] max-h-[88vh] flex flex-col items-center gap-3 cursor-default"
          >
            <img
              src={toRawDropboxUrl(lightbox.drive_view_url)}
              alt={lightbox.original_filename}
              className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-2xl"
            />
            <figcaption className="text-[12px] text-text-light text-center">
              <span className="font-semibold text-text">{lightbox.original_filename}</span>
              <span className="mx-1.5 text-text-muted">·</span>
              {lightbox.submitter?.display_name?.trim() || 'Unknown'}
              <span className="mx-1.5 text-text-muted">·</span>
              {formatBytes(lightbox.size_bytes)}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Submission row component ─────────────────────────────────
// Split out so each row can call useDropboxThumbnail. The hook can't
// be called inside the parent's .map() callback — React only allows
// hooks at the top level of a component.

interface MediaRowProps {
  row: MediaSubmissionRow
  onPreview: (row: MediaSubmissionRow) => void
}

function MediaRow({ row, onPreview }: MediaRowProps) {
  const isImage = isImageRow(row)
  const canPreview = isImage && Boolean(row.drive_view_url)
  // Always call the hook (rules of hooks); the hook itself skips the
  // fetch when fileId is null (e.g. on the rare row where the column
  // is null) or when isImage is false.
  const thumbnailDataUrl = useDropboxThumbnail(canPreview ? row.drive_file_id : null)
  const submitterName = row.submitter?.display_name?.trim() || 'Unknown'
  const onRowActivate = canPreview ? () => onPreview(row) : undefined

  return (
    <li
      {...(onRowActivate
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: onRowActivate,
            onKeyDown: (e: React.KeyboardEvent<HTMLLIElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onRowActivate()
              }
            },
            'aria-label': `Preview ${row.original_filename}`,
          }
        : {})}
      className={`px-4 py-2.5 flex items-center gap-3 ${
        canPreview
          ? 'cursor-zoom-in hover:bg-surface-hover/60 focus-ring transition-colors'
          : ''
      }`}
    >
      {/* Thumbnail comes from Dropbox's files/get_thumbnail_v2 endpoint
          via our edge function (~20 KB JPEG, vs. multi-MB if we
          hot-linked the original). While the hook is loading we show
          the icon glyph; on permanent failure we keep the icon and
          never retry. */}
      {canPreview ? (
        thumbnailDataUrl ? (
          <span className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-surface ring-1 ring-border">
            <img
              src={thumbnailDataUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </span>
        ) : (
          <span className="shrink-0 w-12 h-12 rounded-lg bg-violet-500/15 ring-1 ring-violet-500/30 text-violet-300 flex items-center justify-center">
            <ImageIcon size={18} aria-hidden="true" />
          </span>
        )
      ) : (
        <span className="shrink-0 w-12 h-12 rounded-lg bg-violet-500/15 ring-1 ring-violet-500/30 text-violet-300 flex items-center justify-center">
          <FileUp size={18} aria-hidden="true" />
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-text truncate" title={row.original_filename}>
          {row.original_filename}
        </p>
        <p className="text-[11px] text-text-light truncate mt-0.5">
          {submitterName} · {formatBytes(row.size_bytes)} · {formatRelative(row.created_at)}
        </p>
      </div>
      {row.drive_view_url && (
        <a
          href={row.drive_view_url}
          target="_blank"
          rel="noopener noreferrer"
          // Stop propagation so clicking "Open" goes straight to
          // Dropbox without also opening the lightbox.
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-gold hover:text-gold/80 transition-colors"
        >
          Open
          <ExternalLink size={10} aria-hidden="true" />
        </a>
      )}
    </li>
  )
}
