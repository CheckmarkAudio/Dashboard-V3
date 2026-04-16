import type { TeamMember } from '../../types'

export type AppRole = 'owner' | 'admin' | 'member'

export type AppCapability =
  | 'view_member_app'
  | 'view_admin_app'
  | 'manage_members'
  | 'manage_roles'
  | 'manage_templates'
  | 'manage_bookings'
  | 'manage_sessions'
  | 'view_team_analytics'
  | 'manage_workspace_defaults'

const OWNER_EMAIL = 'checkmarkaudio@gmail.com'

const ROLE_CAPABILITIES: Record<AppRole, AppCapability[]> = {
  owner: [
    'view_member_app',
    'view_admin_app',
    'manage_members',
    'manage_roles',
    'manage_templates',
    'manage_bookings',
    'manage_sessions',
    'view_team_analytics',
    'manage_workspace_defaults',
  ],
  admin: [
    'view_member_app',
    'view_admin_app',
    'manage_members',
    'manage_templates',
    'manage_bookings',
    'manage_sessions',
    'view_team_analytics',
    'manage_workspace_defaults',
  ],
  member: [
    'view_member_app',
  ],
}

function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase()
}

export function getAppRole(profile: TeamMember | null): AppRole {
  if (!profile) return 'member'
  if (
    normalizeEmail(profile.email) === OWNER_EMAIL ||
    profile.position === 'owner' ||
    profile.role === 'owner'
  ) {
    return 'owner'
  }
  if (profile.role === 'admin') return 'admin'
  return 'member'
}

export function getRoleCapabilities(role: AppRole): AppCapability[] {
  return ROLE_CAPABILITIES[role]
}

export function hasCapability(
  role: AppRole,
  capability: AppCapability,
): boolean {
  return ROLE_CAPABILITIES[role].includes(capability)
}

export function canAccessAdmin(role: AppRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function isAtLeastRole(role: AppRole, minimum: AppRole): boolean {
  const rank: Record<AppRole, number> = { member: 0, admin: 1, owner: 2 }
  return rank[role] >= rank[minimum]
}
