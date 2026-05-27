// 2026-05-27 — Per-member color palette for the calendar schedule
// overlay.
//
// Per Bridget's direction: "make us all different colors, it doesn't
// make sense to repeat the icons of one person multiple times down
// the calendar since its a full time block with no breaks in time."
//
// Each member gets a stable, distinguishable hue derived from their
// id, so overlapping shifts on the week grid read by COLOR rather
// than by lane position — and each shift renders as a single
// continuous block (no segment-merge avatar repetition).
//
// Palette is hand-picked at low-saturation tints so the colored
// blocks blend with the existing dark-mode pastel chrome (matches
// PR B's session-type palette aesthetic). 10 entries cycle for
// teams above 10 members; collisions are visually minor since the
// avatar inside the block disambiguates.

export interface MemberColor {
  /** Block fill, ~15% alpha. */
  bg: string
  /** Block border, slightly higher alpha for definition. */
  border: string
  /** Text on the block fill — high contrast on dark mode. */
  text: string
  /** Solid accent for left-edge stripes or status dots. */
  accent: string
}

const PALETTE: MemberColor[] = [
  { bg: 'bg-violet-500/20',  border: 'border-violet-400/40',  text: 'text-violet-100',  accent: 'bg-violet-400'  },
  { bg: 'bg-emerald-500/20', border: 'border-emerald-400/40', text: 'text-emerald-100', accent: 'bg-emerald-400' },
  { bg: 'bg-sky-500/20',     border: 'border-sky-400/40',     text: 'text-sky-100',     accent: 'bg-sky-400'     },
  { bg: 'bg-amber-500/20',   border: 'border-amber-400/40',   text: 'text-amber-100',   accent: 'bg-amber-400'   },
  { bg: 'bg-rose-500/20',    border: 'border-rose-400/40',    text: 'text-rose-100',    accent: 'bg-rose-400'    },
  { bg: 'bg-cyan-500/20',    border: 'border-cyan-400/40',    text: 'text-cyan-100',    accent: 'bg-cyan-400'    },
  { bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-400/40', text: 'text-fuchsia-100', accent: 'bg-fuchsia-400' },
  { bg: 'bg-lime-500/20',    border: 'border-lime-400/40',    text: 'text-lime-100',    accent: 'bg-lime-400'    },
  { bg: 'bg-orange-500/20',  border: 'border-orange-400/40',  text: 'text-orange-100',  accent: 'bg-orange-400'  },
  { bg: 'bg-teal-500/20',    border: 'border-teal-400/40',    text: 'text-teal-100',    accent: 'bg-teal-400'    },
]

/**
 * Stable hash from a member id (uuid) to a small integer. djb2
 * hash — fast, good distribution for short strings, no deps. Bitwise
 * `| 0` keeps the result in a 32-bit signed range.
 */
function hashId(id: string): number {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0
  }
  // Force non-negative for the modulo operation below.
  return Math.abs(h)
}

/**
 * Resolve a member id to a stable color from the palette. Same id
 * always returns the same color across page-loads / users / devices.
 */
export function memberColor(memberId: string | null | undefined): MemberColor {
  if (!memberId) return PALETTE[0]!
  const idx = hashId(memberId) % PALETTE.length
  return PALETTE[idx]!
}
