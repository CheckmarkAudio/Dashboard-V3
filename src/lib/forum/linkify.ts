// 2026-05-20 — URL detection + tokenization for forum messages.
//
// `message.content` is stored as plain text — no markdown, no HTML.
// Previously this rendered with `{content}` in JSX so pasted URLs
// appeared as inert strings. This helper splits a string into
// alternating text/link segments so the caller can map them to
// `<span>` / `<a>` React nodes.
//
// Design choices:
//   * Regex-based (no parser dependency). Matches https://, http://,
//     and bare www.* patterns. Schemeless domain detection (e.g.
//     "google.com") is deliberately NOT supported — too easy to
//     misfire on things like "version 1.2.3" or "filename.ext".
//   * Trailing punctuation (.,!?:;) is excluded from the link so
//     "Check google.com." doesn't link the trailing dot.
//   * `www.example.com` (no scheme) gets a synthetic `https://` prefix
//     for the href so the anchor is actually clickable.

export interface TextSegment {
  type: 'text'
  value: string
}

export interface LinkSegment {
  type: 'link'
  /** What the user typed. */
  value: string
  /** Clickable URL (may have a synthetic https:// prefix). */
  href: string
}

export type Segment = TextSegment | LinkSegment

// Match http://, https://, or www.* URLs. The character class for
// the path/query/fragment portion accepts most printable URL chars
// but excludes trailing punctuation that's almost always part of
// the surrounding sentence (the regex consumes it greedily, then
// we trim it back below).
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi

// Trailing chars that almost certainly belong to the surrounding
// sentence, not the URL. We strip these AFTER the regex matches
// so "Check (google.com)" links "google.com" without the paren.
const TRAILING_PUNCT_RE = /[.,!?:;\)\]\}>"']+$/

/**
 * Split a message body into ordered text + link segments. Empty
 * input returns a single text segment of length 0 so the caller
 * can map without a null check.
 */
export function linkifySegments(input: string): Segment[] {
  if (!input) return [{ type: 'text', value: '' }]

  const out: Segment[] = []
  let cursor = 0

  // `matchAll` over the global regex.
  for (const m of input.matchAll(URL_RE)) {
    const start = m.index ?? 0
    let raw = m[0]
    // Strip trailing punctuation.
    const trailing = raw.match(TRAILING_PUNCT_RE)
    if (trailing) {
      raw = raw.slice(0, raw.length - trailing[0].length)
    }
    if (raw.length === 0) continue

    // Emit preceding text segment.
    if (start > cursor) {
      out.push({ type: 'text', value: input.slice(cursor, start) })
    }

    // Synthesize https:// for bare www.* matches.
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    out.push({ type: 'link', value: raw, href })

    cursor = start + raw.length
  }

  if (cursor < input.length) {
    out.push({ type: 'text', value: input.slice(cursor) })
  }
  if (out.length === 0) {
    // No matches at all — return the whole string as one text segment.
    out.push({ type: 'text', value: input })
  }
  return out
}
