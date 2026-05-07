// Shared form atoms for the task-request / quick-assign modals (PR #17).
//
// Pulled out of the individual modals so (a) the member-side request
// modal and the admin-side create flow don't drift, (b) the admin
// approval modal can reuse the flywheel picker at approve-time.

import type { ReactNode } from 'react'

// ─── Flywheel stage picker ──────────────────────────────────────────
//
// Source of truth for the five stages + their brand colors. The keys
// match `assigned_tasks.category` values historically used by the
// pre-PR-11 CreateTaskModal so existing reads that branch on category
// stay consistent.

export type FlywheelStage = 'Deliver' | 'Capture' | 'Share' | 'Attract' | 'Book'

export const FLYWHEEL_STAGES: { key: FlywheelStage; label: string; dot: string; fg: string; ring: string; bg: string }[] = [
  { key: 'Deliver', label: 'Deliver', dot: 'bg-blue-400',   fg: 'text-blue-200',   ring: 'ring-blue-500/40',   bg: 'bg-blue-500/15' },
  { key: 'Capture', label: 'Capture', dot: 'bg-violet-400', fg: 'text-violet-200', ring: 'ring-violet-500/40', bg: 'bg-violet-500/15' },
  { key: 'Share',   label: 'Share',   dot: 'bg-cyan-400',   fg: 'text-cyan-200',   ring: 'ring-cyan-500/40',   bg: 'bg-cyan-500/15' },
  { key: 'Attract', label: 'Attract', dot: 'bg-pink-400',   fg: 'text-pink-200',   ring: 'ring-pink-500/40',   bg: 'bg-pink-500/15' },
  { key: 'Book',    label: 'Book',    dot: 'bg-orange-400', fg: 'text-orange-200', ring: 'ring-orange-500/40', bg: 'bg-orange-500/15' },
]

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
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ring-1 transition-colors ${
              value === null
                ? 'bg-white/10 text-text ring-white/20'
                : 'bg-surface-alt text-text-muted ring-border hover:text-text'
            }`}
          >
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold ring-1 transition-colors ${
                active
                  ? `${s.bg} ${s.fg} ${s.ring}`
                  : 'bg-surface-alt text-text-muted ring-border hover:text-text'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
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
