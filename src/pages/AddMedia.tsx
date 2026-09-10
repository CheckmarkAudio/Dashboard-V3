import { useFocusTrap } from '../hooks/useFocusTrap'
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
  Camera,
  Headphones,
  Video,
  FileText,
  FileArchive,
  FileSpreadsheet,
  SlidersHorizontal,
  FolderOpen,
  Inbox,
  Loader2,
  LayoutGrid,
  List,
  Search,
  UploadCloud,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { uploadFileToDropbox, UploadCancelledError } from '../lib/dropboxUpload'
import { emitFlywheelEvent } from '../lib/queries/flywheelEvents'

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
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'heic', 'heif', 'tiff', 'tif', 'bmp', 'svg', 'ico']

function isImageRow(row: MediaSubmissionRow): boolean {
  if (row.content_type?.startsWith('image/')) return true
  const ext = row.original_filename.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTS.includes(ext)
}

function getMediaKind(row: MediaSubmissionRow): string {
  if (isImageRow(row)) return 'Images'
  const ext = row.original_filename.split('.').pop()?.toLowerCase() ?? ''
  if (row.content_type?.startsWith('audio/') || ['wav', 'mp3', 'aiff', 'aif', 'flac', 'm4a', 'ogg', 'aac', 'opus', 'wma'].includes(ext)) return 'Audio'
  if (row.content_type?.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'mpeg', 'mpg'].includes(ext)) return 'Video'
  return 'Documents'
}

/**
 * Turn a Dropbox share URL (`?dl=0`) into a hot-linkable form so an
 * `<img src=...>` can stream pixels straight from Dropbox's CDN. The
 * same trick the forum-media edge function uses for video/audio.
 */
function toRawDropboxUrl(shareUrl: string): string {
  try {
    const u = new URL(shareUrl)
    if (u.hostname !== 'www.dropbox.com' && u.hostname !== 'dropbox.com') return shareUrl
    u.searchParams.delete('dl')
    u.searchParams.set('raw', '1')
    return u.toString()
  } catch {
    return shareUrl
  }
}

/** Fetch a cached, size-appropriate thumbnail through the existing authorized endpoint. */
function useDropboxThumbnail(fileId: string | null, grid: boolean) {
  const size = grid ? 'w640h480' : 'w128h128'
  return useQuery({
    queryKey: ['dropbox-thumb', fileId, size],
    enabled: Boolean(fileId),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; b64?: string; mime?: string }>('upload-to-dropbox', {
        body: { action: 'thumbnail', file_id: fileId, size },
      })
      if (error) throw new Error(error.message)
      return data?.ok && data.b64 ? `data:${data.mime ?? 'image/jpeg'};base64,${data.b64}` : null
    },
  })
}

function MediaTypeIcon({ row, size = 30 }: { row: MediaSubmissionRow; size?: number }) {
  const kind = getMediaKind(row)
  const ext = row.original_filename.split('.').pop()?.toLowerCase() ?? ''
  const Icon = kind === 'Images' ? Camera : kind === 'Audio' ? Headphones : kind === 'Video' ? Video
    : ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) ? FileArchive
    : ['xls', 'xlsx', 'csv', 'ods'].includes(ext) ? FileSpreadsheet : FileText
  return <Icon size={size} strokeWidth={1.5} />
}

function MediaArtwork({ row, grid }: { row: MediaSubmissionRow; grid: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState<string[]>([])
  const [loaded, setLoaded] = useState('')
  const kind = getMediaKind(row)
  const visual = kind === 'Images' || kind === 'Video'
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '150px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const fileId = visible && visual ? row.drive_file_id || null : null
  const thumbnail = useDropboxThumbnail(fileId, grid)
  const raw = row.drive_view_url ? toRawDropboxUrl(row.drive_view_url) : ''
  const thumb = thumbnail.data && !failed.includes(thumbnail.data) ? thumbnail.data : ''
  // Try the original only after the thumbnail is unavailable; never loop on failures.
  const original = visible && (!fileId || !thumbnail.isPending) && !thumb && !failed.includes(raw) ? raw : ''
  const imageSource = thumb || (kind === 'Images' ? original : '')
  const videoSource = kind === 'Video' && !thumb ? original : ''
  const fail = (source: string) => setFailed(previous => [...previous, source])
  return <span ref={ref} aria-hidden="true" className="media-artwork shrink-0 w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center">
    <span className="media-artwork-glyph" style={{ visibility: (imageSource && loaded === imageSource) || (videoSource && loaded === videoSource) ? 'hidden' : 'visible' }}><MediaTypeIcon row={row} size={grid ? 36 : 24} /></span>
    {imageSource && <img key={imageSource} src={imageSource} alt="" loading="lazy" decoding="async"
      className="media-photo-thumbnail" style={{ opacity: loaded === imageSource ? 1 : 0 }}
      onLoad={() => setLoaded(imageSource)} onError={() => fail(imageSource)} />}
    {videoSource && <video key={videoSource} src={videoSource} muted playsInline preload="metadata" tabIndex={-1}
      className="media-photo-thumbnail" style={{ opacity: loaded === videoSource ? 1 : 0 }}
      onLoadedData={() => setLoaded(videoSource)} onError={() => fail(videoSource)} />}
    <span className="media-extension">{row.original_filename.includes('.') ? row.original_filename.split('.').pop()?.slice(0, 7).toUpperCase() : 'FILE'}</span>
  </span>
}

function MediaPreviewContent({ row }: { row: MediaSubmissionRow }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const src = toRawDropboxUrl(row.drive_view_url!)
  const kind = getMediaKind(row)
  return <div className="media-rendered-preview">
    {(!loaded || failed || kind === 'Audio') && <div className="media-preview-fallback" role={failed ? 'status' : undefined}>
      <MediaTypeIcon row={row} size={48} />
      {failed && <span>Preview unavailable</span>}
    </div>}
    {!failed && (kind === 'Audio' ? <audio controls preload="metadata" src={src} aria-label={row.original_filename}
      onLoadedMetadata={() => setLoaded(true)} onError={() => setFailed(true)} className="w-[min(520px,80vw)]" />
      : kind === 'Video' ? <video controls playsInline preload="metadata" src={src} aria-label={row.original_filename}
        onLoadedData={() => setLoaded(true)} onError={() => setFailed(true)} className="max-w-full max-h-[74vh]" />
      : <img src={src} alt={row.original_filename} onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
          className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-2xl" />)}
  </div>
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
  return <MediaWorkspace />
}

/** Reuse the real upload queue and file previews on Overview. */
export function MediaWorkspace({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState('')
  const [mediaKind, setMediaKind] = useState('All')
  const [showFilters, setShowFilters] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)
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
  const previewRef = useRef<HTMLDivElement>(null)
  useFocusTrap(previewRef, Boolean(lightbox))
  // Close on Escape so the modal feels native.
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  const filteredMedia = (history.data ?? []).filter(row =>
    `${row.original_filename} ${row.submitter?.display_name ?? ''}`.toLowerCase().includes(filter.trim().toLowerCase()) &&
    (mediaKind === 'All' || getMediaKind(row) === mediaKind),
  )


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
        void queryClient.invalidateQueries({ queryKey: ['overview-score-media-month'] })
        // Fold the new submission into the history cache so the row
        // appears instantly without waiting for refetch.
        queryClient.setQueryData<MediaSubmissionRow[]>(historyKey, (prev) => {
          const existing = prev ?? []
          return [submission as MediaSubmissionRow, ...existing]
        })
        // Flywheel: uploading media into the Dropbox pipeline = a Workflow
        // event (getting work + assets into the system). Fire-and-forget;
        // emit failures must not regress the upload. (Publicly *featuring*
        // a sample for marketing is a Discovery-tagged task instead.)
        void emitFlywheelEvent({
          stage: 'workflow',
          source_type: 'media_upload',
          source_id: (submission as { id?: string } | null)?.id ?? null,
          metadata: {
            file_name: next.file.name,
            file_size_bytes: next.file.size,
            file_type: next.file.type || null,
          },
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
    <div className={compact ? "overview-submissions" : "media-workspace mx-auto animate-fade-in"}>
      {!compact && <>
        <header className="media-page-heading studio-page-heading">
          <div><h1>Media library</h1>
            </div>
          <div className="studio-page-actions">
            <button type="button" onClick={() => setView(view === 'grid' ? 'list' : 'grid')} className="studio-secondary focus-ring" aria-label={`Switch to ${view === 'grid' ? 'list' : 'grid'} view`}><List size={15} /> View</button>
            {PARENT_FOLDER_LINK && <a href={PARENT_FOLDER_LINK} target="_blank" rel="noopener noreferrer" className="studio-secondary focus-ring"><FolderOpen size={15} /> Browse all submissions <ExternalLink size={12} /></a>}
            <button type="button" onClick={() => uploadInputRef.current?.click()} className="studio-primary focus-ring"><UploadCloud size={16} /> Upload media</button>
          </div>
        </header>
        <div className="media-filter-bar">
          <div className="studio-filter-tabs" aria-label="File type filters">
            {['All', 'Audio', 'Video', 'Images', 'Documents'].map(kind => <button key={kind} type="button" aria-pressed={mediaKind === kind} onClick={() => setMediaKind(kind)} className="focus-ring">{kind}</button>)}
          </div>
          <button type="button" onClick={() => setShowFilters(value => !value)} aria-expanded={showFilters} aria-controls="media-search-filters" className="studio-secondary focus-ring"><SlidersHorizontal size={14} /> Filters{filter ? ' · 1' : ''}</button>
          <label id="media-search-filters" hidden={!showFilters} className="studio-search"><Search size={15} aria-hidden="true" /><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Find files or people…" aria-label="Search loaded media" /></label>
        </div>
      </>}

      <aside className="media-upload-panel">
      {!compact && <><p className="overview-date">Quick upload</p>
      <h2 className="media-upload-title">Upload media</h2></>}
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
          ref={uploadInputRef}
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
              Choose or drop files
            </p>
            <p className="text-[12px] text-text-muted mt-1">
              Files go to <span className="font-semibold text-text">Checkmark Media Drop › {memberName}</span> · cap {MAX_FILE_LABEL} per file
            </p>
          </div>
        </div>
      </label>

      </aside>
      {/* ─── Pending uploads ────────────────────────────────── */}
      {pending.length > 0 && (
        <div className="media-upload-queue rounded-2xl border border-border bg-surface overflow-hidden">
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
      <section className="media-library-panel rounded-2xl border border-border-strong bg-surface overflow-hidden">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div><h2 className="text-[15px] font-bold text-text">{compact ? 'Recent uploads' : history.isLoading ? 'Loading library…' : history.isError ? 'Media library' : `${filteredMedia.length}${filter || mediaKind !== 'All' ? ` of ${history.data?.length ?? 0}` : ''} files`}</h2><p className="mt-1 text-[11px] text-text-muted">{compact ? 'Team submissions' : `${formatBytes((history.data ?? []).reduce((total, row) => total + row.size_bytes, 0))} in loaded files · latest 200 uploads`}</p></div>
          {!compact && <div className="flex items-center gap-1 ml-auto mr-3" aria-label="Media layout">
            <button type="button" onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view" className={`p-2 rounded focus-ring ${view === 'grid' ? 'bg-gold/20 text-gold' : 'text-text-muted'}`}><LayoutGrid size={16} /></button>
            <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="List view" className={`p-2 rounded focus-ring ${view === 'list' ? 'bg-gold/20 text-gold' : 'text-text-muted'}`}><List size={16} /></button>
          </div>}
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
          <div className="media-empty-state px-4 py-10 flex flex-col items-center justify-center text-center text-text-light">
            <Inbox size={20} className="mb-1.5" aria-hidden="true" />
            <p className="text-[12px] italic">No submissions yet. Choose files or drop them into Quick upload.</p>
          </div>
        ) : (
          <ul className={!compact && view === 'grid' ? 'media-card-grid' : 'divide-y divide-theme max-h-[680px] overflow-y-auto'}>
            {filteredMedia.length === 0 && <li className="p-5 text-sm text-text-muted">No matching files. Try another name.</li>}
            {(compact ? filteredMedia.slice(0, 6) : filteredMedia).map((row) => (
              <MediaRow key={row.id} row={row} onPreview={setLightbox} grid={!compact && view === 'grid'} />
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
          ref={previewRef}
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
            <MediaPreviewContent key={lightbox.id} row={lightbox} />
            <a href={lightbox.drive_view_url} target="_blank" rel="noopener noreferrer" className="text-sm text-white underline">Open original file ↗</a>
            <figcaption className="media-preview-caption text-[12px] text-center">
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
  grid: boolean
  row: MediaSubmissionRow
  onPreview: (row: MediaSubmissionRow) => void
}

function MediaRow({ row, onPreview, grid }: MediaRowProps) {
  const mediaKind = getMediaKind(row)
  const canPreview = ['Images', 'Audio', 'Video'].includes(mediaKind) && Boolean(row.drive_view_url)
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
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onRowActivate()
              }
            },
            'aria-label': `Preview ${row.original_filename}`,
          }
        : {})}
      className={`media-file px-4 py-2.5 flex items-center gap-3 ${
        canPreview
          ? 'cursor-zoom-in hover:bg-surface-hover/60 focus-ring transition-colors'
          : ''
      }`}
    >
      <MediaArtwork key={row.id} row={row} grid={grid} />

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
          aria-label={`Open original ${row.original_filename}`}
          className="media-open-original shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-gold hover:text-gold/80 transition-colors"
        >
          <span>Open</span>
          <ExternalLink size={10} aria-hidden="true" />
        </a>
      )}
    </li>
  )
}
