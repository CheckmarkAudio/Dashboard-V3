// ============================================================================
// Member lifecycle — client wrappers for the admin edge functions that own
// auth-account state. Every add / archive / reactivate / delete / reset-link
// action routes through these so the auth.users account and the team_members
// profile can never drift apart again (drift is what caused the recurring
// "A user with this email address has already been registered" failures).
//
//   admin-remove-member      → inspect / archive / unarchive / permanent_delete
//   admin-generate-setup-link → password set/reset link for existing members
// ============================================================================

import { supabase } from '../supabase'
import { extractEdgeFunctionError } from '../edgeFunctionError'

export interface MemberActivityItem {
  key: string
  label: string
  count: number
}

export interface MemberInspectResult {
  activity: MemberActivityItem[]
  totalActivity: number
  canPermanentlyDelete: boolean
}

export type RemoveMode = 'inspect' | 'archive' | 'unarchive' | 'permanent_delete'

interface RemoveMemberResponse {
  ok: boolean
  error?: string
  action?: string
  activity?: MemberActivityItem[]
  total_activity?: number
  can_permanently_delete?: boolean
  auth_warning?: string | null
}

async function callRemoveMember(
  memberId: string,
  mode: RemoveMode,
  confirm?: string,
): Promise<RemoveMemberResponse> {
  const { data, error } = await supabase.functions.invoke<RemoveMemberResponse>(
    'admin-remove-member',
    { body: { member_id: memberId, mode, ...(confirm ? { confirm } : {}) } },
  )
  if (error || !data?.ok) {
    const msg = data?.error ?? (await extractEdgeFunctionError(error, 'Member action failed'))
    throw new Error(msg)
  }
  return data
}

export async function inspectMember(memberId: string): Promise<MemberInspectResult> {
  const data = await callRemoveMember(memberId, 'inspect')
  return {
    activity: data.activity ?? [],
    totalActivity: data.total_activity ?? 0,
    canPermanentlyDelete: data.can_permanently_delete ?? false,
  }
}

/** Archive: mark inactive + end-dated AND disable their login. */
export async function archiveMember(memberId: string): Promise<{ authWarning: string | null }> {
  const data = await callRemoveMember(memberId, 'archive')
  return { authWarning: data.auth_warning ?? null }
}

/** Unarchive: mark active again AND re-enable their login. */
export async function unarchiveMember(memberId: string): Promise<{ authWarning: string | null }> {
  const data = await callRemoveMember(memberId, 'unarchive')
  return { authWarning: data.auth_warning ?? null }
}

/**
 * Permanent delete: removes BOTH the login account and the profile row.
 * The edge function only allows this when the member has zero linked
 * history (otherwise old tasks/posts would lose their attribution).
 */
export async function permanentlyDeleteMember(memberId: string): Promise<void> {
  await callRemoveMember(memberId, 'permanent_delete', 'PERMANENTLY DELETE')
}

/**
 * Generate a password set/reset link for an EXISTING member. Does not
 * touch their current password — safe for active members who are locked
 * out. (Pending members get fresh links via admin-create-member's
 * resend_invite path instead.)
 */
export async function generateMemberSetupLink(userId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    error?: string
    setup_link?: string
  }>('admin-generate-setup-link', {
    body: { user_id: userId, redirect_to: `${window.location.origin}/login` },
  })
  if (error || !data?.ok || !data.setup_link) {
    const msg = data?.error ?? (await extractEdgeFunctionError(error, 'Could not generate setup link'))
    throw new Error(msg)
  }
  return data.setup_link
}
