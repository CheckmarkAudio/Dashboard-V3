// Phase 3.1 — react-query factory for team_members ("team members").
//
// Centralizes the select shape + query key so every page consuming
// team-member rows shares one cache entry. The default `list()` mirrors
// the `select('*')` most callers currently use; narrower variants can
// be added as each page is migrated (`listBasics`, `listByManager`,
// etc.) without touching this file's public shape.

import { supabase } from '../supabase'
import type { TeamMember } from '../../types'

export const teamMemberKeys = {
  all: ['team-members'] as const,
  list: () => [...teamMemberKeys.all, 'list'] as const,
  byManager: (managerId: string) => [...teamMemberKeys.all, 'by-manager', managerId] as const,
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
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
