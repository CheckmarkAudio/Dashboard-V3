export type PortalStyle = 'classic' | 'soft-gold' | 'studio'
// New preference generation makes the approved redesign everyone's starting point.
// Older choices remain stored for rollback; choices made after rollout are respected.
export const APPEARANCE_KEY = 'checkmark-portal-style-v2'
export function isPortalStyle(value: unknown): value is PortalStyle {
  return value === 'classic' || value === 'soft-gold' || value === 'studio'
}
export function resolvePortalStyle(value: unknown): PortalStyle {
  return isPortalStyle(value) ? value : 'soft-gold'
}
