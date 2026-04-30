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
//
// Visual style follows the Workspace-UI-Draft mockup: per-row rounded
// background tint (no bottom-border dividers) with a border that
// lights up on hover. Compact padding (py-2 px-2.5) keeps a stack of
// tasks visually dense without feeling cramped.
//
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
      className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5 items-center px-2.5 py-2 rounded-[14px] border border-transparent bg-white/[0.018] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all ${
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
                : 'border-white/20 group-hover:border-gold/60'
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
  // PR #36 — two-row layout: "All" (clear-filter affordance) sits on
  // its own row above the 5 flywheel stage pills. No horizontal
  // scroll — with 10px text + 1.5px padding the 5 stage pills fit
  // comfortably on one line in a 3-col widget; wrap is the fallback
  // on extreme viewport squeezes.
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <StagePill
          label="All"
          count={counts.all}
          tone="gold"
          isActive={active === 'all'}
          onClick={() => onChange('all')}
        />
      </div>
      <div className="flex items-center gap-1 flex-wrap">
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
      className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all ring-1 whitespace-nowrap ${
        isActive
          ? tone === 'gold'
            ? 'bg-gold/15 text-gold ring-gold/30'
            : `${stageStyle!.bg} ${stageStyle!.text} ${stageStyle!.ring}`
          : 'bg-white/[0.03] text-text-light ring-white/10 hover:text-text'
      }`}
    >
      {stageStyle && (
        <span className={`w-1 h-1 rounded-full ${stageStyle.dot}`} aria-hidden="true" />
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

// ─── Submit bar ───────────────────────────────────────────────────────
//
// PR #37 — always renders inside the widget footer. Greyed/disabled
// when there's nothing pending; lights up gold when the user has
// queued at least one check. Clicking commits all pending toggles via
// the `onClick` callback the widget provides.
//
// Shows the pending count inline when > 0 so the user knows how many
// tasks they're about to commit.

export function SubmitBar({
  count,
  isSubmitting = false,
  onClick,
}: {
  count: number
  isSubmitting?: boolean
  onClick: () => void
}) {
  const disabled = count === 0 || isSubmitting
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={count > 0 ? `Submit ${count} completed task${count === 1 ? '' : 's'}` : 'Submit completed (none pending)'}
      className={`w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold tracking-tight transition-all ${
        disabled
          ? 'bg-white/[0.04] text-text-light/50 ring-1 ring-white/5 cursor-not-allowed'
          : 'bg-gradient-to-b from-gold to-gold-muted text-black hover:brightness-105 shadow-[0_10px_20px_rgba(214,170,55,0.18)]'
      }`}
    >
      <Check size={12} strokeWidth={3} />
      Submit Completed{count > 0 ? ` (${count})` : ''}
    </button>
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
  // PR #37 — icon-only. The label is redundant once the eye /
  // eye-off state telegraphs "currently hiding" vs "currently
  // showing" completed. `title` surfaces the full text on hover
  // for accessibility.
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? 'Hide completed tasks' : 'Show completed tasks'}
      title={show ? 'Hide completed' : 'Show completed'}
      className={`shrink-0 inline-flex items-center justify-center p-1.5 rounded-md transition-colors ${
        show ? 'text-gold hover:bg-gold/10' : 'text-text-light hover:text-text hover:bg-white/[0.04]'
      }`}
    >
      {show ? <EyeOff size={13} /> : <Eye size={13} />}
    </button>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────

// Map a stored task category to a canonical flywheel stage. DB stores
// these title-cased ("Deliver", "Capture", …); we normalise to
// lowercase so the STAGE union type is the single source of truth.
// Returns null for tasks that aren't flywheel-tagged.
export function taskStage(category: string | null | undefined): Stage | null {
  if (!category) return null
  const key = category.toLowerCase().trim()
  return (STAGES as readonly string[]).includes(key) ? (key as Stage) : null
}

// Short, at-a-glance due-date label for the right-side task column.
// "Today" when due today, short "Mon 22" format otherwise, null when
// no due date set.
export function formatDueShort(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null
  const d = new Date(dueDate)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  if (isToday) return 'Today'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

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

// ─── PR #69 — task-row metadata helpers ──────────────────────────────

/**
 * "Bridget Reinhard" → "Bridget R."
 * "Madonna"          → "Madonna"
 * Trims; collapses multiple spaces; preserves single-name inputs.
 */
export function formatShortName(name: string | null | undefined): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0] ?? ''
  const first = parts[0] ?? ''
  const lastInitial = (parts[parts.length - 1] ?? '').charAt(0).toUpperCase()
  return lastInitial ? `${first} ${lastInitial}.` : first
}

/**
 * Map a `team_members.position` slug to a short label suitable for a
 * bracketed inline tag like `[marketing]`. Falls back to the raw slug
 * (lowercased, underscores → spaces) for any new positions added later.
 *
 * Sourced from the Members admin POSITIONS list in TeamManager.tsx so
 * the labels stay aligned across surfaces.
 */
export function rolePositionFor(position: string | null | undefined): string | null {
  if (!position) return null
  const slug = position.trim().toLowerCase()
  if (!slug) return null
  const map: Record<string, string> = {
    owner: 'owner',
    marketing_admin: 'marketing',
    artist_development: 'a&r',
    intern: 'intern',
    engineer: 'engineer',
    producer: 'producer',
  }
  return map[slug] ?? slug.replace(/_/g, ' ')
}

/**
 * Heuristic for "did the user assign this to themselves?" Used by My
 * Tasks to split the list into Assigned (someone else put it on my
 * queue) vs Self (I pressed the button myself, or there's no batch).
 *
 * Logic:
 *   - No batch (e.g. daily checklist) → treat as self (no admin action)
 *   - batch.assigned_by === task.assigned_to → self-assigned
 *   - otherwise → assigned by someone else
 *
 * Imperfect for the task-request flow: when an admin approves a
 * member's request, the resulting task has `batch.assigned_by = admin`
 * and `assigned_to = requester`, so it shows as "Assigned" even though
 * the member initiated it. Acceptable for now — a future PR can add a
 * `from_request` flag to the schema if the user wants finer detail.
 */
export function isSelfAssigned(task: {
  assigned_to: string | null
  batch: { assigned_by: string } | null
}): boolean {
  if (!task.batch) return true
  if (!task.assigned_to) return false
  return task.batch.assigned_by === task.assigned_to
}

/**
 * Three-pill segmented control for filtering My Tasks by source. Same
 * visual rhythm as the existing StagePillRow so the swap doesn't feel
 * jarring.
 */
export function SourceFilterRow({
  counts,
  active,
  onChange,
}: {
  counts: { all: number; assigned: number; self: number }
  active: 'all' | 'assigned' | 'self'
  onChange: (next: 'all' | 'assigned' | 'self') => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <SourcePill label="All" count={counts.all} active={active === 'all'} onClick={() => onChange('all')} />
      <SourcePill label="Assigned" count={counts.assigned} active={active === 'assigned'} onClick={() => onChange('assigned')} />
      <SourcePill label="Self" count={counts.self} active={active === 'self'} onClick={() => onChange('self')} />
    </div>
  )
}

function SourcePill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
        active
          ? 'bg-gold/15 text-gold ring-1 ring-gold/40'
          : 'bg-white/[0.04] text-text-muted hover:text-text hover:bg-white/[0.08]'
      }`}
    >
      {label}
      <span className={`tabular-nums ${active ? 'text-gold/80' : 'text-text-light/70'}`}>{count}</span>
    </button>
  )
}
