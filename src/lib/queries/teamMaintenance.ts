// 2026-05-19 — Team Maintenance Checklist queries.
//
// Backs the new Checklist widget on /daily. Items live in
// `team_maintenance_items`; per-period check log lives in
// `team_maintenance_completions`. The list RPC joins both + computes
// the current period key server-side so the client never has to think
// about timezones or week-boundary math.

import { supabase } from '../supabase'

export type MaintenanceCadence = 'daily' | 'weekly' | 'monthly'

export interface MaintenanceItem {
  id: string
  title: string
  description: string | null
  cadence: MaintenanceCadence
  sort_order: number
  created_at: string
  /** The current period key — `YYYY-MM-DD` / `YYYY-Www` / `YYYY-MM`. */
  period_key: string
  /** null when no one has checked this item for the current period. */
  checked_at: string | null
  checked_by: string | null
  checked_by_name: string | null
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
  return data as MaintenanceItem[]
}

/**
 * Idempotent toggle. `check=true` records a check for the current
 * period (no-op if already checked); `check=false` removes the
 * current-period row.
 */
export async function toggleMaintenanceCheck(
  itemId: string,
  check: boolean,
): Promise<{ item_id: string; period_key: string; checked: boolean }> {
  const { data, error } = await supabase.rpc('team_maintenance_toggle', {
    p_item_id: itemId,
    p_check: check,
  })
  if (error) {
    console.error('[queries/teamMaintenance] toggleMaintenanceCheck failed:', error)
    throw new Error(error.message)
  }
  return data as { item_id: string; period_key: string; checked: boolean }
}

// ─── Admin CRUD ─────────────────────────────────────────────────────

export interface CreateMaintenanceItemPayload {
  title: string
  cadence: MaintenanceCadence
  description?: string | null
  sort_order?: number
}

export async function adminCreateMaintenanceItem(
  payload: CreateMaintenanceItemPayload,
): Promise<MaintenanceItem> {
  const { data, error } = await supabase.rpc('admin_team_maintenance_create', {
    p_title: payload.title,
    p_cadence: payload.cadence,
    p_description: payload.description ?? null,
    p_sort_order: payload.sort_order ?? 0,
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
