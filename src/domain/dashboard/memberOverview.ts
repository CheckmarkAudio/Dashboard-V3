import { getKPITrend } from '../../lib/kpi'
import type { MemberKPI, MemberKPIEntry } from '../../types'

/**
 * Five stages of the Checkmark Audio business flywheel, rendered in
 * causal order on every member Overview:
 *
 *   Deliver  → quality of work completed today
 *   Capture  → evidence collected (submissions / must-dos logged)
 *   Share    → outbound amplification (not yet tracked per-member;
 *              placeholder until the flywheel event ledger lands)
 *   Attract  → inbound momentum (same status)
 *   Book     → confirmed sessions today
 *
 * These are authoritative stage names for the member-facing visual.
 * Admin Analytics will derive the *real* flywheel percentages from the
 * forthcoming `flywheel_events` ledger (Phase 2). Until then, the member
 * widget uses the best locally-available proxy for each stage and shows
 * `null` for unbacked stages so the UI can render them muted instead of
 * fabricating a number.
 */
export type FlywheelStage = 'Deliver' | 'Capture' | 'Share' | 'Attract' | 'Book'

export interface FlywheelChartDatum {
  name: FlywheelStage
  /** Percentage 0-100, or `null` if the stage has no backing data yet. */
  pct: number | null
  /** True when the value is a real measurement, false when it is a placeholder. */
  backed: boolean
}

export function buildMemberFlywheelChartData(
  dailyCompletion: number,
  sessionCount: number,
  mustDoComplete: boolean,
  primaryKpi: MemberKPI | null,
  kpiEntries: MemberKPIEntry[],
): FlywheelChartDatum[] {
  const latestKpi = kpiEntries[kpiEntries.length - 1]?.value ?? null
  const kpiPct = primaryKpi && primaryKpi.target_value && latestKpi !== null
    ? Math.min(100, Math.round((Number(latestKpi) / Number(primaryKpi.target_value)) * 100))
    : null

  // Deliver blends daily task completion with KPI attainment when both
  // signals are present, falling back to whichever one we have.
  const deliverPct = kpiPct !== null
    ? Math.round((dailyCompletion + kpiPct) / 2)
    : dailyCompletion

  // Book reflects whether the member actually had booked work today.
  // `sessionCount > 0` is a binary proxy until the booking→session chain
  // exists; we scale linearly up to 3 sessions as "fully booked."
  const bookPct = sessionCount === 0 ? 0 : Math.min(100, Math.round((sessionCount / 3) * 100))

  return [
    { name: 'Deliver', pct: deliverPct, backed: true },
    { name: 'Capture', pct: mustDoComplete ? 100 : 0, backed: true },
    { name: 'Share', pct: null, backed: false },
    { name: 'Attract', pct: null, backed: false },
    { name: 'Book', pct: bookPct, backed: true },
  ]
}

export function getKpiTrendLabel(entries: MemberKPIEntry[]): 'up' | 'down' | 'flat' | null {
  if (entries.length === 0) return null
  return getKPITrend(entries)
}
