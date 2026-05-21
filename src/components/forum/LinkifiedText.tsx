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
}

export default function LinkifiedText({ text }: LinkifiedTextProps) {
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
        return <Fragment key={i}>{seg.value}</Fragment>
      })}
    </>
  )
}
