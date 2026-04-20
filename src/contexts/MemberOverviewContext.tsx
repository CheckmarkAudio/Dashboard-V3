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
import { useChecklist } from '../hooks/useChecklist'
import { supabase, withSupabaseRetry } from '../lib/supabase'
import { flush as perfFlush, time as perfTime } from '../lib/perfTrace'
import { localDateKey } from '../lib/dates'
import { getMustDoConfig } from '../lib/mustDoConfig'
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

export function MemberOverviewProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const daily = useChecklist('daily', new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [todayNote, setTodayNote] = useState<DailyNote | null>(null)
  const [mustDoSubmission, setMustDoSubmission] = useState<DeliverableSubmission | null>(null)
  const [todaySessions, setTodaySessions] = useState<MemberSessionSummary[]>([])
  const [primaryKpi, setPrimaryKpi] = useState<MemberKPI | null>(null)
  const [kpiEntries, setKpiEntries] = useState<MemberKPIEntry[]>([])
  // Tracks the profile id whose Overview batch has actually completed.
  // Used exclusively as the flush-trace gate below. Without this, the
  // flush effect can fire prematurely: on cold start `refetch` runs
  // once with `profile = null`, hits its early-return, and sets
  // `loading = false`. When `profile` arrives a tick later, the flush
  // effect re-evaluates and sees `profile && !loading && !daily.loading`
  // = true before the second `refetch` pass (triggered by the new
  // profile identity) has started setting loading back to true. Gating
  // on this ref means "a real batch completed for THIS profile" —
  // mirrors the 2A' dedupe pattern in AuthContext.
  const lastLoadedProfileId = useRef<string | null>(null)

  const refetch = useCallback(async () => {
    if (!profile) {
      setLoading(false)
      return
    }

    setLoading(true)
    const today = localDateKey()
    const mustDoConfig = getMustDoConfig(profile.position ?? 'intern')

    try {
      // Wrap the whole parallel fetch in the retry helper so a transient
      // auth-lock error on any one query retries the entire batch rather
      // than surfacing the failure to the user.
      const runBatch = () => withSupabaseRetry(() => Promise.all([
        supabase.from('team_daily_notes').select('*').eq('intern_id', profile.id).eq('note_date', today).maybeSingle(),
        supabase
          .from('deliverable_submissions')
          .select('*')
          .eq('intern_id', profile.id)
          .eq('submission_date', today)
          .eq('submission_type', mustDoConfig.submissionType)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('sessions')
          .select('id, client_name, start_time, end_time, session_type, status, room')
          .eq('session_date', today)
          .eq('created_by', profile.id)
          .order('start_time'),
        supabase.from('member_kpis').select('*').eq('intern_id', profile.id).limit(1),
        supabase
          .from('team_checklist_instances')
          .select('id, period_date')
          .eq('frequency', 'daily')
          .eq('intern_id', profile.id)
          .order('period_date', { ascending: false })
          .limit(14),
      ]))
      const [noteRes, submissionRes, sessionsRes, kpisRes, instancesRes] = await perfTime('overview:batch', runBatch)

      if (noteRes.error) throw noteRes.error
      if (submissionRes.error) throw submissionRes.error
      if (sessionsRes.error) throw sessionsRes.error
      if (kpisRes.error) throw kpisRes.error
      if (instancesRes.error) throw instancesRes.error

      setTodayNote((noteRes.data as DailyNote | null) ?? null)
      setMustDoSubmission((submissionRes.data as DeliverableSubmission | null) ?? null)
      setTodaySessions((sessionsRes.data as MemberSessionSummary[]) ?? [])

      const primary = ((kpisRes.data ?? [])[0] as MemberKPI | undefined) ?? null
      setPrimaryKpi(primary)
      if (primary) {
        const entriesRes = await supabase
          .from('member_kpi_entries')
          .select('*')
          .eq('kpi_id', primary.id)
          .order('entry_date')
          .limit(30)
        if (entriesRes.error) throw entriesRes.error
        setKpiEntries((entriesRes.data as MemberKPIEntry[]) ?? [])
      } else {
        setKpiEntries([])
      }

      const instances = (instancesRes.data ?? []) as Array<{ id: string }>
      if (instances.length > 0) {
        const itemsRes = await perfTime('overview:streak', () => supabase
          .from('team_checklist_items')
          .select('instance_id, is_completed')
          .in('instance_id', instances.map((instance) => instance.id)),
        )
        if (itemsRes.error) throw itemsRes.error

        const byInstance = new Map<string, boolean[]>()
        for (const row of (itemsRes.data ?? []) as Array<{ instance_id: string; is_completed: boolean }>) {
          const current = byInstance.get(row.instance_id) ?? []
          current.push(row.is_completed)
          byInstance.set(row.instance_id, current)
        }

        let nextStreak = 0
        for (const instance of instances) {
          const items = byInstance.get(instance.id) ?? []
          if (items.length === 0) break
          if (items.every(Boolean)) nextStreak += 1
          else break
        }
        setStreak(nextStreak)
      } else {
        setStreak(0)
      }

      // Mark this profile's batch as successfully loaded — this is what
      // unlocks the perfFlush gate below. Only set on the success path;
      // errored loads shouldn't emit an incomplete waterfall.
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

  // Fire the perfTrace flush once the Overview's above-the-fold data
  // has fully resolved.
  //
  // The gate must include `lastLoadedProfileId.current === profile.id`
  // in addition to the loading flags. Without that, a race on cold
  // start fires the flush prematurely:
  //
  //   1. Mount: profile = null, loading = true, daily.loading = true.
  //   2. refetch runs with profile = null → early-returns, loading → false.
  //      useChecklist.reload runs with userId = null → daily.loading → false.
  //   3. Profile arrives from AuthContext. This effect re-evaluates.
  //      At this instant: profile = truthy, loading = false,
  //      daily.loading = false. Without the profile-id gate, flush fires
  //      HERE — before the second `refetch` pass has started setting
  //      loading back to true and firing real perfTime checkpoints.
  //   4. refetch re-memoizes with new profile, its useEffect re-runs,
  //      loading flips back to true, overview:batch fires, etc. —
  //      but the flush already happened, so the buffer never emits.
  //
  // Setting `lastLoadedProfileId.current = profile.id` only inside the
  // success path of refetch means the gate stays closed until a real
  // batch has completed for the current profile. Mirrors the
  // `handledForUserId` dedupe ref in AuthContext (PR #2).
  //
  // `flush` is idempotent per label so repeated renders don't re-emit.
  // No-op in production unless `localStorage.debugPerf = '1'`.
  useEffect(() => {
    if (
      profile &&
      lastLoadedProfileId.current === profile.id &&
      !loading &&
      !daily.loading
    ) {
      perfFlush('Overview')
    }
  }, [profile, loading, daily.loading])

  const value = useMemo(
    () => ({
      daily,
      loading: loading || daily.loading,
      error,
      streak,
      todayNote,
      mustDoSubmission,
      todaySessions,
      primaryKpi,
      kpiEntries,
      refetch,
    }),
    [daily, loading, error, streak, todayNote, mustDoSubmission, todaySessions, primaryKpi, kpiEntries, refetch],
  )

  return <MemberOverviewContext.Provider value={value}>{children}</MemberOverviewContext.Provider>
}

export function useMemberOverviewContext() {
  const context = useContext(MemberOverviewContext)
  if (!context) throw new Error('useMemberOverviewContext must be used within MemberOverviewProvider')
  return context
}
