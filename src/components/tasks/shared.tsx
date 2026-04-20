// ============================================================================
// Shared task primitives — TaskRow + helpers used by every task surface
// (the /daily Tasks page, the Overview "My Tasks" widget, future Templates).
//
// Single source of truth for row visuals + stage palette so all surfaces
// stay in sync as the design evolves. If you change a row style, change
// it here.
// ============================================================================

import type { ReactNode } from 'react'
import { Check, Eye, EyeOff, Flame } from 'lucide-react'

// ─── Stage model ─────────────────────────────────────────────────────

export type Stage = 'deliver' | 'capture' | 'share' | 'attract' | 'book'

export const STAGES: readonly Stage[] = ['deliver', 'capture', 'share', 'attract', 'book']

// Stage tag palette — perceptually balanced so no hue dominates the
// row visually. Used by the StagePill filter row + any callout that
// needs the stage's color identity.
export const STAGE_STYLE: Record<Stage, { label: string; text: string; dot: string; bg: string; ring: string }> = {
  deliver: { label: 'Deliver', text: 'text-blue-400/70',   dot: 'bg-blue-400',   bg: 'bg-blue-500/5',   ring: 'ring-blue-500/15' },
  capture: { label: 'Capture', text: 'text-violet-400/70', dot: 'bg-violet-400', bg: 'bg-violet-500/5', ring: 'ring-violet-500/15' },
  share:   { label: 'Share',   text: 'text-cyan-500/70',   dot: 'bg-cyan-400',   bg: 'bg-cyan-500/5',   ring: 'ring-cyan-500/15' },
  attract: { label: 'Attract', text: 'text-pink-400/70',   dot: 'bg-pink-400',   bg: 'bg-pink-500/5',   ring: 'ring-pink-500/15' },
  book:    { label: 'Book',    text: 'text-orange-500/70', dot: 'bg-orange-400', bg: 'bg-orange-500/5', ring: 'ring-orange-500/15' },
}

export const EM_DASH = '—'

// ─── TaskRow ─────────────────────────────────────────────────────────
// Single task: checkbox + title (+ flame for priority) + meta slot.
// Meta slot ALWAYS renders so columns line up; an em-dash signals
// "no due date set yet" without leaving the row visually unbalanced.

export function TaskRow({
  title,
  meta,
  priority,
  isDone,
  isPending,
  onCheck,
}: {
  title: string
  meta?: string | null
  priority?: boolean
  isDone: boolean
  isPending: boolean
  onCheck: () => void
}) {
  const isChecked = isDone || isPending

  return (
    <div
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center py-2.5 border-b border-white/5 last:border-0 transition-opacity ${
        isDone ? 'opacity-30' : ''
      }`}
    >
      <button
        onClick={onCheck}
        disabled={isDone}
        className="shrink-0"
        aria-label={isChecked ? 'Mark incomplete' : 'Mark complete'}
      >
        <div
          className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all ${
            isDone
              ? 'bg-gold/30 border-gold/40'
              : isPending
                ? 'bg-gold/20 border-gold'
                : 'border-white/20 hover:border-gold/60'
          }`}
        >
          {isChecked && <Check size={11} className="text-gold" strokeWidth={3} />}
        </div>
      </button>

      <div className="min-w-0 flex items-center gap-2">
        <span
          className={`text-[14px] leading-snug truncate ${
            isDone ? 'line-through text-text-light' : 'text-text'
          }`}
        >
          {title}
        </span>
        {priority && <Flame size={12} className="text-gold shrink-0" aria-hidden="true" />}
      </div>

      {/* Meta slot ALWAYS renders — em-dash when there's no due date,
          which signals "not set" rather than leaving the row visually
          lopsided. Same `text-[12px] text-text-light tabular-nums`
          treatment everywhere a task row appears. */}
      <span
        className={`text-[12px] whitespace-nowrap tabular-nums ${
          meta ? 'text-text-light' : 'text-text-light/40'
        }`}
        title={meta ? undefined : 'No due date set'}
      >
        {meta || EM_DASH}
      </span>
    </div>
  )
}

// ─── Stage filter pills ───────────────────────────────────────────────

export function StagePillRow({
  counts,
  active,
  onChange,
}: {
  counts: Record<'all' | Stage, number>
  active: 'all' | Stage
  onChange: (next: 'all' | Stage) => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <StagePill
        label="All"
        count={counts.all}
        tone="gold"
        isActive={active === 'all'}
        onClick={() => onChange('all')}
      />
      {STAGES.map((s) => (
        <StagePill
          key={s}
          label={STAGE_STYLE[s].label}
          count={counts[s]}
          tone={s}
          isActive={active === s}
          onClick={() => onChange(s)}
        />
      ))}
    </div>
  )
}

function StagePill({
  label,
  count,
  tone,
  isActive,
  onClick,
}: {
  label: string
  count: number
  tone: 'gold' | Stage
  isActive: boolean
  onClick: () => void
}) {
  const stageStyle = tone === 'gold' ? null : STAGE_STYLE[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ring-1 whitespace-nowrap ${
        isActive
          ? tone === 'gold'
            ? 'bg-gold/15 text-gold ring-gold/30'
            : `${stageStyle!.bg} ${stageStyle!.text} ${stageStyle!.ring}`
          : 'bg-white/[0.03] text-text-light ring-white/10 hover:text-text'
      }`}
    >
      {stageStyle && (
        <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} aria-hidden="true" />
      )}
      {label}
      <span className={`tabular-nums ${isActive ? 'opacity-100' : 'opacity-70'}`}>{count}</span>
    </button>
  )
}

// ─── Card chrome ──────────────────────────────────────────────────────

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`widget-card flex flex-col overflow-hidden ${className}`}>{children}</article>
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="px-5 pt-4 pb-3 border-b border-white/5">{children}</div>
}

// ─── Submit bar (gold gradient, "Submit Completed (n)") ───────────────

export function SubmitBar({
  count,
  onClick,
  disabled,
}: {
  count: number
  onClick: () => void
  disabled: boolean
}) {
  return (
    <div className="px-5 py-4 border-t border-white/5 mt-auto">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all ${
          disabled
            ? 'bg-white/[0.03] text-text-light ring-1 ring-white/5 cursor-not-allowed'
            : 'bg-gradient-to-b from-gold to-gold-muted text-black hover:brightness-105 shadow-[0_14px_28px_rgba(214,170,55,0.22)]'
        }`}
      >
        <Check size={14} strokeWidth={3} />
        {disabled ? 'Submit Completed' : `Submit Completed (${count})`}
      </button>
    </div>
  )
}

// ─── Day/Week toggle + completed toggle ───────────────────────────────

export function DayWeekToggle({ value, onChange }: { value: 'Day' | 'Week'; onChange: (v: 'Day' | 'Week') => void }) {
  return (
    <div className="flex bg-white/[0.03] rounded-lg p-1 ring-1 ring-white/5">
      {(['Day', 'Week'] as const).map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-tight transition-colors ${
            value === o ? 'bg-gold/16 text-gold' : 'text-text-light hover:text-text'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function CompletedToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 text-[11px] text-text-light hover:text-text transition-colors py-1"
    >
      {show ? <EyeOff size={11} /> : <Eye size={11} />}
      {show ? 'Hide' : 'Show'} completed
    </button>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────

export function countByStage(
  tasks: { stage: Stage; done: boolean }[],
  submitted: Set<string> = new Set<string>(),
  idKey: (t: { id: string } & { stage: Stage; done: boolean }) => string = (t) => (t as { id: string }).id,
): Record<'all' | Stage, number> {
  const active = tasks.filter((t) => !t.done && !submitted.has(idKey(t as { id: string } & typeof t)))
  const counts: Record<'all' | Stage, number> = { all: active.length, deliver: 0, capture: 0, share: 0, attract: 0, book: 0 }
  for (const t of active) counts[t.stage]++
  return counts
}
