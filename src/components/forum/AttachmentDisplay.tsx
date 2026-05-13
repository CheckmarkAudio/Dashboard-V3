import { ExternalLink, Link2 } from 'lucide-react'
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
    return (
      <video
        src={attachment.url}
        controls
        preload="metadata"
        className="block max-w-[420px] w-full rounded-lg border border-border/60 bg-black"
      >
        Your browser doesn't support inline video — <a href={attachment.url} className="underline">download</a>.
      </video>
    )
  }

  // Link — detect whether we can embed (YouTube / Vimeo / Loom),
  // otherwise render a clickable card.
  const detect = attachment.embed
    ? // Trust the stored embed kind, but still rebuild the iframe
      // URL so we don't have to persist the iframe URL itself.
      detectLinkEmbed(attachment.url) ?? null
    : detectLinkEmbed(attachment.url)
  if (detect) {
    return (
      <div className="max-w-[480px] aspect-video rounded-lg overflow-hidden border border-border/60 bg-black">
        <iframe
          src={detect.iframeUrl}
          title={attachment.name ?? `${detect.embed} video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="w-full h-full"
        />
      </div>
    )
  }

  // Plain link card — host + truncated URL.
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
