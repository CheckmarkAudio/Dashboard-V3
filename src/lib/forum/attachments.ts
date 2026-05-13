// Forum attachment types + helpers shared by the input picker and
// the bubble renderer. Schema lives on `chat_messages.attachments`
// as a freeform jsonb array; these types describe the agreed shape.

export type AttachmentKind = 'image' | 'video' | 'link'
export type LinkEmbedKind = 'youtube' | 'vimeo' | 'loom'

export interface BaseAttachment {
  kind: AttachmentKind
  url: string
  /** Original filename for image/video, link title for link. */
  name?: string
  /** MIME type from the upload (image/video only). */
  mime?: string
  /** Bytes from the upload (image/video only). */
  size?: number
  /** When kind === 'link' and url is recognized, render as an embed. */
  embed?: LinkEmbedKind
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
  kind: 'images' | 'videos'
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

export function classifyMime(mime: string): AttachmentKind | null {
  if (FORUM_IMAGE_MIME.includes(mime)) return 'image'
  if (FORUM_VIDEO_MIME.includes(mime)) return 'video'
  return null
}
