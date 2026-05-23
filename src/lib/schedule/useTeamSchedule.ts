// Fetches recurring schedule rules + one-off blocks for a date range
// (optionally scoped to one member) and returns the expanded flat
// list ready to render. Subscribes to realtime so the admin Work
// Scheduler reflects approvals + new member requests instantly.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type {
  ExpandedSchedule,
  ScheduleBlock,
  ScheduleRecurring,
} from '../../types'
import { expandSchedule, type DateRange } from './expand'

export interface UseTeamScheduleOptions {
  /** Inclusive date range (YYYY-MM-DD). */
  range: DateRange
  /** Limit to one member; omit for all team schedules. */
  memberId?: string
  /**
   * When true, includes status='pending' blocks in `expanded`. When
   * false, only approved entries are returned. Use false for
   * team-wide views (calendar overlay) so pending proposals don't
   * pollute everyone's view; use true for the member's own widget
   * and the admin review pane.
   */
  includePending?: boolean
}

export interface UseTeamScheduleResult {
  recurring: ScheduleRecurring[]
  blocks: ScheduleBlock[]
  expanded: ExpandedSchedule[]
  /** All pending blocks in range (handy for admin's review queue). */
  pendingBlocks: ScheduleBlock[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useTeamSchedule({
  range,
  memberId,
  includePending = false,
}: UseTeamScheduleOptions): UseTeamScheduleResult {
  const [recurring, setRecurring] = useState<ScheduleRecurring[]>([])
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stable cache key for the deps — range object identity churns on
  // every render in most callers, but its serialized form does not.
  const rangeKey = `${range.from}|${range.to}`

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Recurring rules — fetch active rules whose effective window
      // overlaps the requested range (or is unbounded). Server-side
      // filter avoids pulling years of stale rules.
      let recurringQuery = supabase
        .from('team_schedule_recurring')
        .select('*')
        .eq('active', true)
        .or(`effective_from.is.null,effective_from.lte.${range.to}`)
        .or(`effective_until.is.null,effective_until.gte.${range.from}`)
      if (memberId) recurringQuery = recurringQuery.eq('member_id', memberId)

      // Blocks — overlap with range. starts_at < range.to+1day AND
      // ends_at >= range.from. We use a slightly padded to-bound
      // (+1 day) so blocks ending late on the last day are caught.
      const rangeEndPad = new Date(`${range.to}T23:59:59.999Z`).toISOString()
      const rangeStart = new Date(`${range.from}T00:00:00.000Z`).toISOString()
      let blocksQuery = supabase
        .from('team_schedule_blocks')
        .select('*')
        .lte('starts_at', rangeEndPad)
        .gte('ends_at', rangeStart)
      if (memberId) blocksQuery = blocksQuery.eq('member_id', memberId)

      const [recurringRes, blocksRes] = await Promise.all([
        recurringQuery,
        blocksQuery,
      ])

      if (recurringRes.error) throw recurringRes.error
      if (blocksRes.error) throw blocksRes.error

      setRecurring((recurringRes.data ?? []) as ScheduleRecurring[])
      setBlocks((blocksRes.data ?? []) as ScheduleBlock[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }, [rangeKey, memberId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // Realtime — any change to either table within scope triggers a
  // refetch. Schedule data is tiny (single-digit rows per member per
  // week) so refetch-on-change is simpler than diffing payloads.
  useEffect(() => {
    const channel = supabase
      .channel(`team_schedule_${memberId ?? 'all'}_${rangeKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_schedule_recurring' }, () => {
        void fetchAll()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_schedule_blocks' }, () => {
        void fetchAll()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchAll, memberId, rangeKey])

  const expanded = useMemo(() => {
    const blocksForExpand = includePending
      ? blocks
      : blocks.filter((b) => b.status === 'approved')
    return expandSchedule({ recurring, blocks: blocksForExpand, range })
  }, [recurring, blocks, range, includePending])

  const pendingBlocks = useMemo(
    () => blocks.filter((b) => b.status === 'pending'),
    [blocks],
  )

  return { recurring, blocks, expanded, pendingBlocks, loading, error, refresh: fetchAll }
}
