import type { BadgeVariant } from '../components/ui'

/**
 * Canonical position metadata.
 *
 * Lives here (instead of inline in TeamManager) so the Profile page,
 * MemberHighlights, AssignAdmin, and any future surface that needs
 * to render a position label or pill all reach for the same source
 * of truth. Adding a new position = one edit here, not nine.
 */
export interface PositionMeta {
  value: string
  /** Human-readable label shown next to a member's name. */
  label: string
  /** Badge color variant for the position pill. */
  badge: BadgeVariant
}

export const POSITIONS: PositionMeta[] = [
  { value: 'owner',              label: 'Owner / Lead Engineer', badge: 'gold' },
  { value: 'marketing_admin',    label: 'Marketing / Admin',     badge: 'success' },
  { value: 'artist_development', label: 'Artist Development',    badge: 'stage-share' },
  { value: 'intern',             label: 'Intern',                badge: 'info' },
  { value: 'engineer',           label: 'Audio Engineer',        badge: 'warning' },
  { value: 'producer',           label: 'Producer',              badge: 'stage-book' },
]

export function getPositionLabel(value: string | null | undefined): string {
  if (!value) return 'Team member'
  return POSITIONS.find((p) => p.value === value)?.label ?? value
}

export function getPositionVariant(value: string | null | undefined): BadgeVariant {
  if (!value) return 'neutral'
  return POSITIONS.find((p) => p.value === value)?.badge ?? 'neutral'
}
