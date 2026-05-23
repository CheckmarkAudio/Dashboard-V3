import { useCallback, useRef, useState } from 'react'
import { Image as ImageIcon, Link2, Loader2, Music, Plus, Video, X } from 'lucide-react'
import { useToast } from '../Toast'
import {
  FORUM_AUDIO_ACCEPT,
  FORUM_IMAGE_ACCEPT,
  FORUM_VIDEO_ACCEPT,
  type ChatAttachment,
} from '../../lib/forum/attachments'
import { uploadForumFile } from '../../lib/forum/upload'
// 2026-05-20 (b) — `detectLinkEmbed` + `unfurlLink` imports removed
// alongside the +Link picker option. Both are still imported by
// Content.tsx for the auto-unfurl-on-send path.
// 2026-05-21 (PR B) — upload helper extracted to ../../lib/forum/upload
// so drag-anywhere + paste handlers in Content.tsx share the same
// MIME-check + size-check + Supabase Storage code path.

/**
 * Media picker for the forum message input.
 *
 * Renders:
 *   - A "+ Media" trigger button that opens a small popover with
 *     three options: Image, Video, Link.
 *   - A pending-attachments strip rendered inline above the input
 *     (chips with thumb / icon + remove button) so the user can
 *     review what they're sending before hitting Send.
 *
 * Uploads happen the moment a file is picked — uploaded URLs land
 * in the pending list immediately. Send composes the message with
 * the current `pending` array. The parent manages send (and
 * optimistic clear) — this component just drives the picker UI.
 */

interface MediaPickerProps {
  channelId: string
  userId: string
  pending: ChatAttachment[]
  onAdd: (attachment: ChatAttachment) => void
  onRemove: (index: number) => void
  /** Disable while the parent is sending. */
  disabled?: boolean
}

export default function MediaPicker({
  channelId,
  userId,
  pending,
  onAdd,
  onRemove,
  disabled = false,
}: MediaPickerProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState<'image' | 'video' | 'audio' | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  // 2026-05-20 (b) — closePopover used to also reset link state.
  // Link picker was removed entirely; pasted URLs in the message
  // body now auto-unfurl via sendMessage. See Content.tsx.
  const closePopover = useCallback(() => {
    setOpen(false)
  }, [])

  // 2026-05-21 (PR B) — runs N files through the shared upload util
  // in parallel. Each successful upload appends to pendingAttachments
  // independently via onAdd, so a fast image lands before a slow
  // video — feels snappy for mixed selections.
  const uploadMany = useCallback(
    async (files: File[], kind: 'image' | 'video' | 'audio') => {
      if (files.length === 0) return
      setUploading(kind)
      try {
        await Promise.all(
          files.map(async (file) => {
            try {
              const attachment = await uploadForumFile({ file, kind, channelId, userId })
              onAdd(attachment)
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Upload failed', 'error')
            }
          }),
        )
        closePopover()
      } finally {
        setUploading(null)
      }
    },
    [channelId, userId, onAdd, toast, closePopover],
  )

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // reset so picking the same file twice fires onChange
    if (files.length > 0) void uploadMany(files, 'image')
  }
  const onVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length > 0) void uploadMany(files, 'video')
  }
  const onAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length > 0) void uploadMany(files, 'audio')
  }

  // 2026-05-20 (b) — `submitLink` removed. The +Link picker option
  // was redundant with auto-unfurl on send (Content.tsx → sendMessage
  // → extractUrls + unfurlLink for every URL in the message body).
  // Per user: "we should be able to just paste in the link into
  // forum and it show the link and a visual preview... lets remove
  // the link button but have the paste link in chat bring us the
  // preview". Single path = less surface area + nothing to be
  // half-broken.

  return (
    <div className="space-y-2">
      {/* Pending attachments strip — chips with remove buttons. */}
      {pending.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {pending.map((a, idx) => (
            <PendingChip key={`${a.kind}-${idx}-${a.url}`} attachment={a} onRemove={() => onRemove(idx)} />
          ))}
        </div>
      )}

      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => {
            if (disabled) return
            setOpen((v) => !v)
          }}
          disabled={disabled}
          aria-label="Add media"
          aria-expanded={open}
          aria-haspopup="menu"
          title="Attach an image, video, or audio file"
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-surface-alt text-text-muted hover:text-gold hover:border-gold/40 transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Plus size={14} aria-hidden="true" />
          )}
          <span className="text-[12px] font-semibold">Media</span>
        </button>

        {open && (
          <div
            role="menu"
            aria-label="Media kind"
            className="absolute bottom-full left-0 mb-2 z-30 bg-surface border border-border rounded-xl shadow-xl py-1 min-w-[180px] animate-fade-in"
          >
            <PickerOption
              icon={<ImageIcon size={14} aria-hidden="true" />}
              label="Image"
              hint="JPEG · PNG · WEBP · GIF"
              disabled={uploading !== null}
              onClick={() => imageInputRef.current?.click()}
            />
            <PickerOption
              icon={<Video size={14} aria-hidden="true" />}
              label="Video"
              hint="MP4 · WEBM · MOV (max 50 MB)"
              disabled={uploading !== null}
              onClick={() => videoInputRef.current?.click()}
            />
            {/* 2026-05-20 — audio attachments (MP3 / WAV / etc).
                Renders as an inline <audio controls> in the
                message bubble via AttachmentDisplay. */}
            <PickerOption
              icon={<Music size={14} aria-hidden="true" />}
              label="Audio"
              hint="MP3 · WAV · M4A · OGG (max 50 MB)"
              disabled={uploading !== null}
              onClick={() => audioInputRef.current?.click()}
            />
            {/* 2026-05-20 (b) — Link picker removed. Pasted URLs in
                the message body auto-unfurl on send (see Content.tsx
                → sendMessage → extractUrls). Single path = nothing
                to be half-broken. */}
          </div>
        )}

        {/* Hidden file inputs — driven by the popover options. */}
        {/* 2026-05-20 — `accept` uses the wildcard + extensions
            recipe (FORUM_*_ACCEPT constants) instead of the MIME-
            only join. macOS Finder was greying out users' MP3s
            because its MIME database doesn't always tag .mp3 as
            `audio/mpeg`; the wildcard fixes that universally.
            2026-05-21 — `multiple` so one pick = N files in
            parallel uploads. Matches Discord's "drop a folder of
            screenshots" flow. */}
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept={FORUM_IMAGE_ACCEPT}
          onChange={onImageChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <input
          ref={videoInputRef}
          type="file"
          multiple
          accept={FORUM_VIDEO_ACCEPT}
          onChange={onVideoChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <input
          ref={audioInputRef}
          type="file"
          multiple
          accept={FORUM_AUDIO_ACCEPT}
          onChange={onAudioChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

// ─── Bits ────────────────────────────────────────────────────────

function PickerOption({
  icon,
  label,
  hint,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-surface-hover transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="shrink-0 mt-0.5 text-text-muted">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-semibold text-text">{label}</span>
        <span className="block text-[10px] text-text-light">{hint}</span>
      </span>
    </button>
  )
}

function PendingChip({
  attachment,
  onRemove,
}: {
  attachment: ChatAttachment
  onRemove: () => void
}) {
  const Icon =
    attachment.kind === 'image' ? ImageIcon :
    attachment.kind === 'video' ? Video :
    attachment.kind === 'audio' ? Music :
    Link2
  const label =
    attachment.kind === 'link'
      ? attachment.url.length > 28
        ? `${attachment.url.slice(0, 28)}…`
        : attachment.url
      : attachment.name ?? attachment.kind
  // 2026-05-21 (PR B) — Image attachments render as a square thumb
  // tile (Discord-style) so the user actually sees what they're
  // sending, not a generic filename chip. Non-image kinds keep the
  // pill chip form.
  if (attachment.kind === 'image') {
    return (
      <span className="group/chip relative inline-block">
        <img
          src={attachment.url}
          alt=""
          className="w-16 h-16 rounded-lg object-cover ring-1 ring-border"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove image"
          title={attachment.name ?? attachment.url}
          className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface text-text-muted hover:text-rose-300 ring-1 ring-border shadow opacity-0 group-hover/chip:opacity-100 focus-visible:opacity-100 transition-opacity focus-ring"
        >
          <X size={11} aria-hidden="true" />
        </button>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-surface-alt border border-border text-text text-[11px]">
      <Icon size={12} className="text-text-muted" aria-hidden="true" />
      <span className="truncate max-w-[180px]" title={attachment.name ?? attachment.url}>
        {label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${attachment.kind}`}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-text-muted hover:text-text hover:bg-surface-hover focus-ring"
      >
        <X size={11} aria-hidden="true" />
      </button>
    </span>
  )
}
