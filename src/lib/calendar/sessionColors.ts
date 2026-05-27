// 2026-05-26 — Session-type pastel palette for calendar event blocks.
//
// Single source of truth for how the 5 booking types render across the
// calendar surfaces:
//   - Week-grid booking blocks         (Calendar.tsx)
//   - Day-card chip rows in the sidebar (CalendarDayCard.tsx)
//   - Booking detail modal accent      (BookingDetailModal.tsx)
//
// Driven by user direction (Izmahsa-inspired refresh): soft pastel
// category colors *by session type*, not by status. The studio
// aesthetic stays dark, so the bg fills are tuned to ~15 % saturation
// so they read as "category tint" rather than "loud sticker."
//
// Each color entry exposes four pre-built Tailwind class names so call
// sites can compose them cleanly without ad-hoc string assembly:
//
//   bg      — fill on the block / chip body
//   border  — same-hue border for definition over dark surfaces
//   text    — high-contrast label color on the pastel fill
//   accent  — solid hue (no alpha) for left-edge stripes, dot badges,
//             modal header accents, etc.

export type SessionTypeKey =
  | 'engineering'
  | 'music_lesson'
  | 'consultation'
  | 'training'
  | 'education'

export interface SessionTypeColor {
  bg: string
  border: string
  text: string
  accent: string
}

const PALETTE: Record<SessionTypeKey, SessionTypeColor> = {
  // Recording + mixing — the studio's bread-and-butter sessions.
  // Mint/emerald reads as "calm, focused work."
  engineering: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-400/30',
    text: 'text-emerald-100',
    accent: 'bg-emerald-400',
  },
  // Lessons get violet — distinct from sessions, evokes education.
  music_lesson: {
    bg: 'bg-violet-500/15',
    border: 'border-violet-400/30',
    text: 'text-violet-100',
    accent: 'bg-violet-400',
  },
  // Consultations + meetings — light sky reads as "talking, not making."
  consultation: {
    bg: 'bg-sky-500/15',
    border: 'border-sky-400/30',
    text: 'text-sky-100',
    accent: 'bg-sky-400',
  },
  // Training (staff onboarding, gear training). Amber sits visibly
  // between music_lesson violet and consultation sky.
  training: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-400/30',
    text: 'text-amber-100',
    accent: 'bg-amber-400',
  },
  // Education (artist dev cohorts, classes) — rose distinguishes from
  // 1:1 music_lesson violet without clashing.
  education: {
    bg: 'bg-rose-500/15',
    border: 'border-rose-400/30',
    text: 'text-rose-100',
    accent: 'bg-rose-400',
  },
}

// Anything we don't recognize falls back to a neutral slate so the
// block still renders correctly + obviously-uncategorized.
const FALLBACK: SessionTypeColor = {
  bg: 'bg-slate-500/15',
  border: 'border-slate-400/25',
  text: 'text-slate-100',
  accent: 'bg-slate-400',
}

/**
 * Resolve a booking's `type` string to the pre-built Tailwind class
 * set that surface needs. Pass any string; unknown values land on the
 * neutral slate fallback so render never breaks.
 */
export function sessionTypeColor(type: string | null | undefined): SessionTypeColor {
  if (!type) return FALLBACK
  return PALETTE[type as SessionTypeKey] ?? FALLBACK
}
