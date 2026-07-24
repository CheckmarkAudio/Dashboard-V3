// Shared form atoms for the task-request / quick-assign modals (PR #17).
//
// Pulled out of the individual modals so (a) the member-side request
// modal and the admin-side create flow don't drift, (b) the admin
// approval modal can reuse the flywheel picker at approve-time.

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import {
  FLYWHEEL_STAGES as FLYWHEEL_STAGES_CANON,
  type FlywheelStage as FlywheelStageKey,
} from '../../../lib/flywheel/stages'

// ─── Flywheel stage picker ──────────────────────────────────────────
//
// Backed by the canonical flywheel module (src/lib/flywheel/stages) so
// the five stages + their colors never drift from the rest of the app.
// The picker's value is the canonical stage key
// (discovery/workflow/production/education/growth), stored on
// `assigned_tasks.category` (and task_requests.category).

export type FlywheelStage = FlywheelStageKey

export const FLYWHEEL_STAGES: { key: FlywheelStage; label: string; dot: string; fg: string; ring: string; bg: string }[] =
  FLYWHEEL_STAGES_CANON.map((s) => ({
    key: s.key,
    label: s.label,
    dot: s.dot,
    fg: s.fg,
    ring: s.ring,
    bg: s.bg,
  }))

export function FlywheelStagePicker({
  value,
  onChange,
  label = 'Flywheel stage',
  allowNone = true,
}: {
  value: FlywheelStage | null
  onChange: (next: FlywheelStage | null) => void
  label?: string
  allowNone?: boolean
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-light mb-1.5">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-pressed={value === null}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
              value === null
                ? '-translate-y-px bg-surface text-text ring-2 ring-text/60 shadow-sm'
                : 'bg-surface-alt text-text-muted ring-1 ring-border hover:text-text'
            }`}
          >
            {value === null && <Check size={12} strokeWidth={3} aria-hidden="true" />}
            None
          </button>
        )}
        {FLYWHEEL_STAGES.map((s) => {
          const active = value === s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onChange(s.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                active
                  ? `${s.bg} ${s.fg} -translate-y-px ring-2 ring-text/60 shadow-sm`
                  : 'bg-surface-alt text-text-muted ring-1 ring-border hover:text-text'
              }`}
            >
              {active ? (
                <Check size={12} strokeWidth={3} aria-hidden="true" />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
              )}
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Recurrence picker ──────────────────────────────────────────────
//
// Simple pill row: Off · Daily · Weekly · Monthly · Custom. Maps to
// the `recurrence_spec` jsonb column on task_requests. Selecting any
// non-Off value triggers a "coming soon" toast from the parent
// (engine lands in a later PR) — but the choice still persists so
// saved requests activate automatically when the engine ships.
//
// The value is serialized to a RRULE-style JSON shape for forward
// compatibility with a full RFC-5545 picker later.

export type RecurrenceFrequency = 'off' | 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurrenceSpec {
  frequency: Exclude<RecurrenceFrequency, 'off'>
  interval: number
  // Future RRULE extensions: byDay, until, count. Parked for now.
}

export function recurrenceToSpec(freq: RecurrenceFrequency): RecurrenceSpec | null {
  if (freq === 'off') return null
  return { frequency: freq, interval: 1 }
}

/**
 * Server-side spec — narrowed to the cadences the database CHECK
 * constraint accepts (`daily | weekly | monthly`). 'custom' is a UI
 * placeholder for the future RFC-5545 picker; for now it serializes
 * to `null` so the row persists without a recurrence and the picker
 * still surfaces "Custom…" as a known coming-soon affordance.
 */
export type ServerRecurrenceSpec = {
  frequency: 'daily' | 'weekly' | 'monthly'
  interval: number
}

export function recurrenceToServerSpec(
  freq: RecurrenceFrequency,
): ServerRecurrenceSpec | null {
  if (freq === 'off' || freq === 'custom') return null
  return { frequency: freq, interval: 1 }
}

export function RecurrencePicker({
  value,
  onChange,
  hideDaily = false,
}: {
  value: RecurrenceFrequency
  onChange: (next: RecurrenceFrequency) => void
  /** Bookings only support Weekly / Monthly cadences. Pass true to
   *  drop the Daily pill from the picker. */
  hideDaily?: boolean
}) {
  // 2026-05-07 — engine shipped (migration 20260507120000) so the
  // "coming soon" hint under the picker was retired. Selecting Weekly
  // / Monthly now actually spawns instances on cadence; tasks via the
  // assigned_tasks recurrence_engine cron, bookings via the parallel
  // sessions cron. 'custom' stays as a UI placeholder for the future
  // RFC-5545 picker — it serializes to null server-side.
  const options: { key: RecurrenceFrequency; label: string }[] = [
    { key: 'off',     label: 'Off' },
    ...(hideDaily ? [] : [{ key: 'daily' as const, label: 'Daily' }]),
    { key: 'weekly',  label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'custom',  label: 'Custom…' },
  ]
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-light mb-1.5">
        Recurring
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ring-1 transition-colors ${
                active
                  ? 'bg-gold/15 text-gold ring-gold/40'
                  : 'bg-surface-alt text-text-muted ring-border hover:text-text'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Field label wrapper ────────────────────────────────────────────
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-light mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
