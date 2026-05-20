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
  Inbox,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { extractEdgeFunctionError } from '../lib/edgeFunctionError'
import { Badge, PageHeader } from '../components/ui'

// 2026-05-14 pivoted from Drive → Dropbox after Google killed
// service-account quotas on personal accounts. The env var name is
// vendor-neutral so a future swap doesn't require touching the page.
const PARENT_FOLDER_LINK_KEY = 'VITE_MEDIA_PARENT_FOLDER_LINK'
const PARENT_FOLDER_LINK = (import.meta.env[PARENT_FOLDER_LINK_KEY] as string | undefined) ?? null

// 2026-05-20 — bumped 50MB → 150MB to match Dropbox's single-shot
// upload endpoint limit. See edge function for rationale.
const MAX_FILE_BYTES = 150 * 1024 * 1024
const MAX_FILE_LABEL = '150MB'

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
}

interface PendingUpload {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
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
  const historyKey = useMemo(
    () => ['media-submissions', memberId ?? '__none__'] as const,
    [memberId],
  )
  const history = useQuery({
    queryKey: historyKey,
    enabled: Boolean(memberId),
    queryFn: async (): Promise<MediaSubmissionRow[]> => {
      const { data, error } = await supabase
        .from('media_submissions')
        .select('*')
        .eq('member_id', memberId!)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as MediaSubmissionRow[]
    },
    staleTime: 30_000,
  })

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

  // Process the queue serially — one file at a time avoids piling up
  // memory in the edge function and keeps the UI's progress feedback
  // honest.
  //
  // ⚠️ Bug fix 2026-05-14: previously this used a `cancelled` flag in
  // an effect that re-ran every time `pending` changed. The
  // setPending(...uploading...) call inside the effect mutated
  // `pending`, retriggering the effect, which fired the cleanup and
  // flipped `cancelled = true` BEFORE the response landed. Net result:
  // the row stayed at "Uploading…" forever even after the request
  // completed. Now we gate via a ref so each in-flight upload owns its
  // own state lifetime, independent of how many times the effect re-
  // renders.
  const inFlightRef = useRef(false)
  useEffect(() => {
    if (inFlightRef.current) return
    const next = pending.find((p) => p.status === 'queued')
    if (!next) return

    inFlightRef.current = true
    const run = async () => {
      setPending((prev) =>
        prev.map((p) => (p.id === next.id ? { ...p, status: 'uploading' } : p)),
      )

      const form = new FormData()
      form.append('file', next.file, next.file.name)

      try {
        const { data, error } = await supabase.functions.invoke<{
          ok: boolean
          submission?: MediaSubmissionRow
          error?: string
          warning?: string
        }>('upload-to-dropbox', {
          body: form,
        })

        if (error || !data?.ok) {
          const msg = data?.error ?? (await extractEdgeFunctionError(error, 'Upload failed'))
          setPending((prev) =>
            prev.map((p) =>
              p.id === next.id ? { ...p, status: 'error', error: msg } : p,
            ),
          )
          return
        }

        setPending((prev) =>
          prev.map((p) => (p.id === next.id ? { ...p, status: 'done' } : p)),
        )
        // Fold the new submission into the history cache so the row
        // appears instantly without waiting for refetch.
        if (data.submission) {
          queryClient.setQueryData<MediaSubmissionRow[]>(historyKey, (prev) => {
            const existing = prev ?? []
            return [data.submission!, ...existing]
          })
        } else {
          // History insert failed server-side but file landed in Drive —
          // refetch to make sure we eventually see it.
          void queryClient.invalidateQueries({ queryKey: historyKey })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        setPending((prev) =>
          prev.map((p) =>
            p.id === next.id ? { ...p, status: 'error', error: msg } : p,
          ),
        )
      } finally {
        inFlightRef.current = false
      }
    }

    void run()
  }, [pending, historyKey, queryClient])

  const clearDone = () => setPending((prev) => prev.filter((p) => p.status !== 'done'))
  const dismiss = (id: string) =>
    setPending((prev) => prev.filter((p) => p.id !== id))

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
            {pending.map((p) => (
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
                    {p.status === 'uploading' && `Uploading · ${formatBytes(p.file.size)}`}
                    {p.status === 'done' && `Uploaded · ${formatBytes(p.file.size)}`}
                    {p.status === 'error' && (p.error ?? 'Upload failed')}
                  </p>
                </div>
                {(p.status === 'done' || p.status === 'error') && (
                  <button
                    type="button"
                    onClick={() => dismiss(p.id)}
                    aria-label={`Dismiss ${p.file.name}`}
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-text-light hover:text-text hover:bg-surface-hover transition-colors focus-ring"
                  >
                    <X size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Submission history ─────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface-alt/40 overflow-hidden">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-text">Your submission history</h2>
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
          <ul className="divide-y divide-theme max-h-[480px] overflow-y-auto">
            {history.data!.map((row) => (
              <li key={row.id} className="px-4 py-2.5 flex items-center gap-2.5">
                <span className="shrink-0 w-7 h-7 rounded-full bg-violet-500/15 ring-1 ring-violet-500/30 text-violet-300 flex items-center justify-center">
                  <FileUp size={13} aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-text truncate" title={row.original_filename}>
                    {row.original_filename}
                  </p>
                  <p className="text-[11px] text-text-light truncate mt-0.5">
                    {formatBytes(row.size_bytes)} · {formatRelative(row.created_at)}
                  </p>
                </div>
                {row.drive_view_url && (
                  <a
                    href={row.drive_view_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-gold hover:text-gold/80 transition-colors"
                  >
                    Open
                    <ExternalLink size={10} aria-hidden="true" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
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
