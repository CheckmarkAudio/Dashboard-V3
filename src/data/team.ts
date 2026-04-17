export type TeamProfile = {
  id: string
  name: string
  initial: string
  role: string
  positions: string[]
  bio: string
  email: string
  website?: string
  socials?: { platform: string; url: string }[]
  // Admin-only fields
  dateJoined: string
  status: 'Active' | 'Inactive'
}

// Pre-onboarding cleanup: the hardcoded Jordan Lee / Sam Rivera / Alex
// Kim / Taylor Morgan / Taylor Morganson demo profiles were removed
// here. The pages that consumed this (Profile, MyTeam, Content) will
// render empty states until their next refactor switches them to the
// real `intern_users` Supabase table. That refactor is queued on the
// todo list. For now, an empty TEAM keeps the UI honest — visitors
// see no fake people on the Members / Content / profile surfaces.
export const TEAM: TeamProfile[] = []

export function getTeamMember(id: string): TeamProfile | undefined {
  return TEAM.find(m => m.id === id)
}
