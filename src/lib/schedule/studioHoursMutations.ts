// Admin-only mutations for studio_hours_of_operation. RLS gates the
// writes server-side (is_team_admin()); the client UI also gates by
// admin role so non-admins never see the editor.

import { supabase } from '../supabase'
import type { StudioHours, Weekday } from '../../types'

/**
 * Upsert the hours for a given weekday. Convenience over a raw UPDATE
 * since the table has a UNIQUE constraint on weekday — the caller
 * doesn't need to know the row id, just the weekday.
 */
export async function updateStudioHour(input: {
  weekday: Weekday
  open_time: string  // HH:MM or HH:MM:SS
  close_time: string
  active: boolean
  updatedBy: string
}): Promise<StudioHours> {
  const { data, error } = await supabase
    .from('studio_hours_of_operation')
    .upsert(
      {
        weekday: input.weekday,
        open_time: normalizeTime(input.open_time),
        close_time: normalizeTime(input.close_time),
        active: input.active,
        updated_by: input.updatedBy,
      },
      { onConflict: 'weekday' },
    )
    .select()
    .single()
  if (error) throw error
  return data as StudioHours
}

function normalizeTime(t: string): string {
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`
  return t
}
