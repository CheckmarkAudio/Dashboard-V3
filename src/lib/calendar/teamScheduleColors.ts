// 2026-07-28 — Locked per-member colors for the Team Schedule grid
// redesign (see docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md "Locked
// decisions"). Director approved these six exact colors across three
// mockup rounds, matched by first name since the real team was named
// explicitly. Anyone not in this list falls back to the existing
// avatar-extraction system (`teamMemberColors` / `memberColor`) so a
// newly-added team member never breaks.
//
// This map is a stand-in for the "customizable per-member schedule
// colors" admin-Settings feature already logged in
// 00_PRIORITY_QUEUE.md — replace with a real per-member setting when
// that ships, rather than growing this table by hand.

import type { MemberColor } from './memberColors'
import { memberColor } from './memberColors'

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function solid(hex: string, darkText: string): MemberColor {
  const { r, g, b } = hexToRgb(hex)
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.30)`,
    border: `rgba(${r}, ${g}, ${b}, 0.65)`,
    text: darkText,
    accent: hex,
  }
}

const LOCKED_FIRST_NAME_COLORS: Record<string, MemberColor> = {
  bridget: solid('#E0532A', '#3A1206'),
  checkmark: solid('#C9A84C', '#241d08'),
  christian: solid('#378ADD', '#042C53'),
  matthan: solid('#A8A69C', '#2C2C2A'),
  richard: solid('#639922', '#173404'),
  tony: solid('#E24B4A', '#501313'),
}

/**
 * Resolves the color a member's Team Schedule row/blocks should use:
 * locked pick first, then the avatar-derived color already computed
 * elsewhere on the page, then the hashed-id fallback.
 */
export function resolveScheduleColor(
  member: { id: string; display_name: string | null | undefined },
  teamMemberColors: Map<string, MemberColor>,
): MemberColor {
  const firstName = (member.display_name ?? '').trim().split(/\s+/)[0]?.toLowerCase()
  const locked = firstName ? LOCKED_FIRST_NAME_COLORS[firstName] : undefined
  return locked ?? teamMemberColors.get(member.id) ?? memberColor(member.id)
}
