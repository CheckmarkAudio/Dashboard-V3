import { useCallback, useRef, useState } from 'react'
import { Image as ImageIcon, Link2, Loader2, Music, Plus, Video, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import {
  buildForumMediaPath,
  detectLinkEmbed,
  FORUM_AUDIO_ACCEPT,
  FORUM_AUDIO_MIME,
  FORUM_IMAGE_ACCEPT,
  FORUM_IMAGE_MIME,
  FORUM_MAX_BYTES,
  FORUM_MEDIA_BUCKET,
  FORUM_VIDEO_ACCEPT,
  FORUM_VIDEO_MIME,
  type ChatAttachment,
} from '../../lib/forum/attachments'
import { unfurlLink } from '../../lib/forum/unfurl'

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
  const [unfurlingLink, setUnfurlingLink] = useState<string | null>(null)
  const [linkInput, setLinkInput] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const closePopover = useCallback(() => {
    setOpen(false)
    setLinkOpen(false)
    setLinkInput('')
  }, [])

  const upload = useCallback(
    async (file: File, kind: 'image' | 'video' | 'audio') => {
      // 2026-05-20 — accept anything whose MIME starts with the
      // matching family prefix (image/*, video/*, audio/*) OR is in
      // the explicit allow-list. Some browsers (especially older
      // Windows) report .mp3 as `audio/mp3` instead of `audio/mpeg`;
      // some don't report a type at all. The explicit allow-list
      // catches the named variants; the prefix check is the safety
      // net so we don't reject files the user is clearly trying to
      // attach. Server-side bucket allow-list still applies as the
      // real gate.
      const allowedMime =
        kind === 'image' ? FORUM_IMAGE_MIME :
        kind === 'video' ? FORUM_VIDEO_MIME :
        FORUM_AUDIO_MIME
      const familyPrefix = `${kind}/`
      const matches =
        allowedMime.includes(file.type) ||
        (file.type !== '' && file.type.startsWith(familyPrefix))
      if (!matches) {
        toast(
          kind === 'image'
            ? 'That doesn\'t look like an image. Try a JPEG, PNG, WEBP, or GIF.'
            : kind === 'video'
              ? 'That doesn\'t look like a video. Try MP4, WEBM, or MOV.'
              : 'That doesn\'t look like an audio file. Try MP3, WAV, M4A, AAC, OGG, or FLAC.',
          'error',
        )
        return
      }
      if (file.size > FORUM_MAX_BYTES) {
        toast(
          kind === 'video'
            ? 'Video is larger than 50 MB. Try compressing it, or paste a Loom/YouTube link instead.'
            : kind === 'audio'
              ? 'Audio is larger than 50 MB. Try a shorter clip or lower bitrate.'
              : 'File is larger than 50 MB.',
          'error',
        )
        return
      }
      setUploading(kind)
      try {
        const path = buildForumMediaPath({
          kind: kind === 'image' ? 'images' : kind === 'video' ? 'videos' : 'audio',
          channelId,
          userId,
          filename: file.name,
        })
        const { error: uploadErr } = await supabase.storage
          .from(FORUM_MEDIA_BUCKET)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          })
        if (uploadErr) throw uploadErr
        const { data: urlData } = supabase.storage
          .from(FORUM_MEDIA_BUCKET)
          .getPublicUrl(path)
        onAdd({
          kind,
          url: urlData.publicUrl,
          name: file.name,
          mime: file.type,
          size: file.size,
        })
        closePopover()
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Upload failed', 'error')
      } finally {
        setUploading(null)
      }
    },
    [channelId, userId, onAdd, toast, closePopover],
  )

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so picking the same file twice fires onChange
    if (file) void upload(file, 'image')
  }
  const onVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void upload(file, 'video')
  }
  const onAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void upload(file, 'audio')
  }

  const submitLink = async () => {
    const trimmed = linkInput.trim()
    if (!trimmed) return
    let normalized = trimmed
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`
    try {
      // Validate it parses; throw → toast.
      // eslint-disable-next-line no-new
      new URL(normalized)
    } catch {
      toast('That doesn\'t look like a valid URL.', 'error')
      return
    }
    const detect = detectLinkEmbed(normalized)
    // 2026-05-20 — kick off unfurl in parallel with the add so the
    // attachment lands instantly in pending, and we patch in the
    // preview metadata once it arrives. UX feels snappy; preview
    // card appears within a beat if the target site has OG tags.
    closePopover()
    if (detect) {
      // Known embed (YouTube/Vimeo/Loom) — iframe handles preview
      // visually; no need to call unfurl.
      onAdd({ kind: 'link', url: normalized, embed: detect.embed })
      return
    }
    setUnfurlingLink(normalized)
    const preview = await unfurlLink(normalized)
    setUnfurlingLink(null)
    onAdd({
      kind: 'link',
      url: normalized,
      ...(preview ? { preview, name: preview.title ?? undefined } : {}),
    })
  }

  return (
    <div className="space-y-2">
      {/* Pending attachments strip — chips with remove buttons. */}
      {(pending.length > 0 || unfurlingLink) && (
        <div className="flex items-center gap-2 flex-wrap">
          {pending.map((a, idx) => (
            <PendingChip key={`${a.kind}-${idx}-${a.url}`} attachment={a} onRemove={() => onRemove(idx)} />
          ))}
          {unfurlingLink && (
            <span className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-[11px]">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              <span>Fetching preview…</span>
            </span>
          )}
        </div>
      )}

      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => {
            if (disabled) return
            setOpen((v) => !v)
            setLinkOpen(false)
          }}
          disabled={disabled}
          aria-label="Add media"
          aria-expanded={open}
          aria-haspopup="menu"
          title="Attach an image, video, or link"
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
            {linkOpen ? (
              <div className="p-2 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light px-1">
                  Paste link
                </p>
                <input
                  type="url"
                  autoFocus
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitLink()
                    }
                  }}
                  placeholder="https://loom.com/share/…"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-surface-alt text-sm text-text placeholder:text-text-light focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                />
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => { setLinkOpen(false); setLinkInput('') }}
                    className="text-[11px] text-text-muted hover:text-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitLink}
                    disabled={!linkInput.trim()}
                    className="px-3 py-1 rounded-lg bg-gold text-black text-[11px] font-bold hover:bg-gold-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                <div className="my-1 border-t border-border/60" />
                <PickerOption
                  icon={<Link2 size={14} aria-hidden="true" />}
                  label="Link"
                  hint="Any URL — YouTube, Vimeo, Loom auto-embed"
                  onClick={() => setLinkOpen(true)}
                />
              </>
            )}
          </div>
        )}

        {/* Hidden file inputs — driven by the popover options. */}
        {/* 2026-05-20 — `accept` uses the wildcard + extensions
            recipe (FORUM_*_ACCEPT constants) instead of the MIME-
            only join. macOS Finder was greying out users' MP3s
            because its MIME database doesn't always tag .mp3 as
            `audio/mpeg`; the wildcard fixes that universally. */}
        <input
          ref={imageInputRef}
          type="file"
          accept={FORUM_IMAGE_ACCEPT}
          onChange={onImageChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept={FORUM_VIDEO_ACCEPT}
          onChange={onVideoChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <input
          ref={audioInputRef}
          type="file"
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
  return (
    <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-surface-alt border border-border text-text text-[11px]">
      {attachment.kind === 'image' ? (
        <img
          src={attachment.url}
          alt=""
          className="w-5 h-5 rounded-full object-cover"
        />
      ) : (
        <Icon size={12} className="text-text-muted" aria-hidden="true" />
      )}
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
