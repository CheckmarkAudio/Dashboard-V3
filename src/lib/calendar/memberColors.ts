// 2026-05-27 — Per-member calendar color palette.
//
// Returns CSS color strings (NOT Tailwind class names) so the same
// shape can be produced from either:
//   - a hashed-fallback palette (when the member has no avatar or
//     extraction fails), OR
//   - a live RGB sampled from their profile picture via
//     `extractDominantColor()` in extractAvatarColor.ts
//
// Per Bridget: "make the colors designated to each profile change
// color to match the overall color of our profile pictures... make
// that change dynamically so when we change our image, our
// designated color shifts to fit the color of it. so for example
// check mark will be gold because its standout color is gold etc."

import type { RGB } from './extractAvatarColor'

export interface MemberColor {
  /** Block fill — `rgba(...)` at ~15 % alpha so overlapping shifts blend. */
  bg: string
  /** Block border — same hue at ~40 % alpha. */
  border: string
  /** Text on the block — lightened version of the hue, readable on dark mode. */
  text: string
  /** Solid hue for status dots, left stripes, etc. */
  accent: string
}

// 10-color stable fallback palette (Tailwind 400-step values translated
// to RGB). When a member has no avatar OR canvas extraction fails for
// any reason, their member id hashes into one of these.
const PALETTE_RGB: RGB[] = [
  { r: 167, g: 139, b: 250 }, // violet-400
  { r: 52,  g: 211, b: 153 }, // emerald-400
  { r: 56,  g: 189, b: 248 }, // sky-400
  { r: 251, g: 191, b: 36  }, // amber-400
  { r: 251, g: 113, b: 133 }, // rose-400
  { r: 34,  g: 211, b: 238 }, // cyan-400
  { r: 232, g: 121, b: 249 }, // fuchsia-400
  { r: 163, g: 230, b: 53  }, // lime-400
  { r: 251, g: 146, b: 60  }, // orange-400
  { r: 45,  g: 212, b: 191 }, // teal-400
]

function hashId(id: string): number {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Lighten an RGB triple for readable text on a low-alpha block fill.
 * Adds ~80 toward white on each channel and clamps at 255. Works well
 * for our dark calendar surface; very light source colors collapse
 * to near-white which still reads on the tinted block.
 */
function lighten(rgb: RGB): string {
  return `rgb(${Math.min(255, rgb.r + 80)}, ${Math.min(255, rgb.g + 80)}, ${Math.min(255, rgb.b + 80)})`
}

/** Turn an RGB triple into the four CSS strings the calendar needs. */
export function memberColorFromRGB(rgb: RGB): MemberColor {
  const { r, g, b } = rgb
  // 2026-05-27 — bumped fill 0.15 → 0.30 + border 0.40 → 0.65 per
  // Bridget: "turn up opacity." Overlap still blends visibly (two
  // 0.30 fills layer to ~0.51 effective) but solo blocks now read
  // as a confident tint instead of a wash.
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.30)`,
    border: `rgba(${r}, ${g}, ${b}, 0.65)`,
    text: lighten(rgb),
    accent: `rgb(${r}, ${g}, ${b})`,
  }
}

/**
 * Default member color when we don't have (or can't sample) the
 * member's avatar yet. Hashes the id to one of the 10 palette tints
 * so the same person is always the same color until the avatar
 * sample lands.
 */
export function memberColor(memberId: string | null | undefined): MemberColor {
  const palette = memberId ? PALETTE_RGB[hashId(memberId) % PALETTE_RGB.length] : PALETTE_RGB[0]
  return memberColorFromRGB(palette ?? PALETTE_RGB[0]!)
}
