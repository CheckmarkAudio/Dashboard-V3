// Per-member chat color (Lean 9 follow-up).
//
// Default color is hash-derived from the member's id so first
// render is consistent + recognizable without setup. Members can
// override via `team_members.preferences.chat_color` (a key in the
// palette below); the override flows through usePreference like
// theme + widget layout.
//
// Palette is Tailwind tokens that read well on both light + dark
// backgrounds. Keep it ≤10 entries — beyond that two members can
// still collide and the palette stops being individuating.

// 2026-05-17 — `rose` removed from the palette per user direction:
// reads too red/alarming for a friendly chat surface ("looks negative
// or alarming"). Existing stored overrides of `'rose'` fall through
// to the deterministic hash default since `CHAT_COLOR_KEYS.includes`
// no longer matches — no DB cleanup needed.
export const CHAT_COLOR_KEYS = [
  'gold',
  'emerald',
  'sky',
  'violet',
  'amber',
  'teal',
  'indigo',
  'pink',
  'lime',
] as const

export type ChatColorKey = (typeof CHAT_COLOR_KEYS)[number]

interface ChatColorTokens {
  /** Tailwind class for the sender_name text in the bubble. */
  text: string
  /** Tailwind class for the avatar ring accent (used as a thin border). */
  ring: string
  /** Hex used by `<MemberAvatar>` initial backgrounds. */
  hex: string
  /** Pretty label for the picker UI. */
  label: string
}

/**
 * Single source of truth for the palette. Each color reuses
 * existing Tailwind shades the rest of the app already loads, so
 * the bundle doesn't grow.
 */
export const CHAT_COLOR_TOKENS: Record<ChatColorKey, ChatColorTokens> = {
  gold:    { text: 'text-gold',          ring: 'ring-gold/40',          hex: '#C9A84C', label: 'Gold'    },
  emerald: { text: 'text-emerald-400',   ring: 'ring-emerald-400/40',   hex: '#34d399', label: 'Emerald' },
  sky:     { text: 'text-sky-400',       ring: 'ring-sky-400/40',       hex: '#38bdf8', label: 'Sky'     },
  violet:  { text: 'text-violet-400',    ring: 'ring-violet-400/40',    hex: '#a78bfa', label: 'Violet'  },
  amber:   { text: 'text-amber-400',     ring: 'ring-amber-400/40',     hex: '#fbbf24', label: 'Amber'   },
  teal:    { text: 'text-teal-400',      ring: 'ring-teal-400/40',      hex: '#2dd4bf', label: 'Teal'    },
  indigo:  { text: 'text-indigo-400',    ring: 'ring-indigo-400/40',    hex: '#818cf8', label: 'Indigo'  },
  pink:    { text: 'text-pink-400',      ring: 'ring-pink-400/40',      hex: '#f472b6', label: 'Pink'    },
  lime:    { text: 'text-lime-400',      ring: 'ring-lime-400/40',      hex: '#a3e635', label: 'Lime'    },
}

/**
 * Stable djb2-style hash → palette index. Strings can be UUIDs or
 * any other id; the only property we need is determinism (same id
 * → same color across refreshes + sessions).
 */
function hashStringToIndex(str: string, modulo: number): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h) % modulo
}

/**
 * Resolve a member's chat color. Owner always gets gold (brand-pin —
 * Checkmark's own messages read as the brand color sitewide).
 * Otherwise: override wins; otherwise the id deterministically
 * hashes into the palette.
 *
 * Pass `override` from `team_members.preferences.chat_color` (or
 * the auth profile when the caller IS the signed-in user). Unknown
 * override keys fall through to the hash default — robust against
 * future palette changes that drop an entry (e.g. the 2026-05-17
 * removal of `'rose'`).
 *
 * Pass `options.isOwner: true` for the owner row. This wins over
 * the override so the owner's color stays consistent across the
 * forum even if their preferences row somehow has a stale color.
 * (The picker in `ProfileEditor` is hidden for the owner so this
 * shouldn't drift in practice, but the hard override is a safety
 * net.)
 */
export function resolveChatColorKey(
  memberId: string | null | undefined,
  override?: unknown,
  options?: { isOwner?: boolean },
): ChatColorKey {
  if (options?.isOwner) return 'gold'
  if (typeof override === 'string' && CHAT_COLOR_KEYS.includes(override as ChatColorKey)) {
    return override as ChatColorKey
  }
  if (!memberId) return 'gold'
  const idx = hashStringToIndex(memberId, CHAT_COLOR_KEYS.length)
  return CHAT_COLOR_KEYS[idx] ?? 'gold'
}

export function chatColorTokens(key: ChatColorKey): ChatColorTokens {
  return CHAT_COLOR_TOKENS[key]
}
