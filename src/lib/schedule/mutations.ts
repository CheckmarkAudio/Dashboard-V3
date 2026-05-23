// Thin Supabase-write wrappers for the scheduler. Admin functions
// hit the table directly under RLS (is_team_admin checks server-side);
// member functions for the request/withdraw flow also use direct
// table writes with the policy enforcing member_id = auth.uid() AND
// status = 'pending'. No RPCs needed — RLS does the gating.

import { supabase } from '../supabase'
import type {
  ScheduleBlock,
  ScheduleRecurring,
  Weekday,
} from '../../types'

// ─── Recurring rules ───────────────────────────────────────────────

export interface CreateRecurringInput {
  member_id: string
  weekday: Weekday
  start_time: string // HH:MM or HH:MM:SS
  end_time: string
  effective_from?: string | null
  effective_until?: string | null
  note?: string | null
}

export async function createRecurring(
  input: CreateRecurringInput,
  createdBy: string,
): Promise<ScheduleRecurring> {
  const { data, error } = await supabase
    .from('team_schedule_recurring')
    .insert({
      member_id: input.member_id,
      weekday: input.weekday,
      start_time: normalizeTime(input.start_time),
      end_time: normalizeTime(input.end_time),
      effective_from: input.effective_from ?? null,
      effective_until: input.effective_until ?? null,
      note: input.note ?? null,
      created_by: createdBy,
      active: true,
    })
    .select()
    .single()
  if (error) throw error
  return data as ScheduleRecurring
}

export async function updateRecurring(
  id: string,
  patch: Partial<Omit<ScheduleRecurring, 'id' | 'member_id' | 'created_at' | 'updated_at'>>,
): Promise<ScheduleRecurring> {
  const safePatch: Record<string, unknown> = { ...patch }
  if (typeof safePatch.start_time === 'string') {
    safePatch.start_time = normalizeTime(safePatch.start_time as string)
  }
  if (typeof safePatch.end_time === 'string') {
    safePatch.end_time = normalizeTime(safePatch.end_time as string)
  }
  const { data, error } = await supabase
    .from('team_schedule_recurring')
    .update(safePatch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ScheduleRecurring
}

export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await supabase
    .from('team_schedule_recurring')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── One-off blocks (admin direct add) ─────────────────────────────

export interface CreateBlockInput {
  member_id: string
  starts_at: string // ISO
  ends_at: string
  note?: string | null
  /** Admin direct-add bypasses pending — defaults to approved. */
  status?: 'pending' | 'approved'
}

export async function createBlockAsAdmin(
  input: CreateBlockInput,
  adminId: string,
): Promise<ScheduleBlock> {
  const status = input.status ?? 'approved'
  const { data, error } = await supabase
    .from('team_schedule_blocks')
    .insert({
      member_id: input.member_id,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      note: input.note ?? null,
      status,
      requested_by: adminId,
      approved_by: status === 'approved' ? adminId : null,
      reviewed_at: status === 'approved' ? new Date().toISOString() : null,
    })
    .select()
    .single()
  if (error) throw error
  return data as ScheduleBlock
}

export async function deleteBlock(id: string): Promise<void> {
  const { error } = await supabase
    .from('team_schedule_blocks')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Admin review (approve / deny) ─────────────────────────────────

export async function approveBlock(
  id: string,
  adminId: string,
  reviewerNote?: string | null,
): Promise<ScheduleBlock> {
  const { data, error } = await supabase
    .from('team_schedule_blocks')
    .update({
      status: 'approved',
      approved_by: adminId,
      reviewed_at: new Date().toISOString(),
      reviewer_note: reviewerNote ?? null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ScheduleBlock
}

export async function denyBlock(
  id: string,
  adminId: string,
  reviewerNote?: string | null,
): Promise<ScheduleBlock> {
  const { data, error } = await supabase
    .from('team_schedule_blocks')
    .update({
      status: 'denied',
      approved_by: adminId,
      reviewed_at: new Date().toISOString(),
      reviewer_note: reviewerNote ?? null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ScheduleBlock
}

// ─── Member-side: request + withdraw ───────────────────────────────

export async function requestScheduleBlock(input: {
  member_id: string
  starts_at: string
  ends_at: string
  note?: string | null
}): Promise<ScheduleBlock> {
  // RLS enforces member_id = auth.uid() AND status = 'pending' AND
  // requested_by = auth.uid().
  const { data, error } = await supabase
    .from('team_schedule_blocks')
    .insert({
      member_id: input.member_id,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      note: input.note ?? null,
      status: 'pending',
      requested_by: input.member_id,
    })
    .select()
    .single()
  if (error) throw error
  return data as ScheduleBlock
}

/**
 * Member withdraws their own pending request. RLS allows DELETE
 * only when the row is theirs AND still pending.
 */
export async function withdrawScheduleRequest(id: string): Promise<void> {
  await deleteBlock(id)
}

// ─── Small helpers ─────────────────────────────────────────────────

/**
 * Postgres `time` columns accept HH:MM but our reads come back as
 * HH:MM:SS — normalize on the way in so round-trip equality works.
 */
function normalizeTime(t: string): string {
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`
  return t
}
