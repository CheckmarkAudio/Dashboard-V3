// 2026-05-27 — Hook that resolves a per-member calendar color for a
// team list, sampling each avatar in parallel via canvas.
//
// Cache lives at module scope keyed by avatar URL — so:
//   - re-renders never re-extract a known URL
//   - when a member uploads a new avatar (URL changes) the next
//     read drives a fresh sample of the new image
//   - members without an avatar fall back to the hashed palette
//     (cached under `fallback:<id>` so they don't get rehashed every
//     render either)
//
// Returns a Map<memberId, MemberColor> the caller can hand to each
// block render. Callers should NOT call hooks per-block — this hook
// is intentionally called once at the page level + the result map
// is looked up O(1) per render.

import { useEffect, useMemo, useState } from 'react'
import { extractDominantColor } from './extractAvatarColor'
import { memberColor, memberColorFromRGB, type MemberColor } from './memberColors'

interface MemberLite {
  id: string
  avatar_url?: string | null
}

// Keyed by URL (`fallback:<id>` when no avatar). Survives across
// renders + components — the same member shown on multiple surfaces
// resolves to the same color from one extraction.
const colorCache = new Map<string, MemberColor>()

export function useTeamMemberColors(members: MemberLite[]): Map<string, MemberColor> {
  const [, setVersion] = useState(0)

  // Stable dependency string so the effect doesn't re-run on every
  // parent render (members may be a new array reference each time
  // even when nothing changed about the actual avatar URLs).
  const cacheKey = useMemo(
    () => members.map((m) => `${m.id}:${m.avatar_url ?? ''}`).join(','),
    [members],
  )

  useEffect(() => {
    let cancelled = false
    let added = false

    Promise.all(
      members.map(async (m) => {
        const key = m.avatar_url ?? `fallback:${m.id}`
        if (colorCache.has(key)) return
        if (!m.avatar_url) {
          colorCache.set(key, memberColor(m.id))
          added = true
          return
        }
        try {
          const rgb = await extractDominantColor(m.avatar_url)
          if (cancelled) return
          colorCache.set(
            key,
            rgb ? memberColorFromRGB(rgb) : memberColor(m.id),
          )
          added = true
        } catch {
          colorCache.set(key, memberColor(m.id))
          added = true
        }
      }),
    ).then(() => {
      if (!cancelled && added) setVersion((v) => v + 1)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  // Build the result map fresh each render — the underlying entries
  // come from the long-lived module cache; the wrapper Map itself is
  // cheap (10-50 entries max). Re-rendering after the effect bumps
  // `version` re-runs this loop and picks up newly-extracted colors.
  const result = new Map<string, MemberColor>()
  for (const m of members) {
    const key = m.avatar_url ?? `fallback:${m.id}`
    result.set(m.id, colorCache.get(key) ?? memberColor(m.id))
  }
  return result
}
