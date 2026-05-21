// Forum attachment types + helpers shared by the input picker and
// the bubble renderer. Schema lives on `chat_messages.attachments`
// as a freeform jsonb array; these types describe the agreed shape.

// 2026-05-20 — added 'audio' (MP3 / WAV / etc) so members can drop
// voice memos + audio clips into chat. Backend bucket migration
// 20260520190000_forum_media_audio_support.sql also adds the audio
// MIME types to the storage bucket's allowed list.
export type AttachmentKind = 'image' | 'video' | 'audio' | 'link'
export type LinkEmbedKind = 'youtube' | 'vimeo' | 'loom'

export interface BaseAttachment {
  kind: AttachmentKind
  url: string
  /** Original filename for image/video/audio, link title for link. */
  name?: string
  /** MIME type from the upload (image/video/audio only). */
  mime?: string
  /** Bytes from the upload (image/video/audio only). */
  size?: number
  /** When kind === 'link' and url is recognized, render as an embed. */
  embed?: LinkEmbedKind
  /**
   * 2026-05-20 — Instagram-style link preview metadata. Populated
   * by `unfurl-link` edge function when an admin adds a link
   * attachment. Persisted in the message's attachments jsonb so
   * render is read-only — no per-message fetch round trips.
   * Any/all fields may be missing if the target site didn't expose
   * the corresponding meta tag.
   */
  preview?: {
    title?: string | null
    description?: string | null
    image?: string | null
    site_name?: string | null
  }
}

export type ChatAttachment = BaseAttachment

// ─── Storage paths ───────────────────────────────────────────────

/** Bucket the +media uploads land in. Created in the
 *  `20260513190100_forum_media_storage_bucket.sql` migration. */
export const FORUM_MEDIA_BUCKET = 'forum-media'

/**
 * Build the upload path. RLS on the bucket parses
 * `(storage.foldername(name))[3]` to get the user_id, so the layout
 * MUST be `<kind>/<channel_id>/<user_id>/<file>`.
 */
export function buildForumMediaPath(opts: {
  kind: 'images' | 'videos' | 'audio'
  channelId: string
  userId: string
  filename: string
}): string {
  const safe = opts.filename.replace(/[^\w.-]/g, '_')
  return `${opts.kind}/${opts.channelId}/${opts.userId}/${Date.now()}-${safe}`
}

// ─── Link embed detection ────────────────────────────────────────

/**
 * Detect a known video host in a URL and return both the embed
 * kind + the embeddable iframe URL. Returns null when the URL
 * doesn't match a host we know how to embed — caller renders a
 * plain link card in that case.
 *
 * Patterns intentionally minimal — we only support what staff
 * actually use for training videos today (YouTube, Vimeo, Loom).
 * Adding more hosts is a one-line append.
 */
export function detectLinkEmbed(rawUrl: string): {
  embed: LinkEmbedKind
  iframeUrl: string
} | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '')

  // YouTube — supports both watch?v= and youtu.be/<id>.
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = url.searchParams.get('v')
    if (id) {
      return { embed: 'youtube', iframeUrl: `https://www.youtube.com/embed/${id}` }
    }
  }
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    if (id) {
      return { embed: 'youtube', iframeUrl: `https://www.youtube.com/embed/${id}` }
    }
  }

  // Vimeo — vimeo.com/<id> (numeric).
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const seg = url.pathname.split('/').filter(Boolean)[0]
    if (seg && /^\d+$/.test(seg)) {
      return { embed: 'vimeo', iframeUrl: `https://player.vimeo.com/video/${seg}` }
    }
  }

  // Loom — loom.com/share/<id>.
  if (host === 'loom.com' || host === 'www.loom.com') {
    const m = url.pathname.match(/\/share\/([^/]+)/)
    if (m?.[1]) {
      return { embed: 'loom', iframeUrl: `https://www.loom.com/embed/${m[1]}` }
    }
  }

  return null
}

// ─── Validation ──────────────────────────────────────────────────

export const FORUM_MAX_BYTES = 50 * 1024 * 1024
export const FORUM_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const FORUM_VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime']
// 2026-05-20 — audio MIME allow-list. mpeg covers .mp3, mp4 covers
// AAC/M4A, wav covers PCM, ogg covers Vorbis/Opus, webm covers Opus
// in WebM. Browsers natively play this set without polyfills.
export const FORUM_AUDIO_MIME = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
]

export function classifyMime(mime: string): AttachmentKind | null {
  if (FORUM_IMAGE_MIME.includes(mime)) return 'image'
  if (FORUM_VIDEO_MIME.includes(mime)) return 'video'
  if (FORUM_AUDIO_MIME.includes(mime)) return 'audio'
  return null
}
