// 2026-05-19 — Team Maintenance Checklist queries.
//
// Backs the new Checklist widget on /daily. Items live in
// `team_maintenance_items`; per-period check log lives in
// `team_maintenance_completions`. The list RPC joins both + computes
// the current period key server-side so the client never has to think
// about timezones or week-boundary math.
//
// 2026-05-25 (PR B) — claim_type extension:
//   * 'anyone'   (default, legacy) → one completion per period total
//   * 'everyone'                   → one completion per period PER member
// `team_maintenance_list()` now returns a `completions` JSONB array
// (instead of a single checked_by/at pair). For anyone items there's
// at most one entry; for everyone items there are 0..N entries (one
// per member who's checked off so far this period).

import { supabase } from '../supabase'

export type MaintenanceCadence = 'daily' | 'weekly' | 'monthly'
// 2026-05-25 — renamed 'everyone' → 'all_members' + added 'individual'.
// 'individual' items require an `assigned_to` member.
export type MaintenanceClaimType = 'anyone' | 'all_members' | 'individual'

export interface MaintenanceCompletion {
  checked_by: string
  checked_by_name: string | null
  checked_at: string
}

export interface MaintenanceItem {
  id: string
  title: string
  description: string | null
  cadence: MaintenanceCadence
  claim_type: MaintenanceClaimType
  /** When claim_type='individual', the single member responsible. */
  assigned_to: string | null
  assigned_to_name: string | null
  sort_order: number
  created_at: string
  /** The current period key — `YYYY-MM-DD` / `YYYY-Www` / `YYYY-MM`. */
  period_key: string
  /** All completions for the CURRENT period. Empty array when nobody
   *  has checked it off yet. For 'anyone' + 'individual' items the
   *  array has at most one entry; for 'all_members' items, one entry
   *  per member who's checked off so far. */
  completions: MaintenanceCompletion[]
}

export const maintenanceKeys = {
  all: ['team-maintenance'] as const,
  list: () => [...maintenanceKeys.all, 'list'] as const,
}

export async function fetchMaintenanceList(): Promise<MaintenanceItem[]> {
  const { data, error } = await supabase.rpc('team_maintenance_list')
  if (error) {
    console.error('[queries/teamMaintenance] fetchMaintenanceList failed:', error)
    throw new Error(error.message)
  }
  if (!Array.isArray(data)) return []
  return (data as Array<Partial<MaintenanceItem> & { claim_type?: string }>).map((row) => {
    // 2026-05-25 — gracefully map legacy 'everyone' value to the
    // renamed 'all_members' for any cached response from before
    // the migration ran. Server-side rows have already been
    // updated; this is defense-in-depth for stale client caches.
    const rawType = row.claim_type
    const claim_type: MaintenanceClaimType =
      rawType === 'all_members' || rawType === 'individual' || rawType === 'anyone'
        ? rawType
        : (rawType === 'everyone' ? 'all_members' : 'anyone')
    return {
      ...(row as MaintenanceItem),
      completions: Array.isArray(row.completions) ? row.completions : [],
      claim_type,
      assigned_to: row.assigned_to ?? null,
      assigned_to_name: row.assigned_to_name ?? null,
    }
  })
}

/**
 * Toggle the caller's check state for an item. For 'anyone' items
 * this also claims the period (replaces any other member's claim).
 * For 'everyone' items this only affects the caller's own row.
 */
export async function toggleMaintenanceCheck(
  itemId: string,
  check: boolean,
): Promise<{
  item_id: string
  period_key: string
  claim_type: MaintenanceClaimType
  checked: boolean
}> {
  const { data, error } = await supabase.rpc('team_maintenance_toggle', {
    p_item_id: itemId,
    p_check: check,
  })
  if (error) {
    console.error('[queries/teamMaintenance] toggleMaintenanceCheck failed:', error)
    throw new Error(error.message)
  }
  return data as {
    item_id: string
    period_key: string
    claim_type: MaintenanceClaimType
    checked: boolean
  }
}

// ─── Admin CRUD ─────────────────────────────────────────────────────

export interface CreateMaintenanceItemPayload {
  title: string
  cadence: MaintenanceCadence
  description?: string | null
  sort_order?: number
  claim_type?: MaintenanceClaimType
  /** Required when claim_type === 'individual'. */
  assigned_to?: string | null
}

export async function adminCreateMaintenanceItem(
  payload: CreateMaintenanceItemPayload,
): Promise<MaintenanceItem> {
  const { data, error } = await supabase.rpc('admin_team_maintenance_create', {
    p_title: payload.title,
    p_cadence: payload.cadence,
    p_description: payload.description ?? null,
    p_sort_order: payload.sort_order ?? 0,
    p_claim_type: payload.claim_type ?? 'anyone',
    p_assigned_to: payload.assigned_to ?? null,
  })
  if (error) {
    console.error('[queries/teamMaintenance] adminCreateMaintenanceItem failed:', error)
    throw new Error(error.message)
  }
  return data as MaintenanceItem
}

export interface UpdateMaintenanceItemPayload {
  title?: string
  cadence?: MaintenanceCadence
  description?: string | null
  clearDescription?: boolean
  sort_order?: number
  claim_type?: MaintenanceClaimType
  assigned_to?: string | null
  /** Explicit clear (overrides assigned_to). Used when admin
   *  switches mode away from 'individual' and the prior assignee
   *  should be wiped server-side. */
  clearAssignedTo?: boolean
}

export async function adminUpdateMaintenanceItem(
  itemId: string,
  payload: UpdateMaintenanceItemPayload,
): Promise<MaintenanceItem> {
  const { data, error } = await supabase.rpc('admin_team_maintenance_update', {
    p_item_id: itemId,
    p_title: payload.title ?? null,
    p_cadence: payload.cadence ?? null,
    p_description: payload.description ?? null,
    p_clear_description: payload.clearDescription ?? false,
    p_sort_order: payload.sort_order ?? null,
    p_claim_type: payload.claim_type ?? null,
    p_assigned_to: payload.assigned_to ?? null,
    p_clear_assigned_to: payload.clearAssignedTo ?? false,
  })
  if (error) {
    console.error('[queries/teamMaintenance] adminUpdateMaintenanceItem failed:', error)
    throw new Error(error.message)
  }
  return data as MaintenanceItem
}

export async function adminArchiveMaintenanceItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_team_maintenance_archive', {
    p_item_id: itemId,
  })
  if (error) {
    console.error('[queries/teamMaintenance] adminArchiveMaintenanceItem failed:', error)
    throw new Error(error.message)
  }
}
