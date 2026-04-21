import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import {
  useChecklist,
  type PendingTaskEdit,
  type PreloadedChecklist,
} from '../hooks/useChecklist'
import { supabase, withSupabaseRetry } from '../lib/supabase'
import { flush as perfFlush, time as perfTime } from '../lib/perfTrace'
import { localDateKey } from '../lib/dates'
import type { DailyNote, DeliverableSubmission, MemberKPI, MemberKPIEntry } from '../types'

interface MemberSessionSummary {
  id: string
  client_name: string | null
  start_time: string
  end_time: string
  session_type: string
  status: string
  room: string | null
}

/**
 * Shape returned by the `member_overview_snapshot` Supabase RPC.
 * Mirrors the `jsonb_build_object(...)` in migration
 * `member_overview_snapshot_rpc`. Keep in sync when the RPC evolves.
 */
interface SnapshotPayload {
  today_note: DailyNote | null
  must_do: {
    submission_type: string
    submission: DeliverableSubmission | null
  }
  today_sessions: MemberSessionSummary[]
  primary_kpi: MemberKPI | null
  kpi_entries: MemberKPIEntry[]
  // The checklist shape mirrors `PreloadedChecklist` exactly so it can
  // be passed straight into useChecklist's preload slot without any
  // field renaming. Metadata fields (source/frequency/date_key/
  // target_user_id) let the hook validate the preload matches its
  // context before consuming it.
  checklist: PreloadedChecklist
  streak: number
}

interface MemberOverviewContextValue {
  daily: ReturnType<typeof useChecklist>
  loading: boolean
  error: string | null
  streak: number
  todayNote: DailyNote | null
  mustDoSubmission: DeliverableSubmission | null
  todaySessions: MemberSessionSummary[]
  primaryKpi: MemberKPI | null
  kpiEntries: MemberKPIEntry[]
  refetch: () => Promise<void>
}

const MemberOverviewContext = createContext<MemberOverviewContextValue | null>(null)

// --- Stub `daily` used before the snapshot RPC resolves. ---------------
// Consumers guard on `loading` so they render skeletons during this
// window; the stub exists purely so the context value is type-complete
// before the inner Loaded provider mounts. All methods are no-ops.
const STUB_DAILY: ReturnType<typeof useChecklist> = {
  items: [],
  grouped: {},
  loading: true,
  instanceId: null,
  toggleItem: async () => {},
  completedCount: 0,
  totalCount: 0,
  percentage: 0,
  reload: async () => {},
  proposeAddItem: async () => ({ error: null as string | null }),
  proposeRenameItem: async () => ({ error: null as string | null }),
  proposeDeleteItem: async () => ({ error: null as string | null }),
  addItem: async () => ({ error: null as string | null }),
  renameItem: async () => ({ error: null as string | null }),
  deleteItem: async () => ({ error: null as string | null }),
  pendingRequests: [],
  pendingByItemId: new Map<string, PendingTaskEdit>(),
  pendingAdds: [],
  reloadPendingRequests: async () => {},
}

/**
 * Overview state provider — Phase 1 Step 2C architecture.
 *
 *   1. Outer provider fires a single `member_overview_snapshot` RPC
 *      when a profile lands. No other network calls on the cold path.
 *   2. Before the snapshot arrives, a stub context value is published
 *      (loading=true, empty fields, stub `daily`). Widgets render
 *      their normal skeletons — same UX as the pre-2C loading window.
 *   3. When the snapshot lands, `MemberOverviewLoaded` mounts fresh
 *      and calls `useChecklist` with a preload derived from the
 *      snapshot's checklist subset. `useChecklist`'s useState
 *      initializers consume the preload and the hook skips its first
 *      reload — zero redundant round-trips on cold start.
 *   4. Refetch re-runs the RPC. Non-checklist fields (streak, note,
 *      sessions, kpi, etc.) update via the new snapshot. Note:
 *      checklist state inside `daily` is not auto-rehydrated on
 *      refetch — consumers that need a fresh checklist after refetch
 *      should call `daily.reload()` explicitly. (No current consumer
 *      does; the only refetch caller is BookingWidget after a new
 *      session, which doesn't touch the checklist.)
 */
export function MemberOverviewProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Same "real batch completed for this profile" gate introduced in PR #4.
  // Prevents the perf flush firing before the snapshot actually lands for
  // the current profile id.
  const lastLoadedProfileId = useRef<string | null>(null)

  const refetch = useCallback(async () => {
    if (!profile) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Single-round-trip Overview snapshot. Server resolves role-
      // dependent rules (submission_type from team_members.position),
      // runs 7 sub-queries in one transaction, returns one JSON blob.
      // Replaces the pre-2C 4-wave waterfall (overview:batch +
      // overview:streak + checklist:lookup + checklist:items).
      // `supabase.rpc(...)` returns a PostgrestFilterBuilder (thenable),
      // not a real Promise. `withSupabaseRetry<T>()` expects `() => Promise<T>`,
      // so wrap in an async function to get a true Promise resolution.
      // Same idiom the old code accidentally handled via `Promise.all([...])`.
      const res = await perfTime('overview:snapshot', () =>
        withSupabaseRetry(async () =>
          supabase.rpc('member_overview_snapshot', {
            p_user_id: profile.id,
            p_date: localDateKey(),
          }),
        ),
      )
      if (res.error) throw res.error
      setSnapshot(res.data as unknown as SnapshotPayload)
      lastLoadedProfileId.current = profile.id
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load today workspace')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Fire the perfTrace flush once the snapshot has resolved for the
  // current profile. Matches the `lastLoadedProfileId` gate pattern
  // from PR #4 — keeps the waterfall from flushing on a stale state.
  useEffect(() => {
    if (
      profile &&
      lastLoadedProfileId.current === profile.id &&
      !loading &&
      snapshot
    ) {
      perfFlush('Overview')
    }
  }, [profile, loading, snapshot])

  const stubValue = useMemo<MemberOverviewContextValue>(
    () => ({
      daily: STUB_DAILY,
      loading,
      error,
      streak: 0,
      todayNote: null,
      mustDoSubmission: null,
      todaySessions: [],
      primaryKpi: null,
      kpiEntries: [],
      refetch,
    }),
    [loading, error, refetch],
  )

  if (!snapshot) {
    return (
      <MemberOverviewContext.Provider value={stubValue}>
        {children}
      </MemberOverviewContext.Provider>
    )
  }

  return (
    <MemberOverviewLoaded
      snapshot={snapshot}
      outerLoading={loading}
      error={error}
      refetch={refetch}
    >
      {children}
    </MemberOverviewLoaded>
  )
}

/**
 * Inner provider that owns the `useChecklist` call. Mounting is gated
 * on the snapshot being present, so the preload is always defined when
 * this component mounts — useChecklist's useState initializers consume
 * it synchronously on first render.
 */
function MemberOverviewLoaded({
  snapshot,
  outerLoading,
  error,
  refetch,
  children,
}: {
  snapshot: SnapshotPayload
  outerLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  children: ReactNode
}) {
  // `snapshot.checklist` is already shaped as `PreloadedChecklist` —
  // the RPC returns the metadata fields (source/frequency/date_key/
  // target_user_id) that useChecklist validates against its own
  // (frequency, date, user) context before consuming. Pass through directly.
  const daily = useChecklist('daily', new Date(), undefined, snapshot.checklist)

  const value = useMemo<MemberOverviewContextValue>(
    () => ({
      daily,
      loading: outerLoading || daily.loading,
      error,
      streak: snapshot.streak,
      todayNote: snapshot.today_note,
      mustDoSubmission: snapshot.must_do.submission,
      todaySessions: snapshot.today_sessions,
      primaryKpi: snapshot.primary_kpi,
      kpiEntries: snapshot.kpi_entries,
      refetch,
    }),
    [daily, outerLoading, error, snapshot, refetch],
  )

  return (
    <MemberOverviewContext.Provider value={value}>
      {children}
    </MemberOverviewContext.Provider>
  )
}

export function useMemberOverviewContext() {
  const context = useContext(MemberOverviewContext)
  if (!context) throw new Error('useMemberOverviewContext must be used within MemberOverviewProvider')
  return context
}
