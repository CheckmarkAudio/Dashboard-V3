import { useState } from 'react'
import { Download, ExternalLink, Link2, Music } from 'lucide-react'
import { detectLinkEmbed, type ChatAttachment } from '../../lib/forum/attachments'

/**
 * Render the attachments[] array of a chat_messages row inside its
 * bubble. The renderer is layout-agnostic — it just stacks each
 * attachment with `space-y-2`, so it slots into either own (right-
 * aligned) or theirs (left-aligned) bubble layouts.
 */
interface AttachmentDisplayProps {
  attachments: ChatAttachment[]
  /** When true, slightly dim the embed background so it doesn't
   *  fight a gold-tinted "own" bubble. */
  ownBubble?: boolean
}

export default function AttachmentDisplay({
  attachments,
  ownBubble = false,
}: AttachmentDisplayProps) {
  if (attachments.length === 0) return null
  return (
    <div className="space-y-2 mt-1.5">
      {attachments.map((a, idx) => (
        <AttachmentItem key={`${a.kind}-${idx}-${a.url}`} attachment={a} ownBubble={ownBubble} />
      ))}
    </div>
  )
}

function AttachmentItem({
  attachment,
  ownBubble,
}: {
  attachment: ChatAttachment
  ownBubble: boolean
}) {
  if (attachment.kind === 'image') {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-[320px] rounded-lg overflow-hidden border border-border/60 bg-surface-alt"
      >
        <img
          src={attachment.url}
          alt={attachment.name ?? 'Attached image'}
          loading="lazy"
          className="block w-full h-auto max-h-[320px] object-contain"
        />
      </a>
    )
  }

  if (attachment.kind === 'video') {
    return <VideoAttachment attachment={attachment} />
  }

  // 2026-05-20 — audio kind. Renders the native <audio controls>
  // player with a tiny header showing the filename + a download
  // affordance. Voice memos, MP3s, etc.
  if (attachment.kind === 'audio') {
    return (
      <div className={[
        'max-w-[420px] w-full rounded-lg border p-2 space-y-1.5',
        ownBubble ? 'border-gold/30 bg-gold/5' : 'border-border bg-surface-alt/60',
      ].join(' ')}>
        <div className="flex items-center gap-2 px-1">
          <Music size={12} className="text-text-muted shrink-0" aria-hidden="true" />
          <span className="text-[11px] font-semibold text-text truncate flex-1 min-w-0" title={attachment.name ?? 'Audio'}>
            {attachment.name ?? 'Audio'}
          </span>
          <a
            href={attachment.url}
            download={attachment.name ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download audio"
            className="text-text-light hover:text-gold transition-colors"
          >
            <Download size={12} aria-hidden="true" />
          </a>
        </div>
        <audio
          src={attachment.url}
          controls
          preload="metadata"
          className="w-full"
        >
          Your browser doesn't support inline audio.
        </audio>
      </div>
    )
  }

  // Link — three rendering paths:
  //   1. Known embed host → iframe player.
  //        - YouTube / Vimeo / Loom → 16:9 video aspect
  //        - Spotify → 152px tall horizontal bar (track) / 352px (album)
  //        - SoundCloud → 166px tall horizontal bar
  //        - Bandcamp → 350px square art-forward player
  //   2. Has OG/Twitter preview metadata → Instagram-style rich card
  //      with hero image + title + description (2026-05-20 add).
  //   3. Otherwise → compact icon + URL card.
  const detect = detectLinkEmbed(attachment.url)
  if (detect) {
    // 2026-05-23 (PR C) — per-provider sizing. Music players have
    // fixed heights (not 16:9), so a one-size-fits-all aspect-video
    // wrapper would either stretch them weird or leave dead space.
    const sizing =
      detect.embed === 'spotify'
        ? (attachment.url.includes('/track/') || attachment.url.includes('/episode/')
            ? 'h-[152px] max-w-[480px] w-full'
            : 'h-[352px] max-w-[480px] w-full')
        : detect.embed === 'soundcloud'
          ? (attachment.url.includes('/sets/')
              ? 'h-[300px] max-w-[480px] w-full'
              : 'h-[166px] max-w-[480px] w-full')
          : detect.embed === 'bandcamp'
            ? 'w-[350px] h-[350px]'
            : 'max-w-[480px] w-full aspect-video' // youtube / vimeo / loom
    return (
      <div
        className={`${sizing} rounded-lg overflow-hidden border border-border/60 bg-black`}
      >
        <iframe
          src={detect.iframeUrl}
          title={attachment.name ?? `${detect.embed} embed`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="w-full h-full"
        />
      </div>
    )
  }

  const preview = attachment.preview
  const hasRichPreview = Boolean(
    preview && (preview.title || preview.description || preview.image),
  )
  if (hasRichPreview) {
    return <LinkPreviewCard attachment={attachment} ownBubble={ownBubble} />
  }

  // Compact fallback — host + truncated URL.
  let host = ''
  try {
    host = new URL(attachment.url).hostname.replace(/^www\./, '')
  } catch { /* malformed; just show the raw url */ }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'group max-w-[420px] inline-flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border transition-colors',
        ownBubble
          ? 'bg-surface/60 hover:bg-surface'
          : 'bg-surface-alt/60 hover:bg-surface-alt',
      ].join(' ')}
    >
      <Link2 size={14} className="text-text-muted shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-semibold text-text truncate">
          {attachment.name ?? host ?? 'Link'}
        </span>
        <span className="block text-[10px] text-text-light truncate">
          {attachment.url}
        </span>
      </span>
      <ExternalLink size={12} className="text-text-light shrink-0 group-hover:text-gold" aria-hidden="true" />
    </a>
  )
}

// ─── Video renderer ─────────────────────────────────────────────────
// 2026-05-20 — Extracted so we can detect codec failures (browser
// fires `error` on <video> when it can't decode — common with .MOV
// on Chrome, HEVC anywhere) and fall back to a download card
// instead of showing the broken playback element. Addresses user
// complaint: "videos show broken file or dont populate."
function VideoAttachment({ attachment }: { attachment: ChatAttachment }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="max-w-[420px] inline-flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-surface-alt/60">
        <Download size={14} className="text-text-muted shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block text-[12px] font-semibold text-text truncate">
            {attachment.name ?? 'Video'}
          </span>
          <span className="block text-[10px] text-text-light">
            Browser can't play inline — download to view
          </span>
        </span>
        <a
          href={attachment.url}
          download={attachment.name ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gold text-black text-[10px] font-bold hover:bg-gold-muted transition-colors shrink-0"
        >
          Download
        </a>
      </div>
    )
  }
  return (
    <video
      src={attachment.url}
      controls
      preload="metadata"
      onError={() => setFailed(true)}
      className="block max-w-[420px] w-full rounded-lg border border-border/60 bg-black"
    >
      Your browser doesn't support inline video — <a href={attachment.url} className="underline">download</a>.
    </video>
  )
}

// ─── Rich link preview card (Instagram-style) ───────────────────────
// 2026-05-20 — Renders OG/Twitter metadata as a hero image + title +
// description + site name. Image is optional — if missing, falls
// back to a text-only card (which still looks better than the bare
// link). The whole card is one anchor so the click target matches
// what the user expects.
function LinkPreviewCard({
  attachment,
  ownBubble,
}: {
  attachment: ChatAttachment
  ownBubble: boolean
}) {
  const preview = attachment.preview ?? {}
  let host = preview.site_name ?? ''
  if (!host) {
    try {
      host = new URL(attachment.url).hostname.replace(/^www\./, '')
    } catch { /* keep empty */ }
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'group block max-w-[420px] rounded-lg border overflow-hidden transition-colors',
        ownBubble
          ? 'border-gold/30 bg-surface/60 hover:bg-surface'
          : 'border-border bg-surface-alt/60 hover:bg-surface-alt',
      ].join(' ')}
    >
      {preview.image && (
        <div className="aspect-[1.91/1] bg-black overflow-hidden">
          <img
            src={preview.image}
            alt=""
            loading="lazy"
            className="block w-full h-full object-cover"
            onError={(e) => {
              // Image failed to load (broken URL, hotlink-protected,
              // etc) — hide it so we degrade to a text-only card.
              ;(e.currentTarget.parentElement as HTMLElement | null)?.remove()
            }}
          />
        </div>
      )}
      <div className="px-3 py-2 space-y-0.5">
        {host && (
          <span className="block text-[10px] uppercase tracking-wider text-text-light/80 font-semibold">
            {host}
          </span>
        )}
        {preview.title && (
          <span className="block text-[13px] font-semibold text-text leading-snug line-clamp-2">
            {preview.title}
          </span>
        )}
        {preview.description && (
          <span className="block text-[11px] text-text-muted leading-snug line-clamp-2">
            {preview.description}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[10px] text-text-light/70 group-hover:text-gold transition-colors pt-1">
          <ExternalLink size={10} aria-hidden="true" />
          <span className="truncate max-w-[280px]">{attachment.url}</span>
        </span>
      </div>
    </a>
  )
}
