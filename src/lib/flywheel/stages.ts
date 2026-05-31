// Canonical definition of the Checkmark flywheel "big five".
//
// SINGLE SOURCE OF TRUTH. Before this module the five stages were
// redefined in 4+ places with inconsistent casing (formAtoms,
// tasks/shared, types/index, domain/memberOverview). Everything now
// imports from here so labels, colors, order, and keys can never drift.
//
// The refined platform model (replaces the old
// deliver/capture/share/attract/book vocabulary):
//
//   discovery   — Discovery & Media          (content → inbound leads)
//   workflow    — Workflow & Administration   (booking, onboarding, conversion)
//   production  — Production & Completion      (deliver radio-ready work)
//   education   — Education & Community         (workshops, LMS, forum)
//   retention   — Retention & Advocacy          (recurring clients, reviews, re-engagement)
//
// Note: "retention" names the *action* that fuels growth — recurring
// bookings, 5-star reviews, reaching back out to past clients for deals /
// events. Growth itself is the outcome we observe across the whole loop.
//
// These keys match the `flywheel_events.stage` CHECK constraint and the
// `record_flywheel_event` RPC (migration 20260530140000).

export type FlywheelStage = 'discovery' | 'workflow' | 'production' | 'education' | 'retention'

export interface FlywheelStageMeta {
  key: FlywheelStage
  /** Short pill label, e.g. "Discovery". */
  label: string
  /** Full stage name, e.g. "Discovery & Media". */
  fullLabel: string
  /** One-line goal for tooltips / stage detail. */
  description: string
  /** Causal order around the loop (0-based). */
  order: number
  // Tailwind tokens (kept together so every surface styles a stage identically).
  dot: string
  text: string
  bg: string
  ring: string
  /** Stronger foreground for active/selected pills. */
  fg: string
  /** Raw hex for charting libs (recharts) that don't take Tailwind classes. */
  hex: string
}

export const FLYWHEEL_STAGES: FlywheelStageMeta[] = [
  {
    key: 'discovery', label: 'Discovery', fullLabel: 'Discovery & Media',
    description: 'Automated inbound traffic from content → leads.',
    order: 0,
    dot: 'bg-cyan-400', text: 'text-cyan-300', bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/30', fg: 'text-cyan-200', hex: '#22d3ee',
  },
  {
    key: 'workflow', label: 'Workflow', fullLabel: 'Workflow & Administration',
    description: 'Frictionless booking, onboarding, and conversion.',
    order: 1,
    dot: 'bg-orange-400', text: 'text-orange-300', bg: 'bg-orange-500/10', ring: 'ring-orange-500/30', fg: 'text-orange-200', hex: '#fb923c',
  },
  {
    key: 'production', label: 'Production', fullLabel: 'Production & Completion',
    description: 'Deliver radio-ready work efficiently, every time.',
    order: 2,
    dot: 'bg-blue-400', text: 'text-blue-300', bg: 'bg-blue-500/10', ring: 'ring-blue-500/30', fg: 'text-blue-200', hex: '#60a5fa',
  },
  {
    key: 'education', label: 'Education', fullLabel: 'Education & Community',
    description: 'Workshops, lessons, and community that build loyalty.',
    order: 3,
    dot: 'bg-violet-400', text: 'text-violet-300', bg: 'bg-violet-500/10', ring: 'ring-violet-500/30', fg: 'text-violet-200', hex: '#a78bfa',
  },
  {
    key: 'retention', label: 'Retention', fullLabel: 'Retention & Advocacy',
    description: 'Recurring clients, 5-star reviews, and re-engaging past clients — the action that fuels growth.',
    order: 4,
    dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30', fg: 'text-emerald-200', hex: '#34d399',
  },
]

export const FLYWHEEL_STAGE_KEYS: FlywheelStage[] = FLYWHEEL_STAGES.map((s) => s.key)

export const FLYWHEEL_STAGE_META: Record<FlywheelStage, FlywheelStageMeta> = FLYWHEEL_STAGES.reduce(
  (acc, s) => {
    acc[s.key] = s
    return acc
  },
  {} as Record<FlywheelStage, FlywheelStageMeta>,
)

export function isFlywheelStage(v: unknown): v is FlywheelStage {
  return typeof v === 'string' && (FLYWHEEL_STAGE_KEYS as string[]).includes(v)
}

export function flywheelStageMeta(key: string | null | undefined): FlywheelStageMeta | null {
  return key && isFlywheelStage(key) ? FLYWHEEL_STAGE_META[key] : null
}

/**
 * Map a legacy stage value (old vocabulary, any casing) to the new key.
 * Returns null for non-stage / unrecognized values so overloaded free
 * text (e.g. an old `category` of "Brand Knowledge") becomes "no stage".
 *
 *   deliver → production · capture → workflow · share → discovery
 *   attract → discovery  · book    → workflow
 */
export function normalizeLegacyStage(v: string | null | undefined): FlywheelStage | null {
  if (!v) return null
  const lower = v.trim().toLowerCase()
  if (isFlywheelStage(lower)) return lower
  switch (lower) {
    case 'deliver': return 'production'
    case 'capture': return 'workflow'
    case 'share': return 'discovery'
    case 'attract': return 'discovery'
    case 'book': return 'workflow'
    default: return null
  }
}
