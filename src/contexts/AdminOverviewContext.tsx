import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loadAdminOverviewSnapshot, loadAdminTodaySchedule, loadPendingApprovalRequests } from '../domain/dashboard/adminOverview'
import type {
  AdminOverviewSnapshot,
  EnrichedApprovalRequest,
} from '../domain/dashboard/adminOverview'
import type { CalendarEvent } from '../types'

interface AdminOverviewContextValue {
  snapshot: AdminOverviewSnapshot | null
  schedule: CalendarEvent[]
  approvalRequests: EnrichedApprovalRequest[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const AdminOverviewContext = createContext<AdminOverviewContextValue | null>(null)

export function AdminOverviewProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AdminOverviewSnapshot | null>(null)
  const [schedule, setSchedule] = useState<CalendarEvent[]>([])
  const [approvalRequests, setApprovalRequests] = useState<EnrichedApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSnapshot, nextSchedule, nextRequests] = await Promise.all([
        loadAdminOverviewSnapshot(),
        loadAdminTodaySchedule(),
        loadPendingApprovalRequests(),
      ])
      setSnapshot(nextSnapshot)
      setSchedule(nextSchedule)
      setApprovalRequests(nextRequests)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin overview')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const value = useMemo(
    () => ({ snapshot, schedule, approvalRequests, loading, error, refetch }),
    [snapshot, schedule, approvalRequests, loading, error, refetch],
  )

  return <AdminOverviewContext.Provider value={value}>{children}</AdminOverviewContext.Provider>
}

export function useAdminOverviewContext() {
  const context = useContext(AdminOverviewContext)
  if (!context) throw new Error('useAdminOverviewContext must be used within AdminOverviewProvider')
  return context
}
