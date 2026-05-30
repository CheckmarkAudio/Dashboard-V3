import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { fetchDmThreads, dmKeys } from '../../lib/queries/dms'

/**
 * Shared DM thread list query. Mirrors the notifications pattern
 * (`useTotalUnreadCount`): a 60s poll keeps the header badge fresh
 * without the caller subscribing to the full panel render.
 */
export function useDmThreads() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: dmKeys.list(),
    queryFn: fetchDmThreads,
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
  })
}

/** Total unread DM messages across all of the caller's threads. */
export function useDmUnreadCount(): number {
  const { data } = useDmThreads()
  return (data ?? []).reduce((acc, t) => acc + (t.unread_count ?? 0), 0)
}
