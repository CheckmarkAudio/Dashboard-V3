// Phase 3.1 — react-query factory for team_members ("team members").
//
// Centralizes the select shape + query key so every page consuming
// team-member rows shares one cache entry. The default `list()` mirrors
// the `select('*')` most callers currently use; narrower variants can
// be added as each page is migrated (`listBasics`, `listByManager`,
// etc.) without touching this file's public shape.

import { supabase } from '../supabase'
import type { TeamMember } from '../../types'

const DEV_TEAM_MEMBERS: TeamMember[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'jamie@example.test',
    display_name: 'Jamie Rivera',
    role: 'member',
    position: 'Studio',
    status: 'active',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'alex@example.test',
    display_name: 'Alex Morgan',
    role: 'member',
    position: 'Production',
    status: 'active',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'riley@example.test',
    display_name: 'Riley Chen',
    role: 'member',
    position: 'Marketing',
    status: 'active',
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'taylor@example.test',
    display_name: 'Taylor Brooks',
    role: 'member',
    position: 'Operations',
    status: 'active',
  },
]

export const teamMemberKeys = {
  all: ['team-members'] as const,
  list: () => [...teamMemberKeys.all, 'list'] as const,
  listAll: () => [...teamMemberKeys.all, 'list-all'] as const,
  byManager: (managerId: string) => [...teamMemberKeys.all, 'by-manager', managerId] as const,
}

/**
 * The shared ACTIVE-ROSTER query. Archived members (`status = 'inactive'`)
 * are excluded here so every consumer — team bubbles, assignee pickers,
 * overview/hub widgets, calendar cards, message dialogs — hides them
 * automatically without each having to remember to filter. Pending members
 * (mid-onboarding) stay visible. To manage or restore archived members, use
 * `fetchAllTeamMembers` (Settings → Archive and the Team Manager roster).
 *
 * Historical attribution is unaffected: code that resolves a name from a
 * stored id (e.g. `.in('id', ids)`) still finds archived members, because
 * that path doesn't go through this roster query.
 */
export async function fetchTeamMembers(): Promise<TeamMember[]> {
  // AuthContext uses a sessionless fake admin in local Vite development,
  // so Supabase correctly blocks roster reads. Keep the preview usable
  // with clearly synthetic data; production builds tree-shake this path.
  if (import.meta.env.DEV) return DEV_TEAM_MEMBERS

  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    // PostgreSQL `NULL <> 'inactive'` is unknown, not true. Include
    // legacy rows whose status predates the active/inactive field so
    // they remain available in assignee pickers.
    .or('status.is.null,status.neq.inactive')
    .order('display_name')
  if (error) throw error
  return (data ?? []) as TeamMember[]
}

/** Every member including archived — for admin management surfaces only. */
export async function fetchAllTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('display_name')
  if (error) throw error
  return (data ?? []) as TeamMember[]
}

/** Only archived (inactive) members, newest-archived-looking first by name. */
export async function fetchArchivedTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('status', 'inactive')
    .order('display_name')
  if (error) throw error
  return (data ?? []) as TeamMember[]
}

export async function fetchDirectReports(managerId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('managed_by', managerId)
    .order('display_name')
  if (error) throw error
  return (data ?? []) as TeamMember[]
}
