import { getKPITrend } from '../../lib/kpi'
import type { MemberKPI, MemberKPIEntry } from '../../types'

export interface FlywheelChartDatum {
  name: 'Tasks' | 'Sessions' | 'Must-Do' | 'KPI'
  pct: number
}

export function buildMemberPerformanceChartData(
  dailyCompletion: number,
  sessionCount: number,
  mustDoComplete: boolean,
  primaryKpi: MemberKPI | null,
  kpiEntries: MemberKPIEntry[],
): FlywheelChartDatum[] {
  const latestKpi = kpiEntries[kpiEntries.length - 1]?.value ?? null
  const kpiPct = primaryKpi && primaryKpi.target_value && latestKpi !== null
    ? Math.min(100, Math.round((Number(latestKpi) / Number(primaryKpi.target_value)) * 100))
    : 0

  return [
    { name: 'Tasks', pct: dailyCompletion },
    { name: 'Sessions', pct: Math.min(100, sessionCount * 25) },
    { name: 'Must-Do', pct: mustDoComplete ? 100 : 0 },
    { name: 'KPI', pct: kpiPct },
  ]
}

export function getKpiTrendLabel(entries: MemberKPIEntry[]): 'up' | 'down' | 'flat' | null {
  if (entries.length === 0) return null
  return getKPITrend(entries)
}
