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

/**
 * The single, hardcoded primary-admin identity for the studio. This
 * email is treated as `owner` in three independent places:
 *
 *   1. `getAppRole()` below — even without a profile row, the email
 *      check resolves to 'owner'.
 *   2. The DB triggers on `intern_users` (migration
 *      `protect_owner_account_checkmarkaudio`) — coerce role/position
 *      back to owner on any UPDATE and refuse DELETE.
 *   3. `fetchProfile()` in AuthContext — synthesizes an owner profile
 *      if the Supabase lookup fails, so transient query problems can
 *      never lock the owner out.
 *
 * If you need to change the primary owner, update this constant AND
 * the DB triggers in the same change set. Do not change just one.
 */
export const OWNER_EMAIL = 'checkmarkaudio@gmail.com'

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

/**
 * Resolve the effective app role for a signed-in user.
 *
 * `authEmail` is optional — pass the `user.email` from Supabase Auth so
 * the owner-email check can fire even when `profile` is null (for
 * example, while the `intern_users` lookup is still in flight, erroring,
 * or RLS is misconfigured). This is the strongest guarantee that
 * `checkmarkaudio@gmail.com` ALWAYS resolves to 'owner' regardless of
 * what the profile row looks like.
 */
export function getAppRole(profile: TeamMember | null, authEmail?: string | null): AppRole {
  // Owner-email pin: if the signed-in auth email matches OWNER_EMAIL,
  // resolve as owner regardless of profile state. Supabase Auth already
  // verified the password before this runs, so this cannot be spoofed.
  if (normalizeEmail(authEmail) === OWNER_EMAIL) return 'owner'

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
