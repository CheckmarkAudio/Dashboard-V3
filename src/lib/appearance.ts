export type PortalStyle = 'classic' | 'soft-gold' | 'studio'
export const APPEARANCE_KEY = 'checkmark-portal-style'
export function isPortalStyle(value: unknown): value is PortalStyle {
  return value === 'classic' || value === 'soft-gold' || value === 'studio'
}
export function resolvePortalStyle(value: unknown): PortalStyle {
  return isPortalStyle(value) ? value : 'classic'
}
