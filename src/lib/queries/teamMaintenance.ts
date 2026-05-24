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
export type MaintenanceClaimType = 'anyone' | 'everyone'

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
  sort_order: number
  created_at: string
  /** The current period key — `YYYY-MM-DD` / `YYYY-Www` / `YYYY-MM`. */
  period_key: string
  /** All completions for the CURRENT period. Empty array when nobody
   *  has checked it off yet. For 'anyone' items the array has at
   *  most one entry; for 'everyone' items, one entry per checked
   *  member. */
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
  return (data as Array<Partial<MaintenanceItem>>).map((row) => ({
    ...(row as MaintenanceItem),
    completions: Array.isArray(row.completions) ? row.completions : [],
    // Defensive default for rows persisted before the migration shipped
    // (shouldn't happen since the column has a default, but the row
    // shape is JSON-ish coming back from the RPC so cheap to guard).
    claim_type: (row.claim_type as MaintenanceClaimType) ?? 'anyone',
  }))
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
