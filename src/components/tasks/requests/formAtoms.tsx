// Shared form atoms for the task-request / quick-assign modals (PR #17).
//
// Pulled out of the individual modals so (a) the member-side request
// modal and the admin-side create flow don't drift, (b) the admin
// approval modal can reuse the flywheel picker at approve-time.

import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

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

export function RecurrencePicker({
  value,
  onChange,
  comingSoonHint = true,
}: {
  value: RecurrenceFrequency
  onChange: (next: RecurrenceFrequency) => void
  /** Show the "coming soon" hint under the picker. Parent fires the actual toast. */
  comingSoonHint?: boolean
}) {
  const options: { key: RecurrenceFrequency; label: string }[] = [
    { key: 'off',     label: 'Off' },
    { key: 'daily',   label: 'Daily' },
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
      {comingSoonHint && value !== 'off' && (
        <ComingSoonHint>
          Recurring engine coming soon. Your choice saves now and will activate once the pipeline ships.
        </ComingSoonHint>
      )}
    </div>
  )
}

function ComingSoonHint({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30 px-2.5 py-2">
      <AlertCircle size={13} className="text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-[11px] text-amber-100/90 leading-snug">{children}</p>
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
