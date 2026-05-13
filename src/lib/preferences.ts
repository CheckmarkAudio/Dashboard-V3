// Per-profile preferences helper.
//
// Reads/writes the `preferences` jsonb on `team_members`. Both
// ThemeContext and useWorkspaceLayout call through this so the
// cross-device sync logic lives in one place.
//
// Pattern is read-modify-write client-side (no SQL `||` merge): the
// preferences subtree is small and last-write-wins is fine for UI
// prefs. Concurrent edits from two tabs would clobber each other,
// but the worst case is "the layout I set on tab B reverted to
// what tab A last saved" — annoying, not corrupting.

import { supabase } from './supabase'

/**
 * Read the full `preferences` jsonb for the given member. Returns an
 * empty object when not set or when the row is missing — callers
 * never have to null-check.
 */
export async function fetchUserPreferences(
  userId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('team_members')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    // Don't bubble — pref reads are best-effort. The caller falls
    // back to localStorage / defaults.
    console.warn('[preferences] fetch failed:', error.message)
    return {}
  }
  return (data?.preferences as Record<string, unknown> | null) ?? {}
}

/**
 * Set a single preference key for the given member. Reads the
 * current preferences, merges in the new key, writes back.
 *
 * Fire-and-forget on the caller side: the helper logs failures
 * (network blip, RLS) but doesn't throw, so a failed save won't
 * break the UI. The write IS awaited internally so we don't drop
 * the read-modify-write race against another rapid save.
 */
export async function setUserPreference(
  userId: string,
  key: string,
  value: unknown,
): Promise<void> {
  try {
    const current = await fetchUserPreferences(userId)
    const next = { ...current, [key]: value }
    const { error } = await supabase
      .from('team_members')
      .update({ preferences: next })
      .eq('id', userId)
    if (error) {
      console.warn(`[preferences] set ${key} failed:`, error.message)
    }
  } catch (err) {
    console.warn(`[preferences] set ${key} threw:`, err)
  }
}
