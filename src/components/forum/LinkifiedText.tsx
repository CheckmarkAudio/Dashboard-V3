// 2026-05-20 — Render plain forum message text with URLs as
// clickable anchors. Replaces the previous `{message.content}`
// approach which left pasted URLs as inert strings (user
// complaint: "currently links dont link").
//
// Wraps the linkifySegments() helper in the simplest possible
// React surface so it can drop straight into any forum text body.
// Preserves whitespace + newlines via `whitespace-pre-wrap` on the
// outer container (caller's responsibility — same as before).

import { Fragment } from 'react'
import { linkifySegments } from '../../lib/forum/linkify'

interface LinkifiedTextProps {
  text: string
  mentionNames?: string[]
  mentionHref?: (name: string) => string | undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function MentionText({
  value,
  mentionNames = [],
  mentionHref,
}: {
  value: string
  mentionNames?: string[]
  mentionHref?: (name: string) => string | undefined
}) {
  const names = [...new Set(mentionNames.map((name) => name.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
  const nameAlternates = names.map(escapeRegExp)
  const mentionPattern =
    nameAlternates.length > 0
      ? new RegExp(`@\\[([^\\]]+)\\]|@(${nameAlternates.join('|')})`, 'gi')
      : /@\[([^\]]+)\]/g
  const parts: Array<{ type: 'text'; value: string } | { type: 'mention'; label: string }> = []
  let cursor = 0
  for (const match of value.matchAll(mentionPattern)) {
    const index = match.index ?? 0
    if (index > cursor) parts.push({ type: 'text', value: value.slice(cursor, index) })
    const label = (match[1] || match[2] || '').trim()
    if (label) parts.push({ type: 'mention', label })
    else parts.push({ type: 'text', value: match[0] })
    cursor = index + match[0].length
  }
  if (cursor < value.length) parts.push({ type: 'text', value: value.slice(cursor) })

  return (
    <>
      {parts.map((part, partIndex) => {
        if (part.type === 'text') return <Fragment key={partIndex}>{part.value}</Fragment>

        const href = mentionHref?.(part.label)
        const className = "inline-flex items-center rounded-full bg-gold/12 border border-gold/25 px-1.5 py-0.5 text-gold font-bold whitespace-nowrap hover:bg-gold/18 hover:border-gold/40 transition-colors"
        const visible = `@${part.label}`
        if (href) {
          return (
            <a key={partIndex} href={href} className={className}>
              {visible}
            </a>
          )
        }
        return (
          <span key={partIndex} className={className}>
            {visible}
          </span>
        )
      })}
    </>
  )
}

export default function LinkifiedText({ text, mentionNames, mentionHref }: LinkifiedTextProps) {
  const segments = linkifySegments(text)
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'link') {
          return (
            <a
              key={i}
              href={seg.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline underline-offset-2 decoration-gold/40 hover:decoration-gold transition-colors break-all"
            >
              {seg.value}
            </a>
          )
        }
        return (
          <MentionText
            key={i}
            value={seg.value}
            mentionNames={mentionNames}
            mentionHref={mentionHref}
          />
        )
      })}
    </>
  )
}
