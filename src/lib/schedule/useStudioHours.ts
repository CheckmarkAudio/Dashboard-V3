// Hook for studio_hours_of_operation — one row per weekday with
// open_time / close_time / active. Returns the 7 rows indexed by
// weekday so callers can do `byWeekday[3]` for Wednesday without
// scanning the array.
//
// Realtime sub means an admin's edit in Settings → Studio Hours
// reflects on every open /calendar tab within a beat.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { StudioHours, Weekday } from '../../types'

export interface UseStudioHoursResult {
  hours: StudioHours[]
  /** Sparse map indexed by weekday (0=Sun..6=Sat). Missing keys =
   *  no row yet (shouldn't happen after the seed migration but is
   *  treated as "closed" by callers). */
  byWeekday: Partial<Record<Weekday, StudioHours>>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useStudioHours(): UseStudioHoursResult {
  const [hours, setHours] = useState<StudioHours[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: queryError } = await supabase
        .from('studio_hours_of_operation')
        .select('*')
        .order('weekday')
      if (queryError) throw queryError
      setHours((data ?? []) as StudioHours[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load studio hours')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // Realtime — any insert/update/delete on the table refetches. The
  // table is tiny (max 7 rows) so refetch-on-change is simpler than
  // diffing payloads.
  useEffect(() => {
    const channel = supabase
      .channel('studio_hours_of_operation_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'studio_hours_of_operation' },
        () => {
          void fetchAll()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const byWeekday = useMemo(() => {
    const map: Partial<Record<Weekday, StudioHours>> = {}
    hours.forEach((h) => {
      map[h.weekday] = h
    })
    return map
  }, [hours])

  return { hours, byWeekday, loading, error, refresh: fetchAll }
}
