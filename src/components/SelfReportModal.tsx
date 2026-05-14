import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clock, LogOut, X } from 'lucide-react'

/**
 * Combine the two reflection prompts into a single notes string for
 * `time_clock_entries.notes`. Returns null when both fields are empty
 * so the column stores NULL (clean) instead of an empty header.
 */
function buildClockOutNotes(wentWell: string, toImprove: string): string | null {
  const went = wentWell.trim()
  const improve = toImprove.trim()
  if (!went && !improve) return null
  if (went && improve) return `Went well: ${went}\n\nTo improve: ${improve}`
  if (went) return `Went well: ${went}`
  return `To improve: ${improve}`
}

/**
 * Compact "1h 23m on shift" string for the modal header.
 */
function elapsedShort(clockInIso: string, nowMs: number): string {
  try {
    const start = new Date(clockInIso).getTime()
    if (Number.isNaN(start)) return ''
    const totalMin = Math.max(0, Math.floor((nowMs - start) / 60_000))
    if (totalMin < 60) return `${totalMin}m on shift`
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return m === 0 ? `${h}h on shift` : `${h}h ${m}m on shift`
  } catch {
    return ''
  }
}

export default function SelfReportModal({
  clockInTime,
  clockedInAtIso,
  onDismiss,
  onClockOut,
  onLogout,
}: {
  /** Display string for the clock-in time, e.g. "9:42 AM". */
  clockInTime: string
  /** ISO timestamp for the open shift; powers the elapsed counter. */
  clockedInAtIso?: string
  /**
   * Dismiss the modal WITHOUT clocking out. Fired from the X
   * button, the backdrop click, and the Escape key (form state).
   * The user stays on shift. Per direction "you should not be able
   * to skip the clock out description", these paths no longer
   * close the shift.
   */
  onDismiss: () => void
  /**
   * Clock out with the user-typed reflection. Always non-empty:
   * the Submit button is disabled until at least one of the two
   * fields has content. Fired once from the form's primary button.
   * The parent should NOT also dismiss after this — the modal
   * flips to its success state internally.
   */
  onClockOut: (notes: string) => void
  /**
   * Sign out. Fired from the success screen's "Log out" button.
   * The shift is already closed by `onClockOut` at this point,
   * so the parent should ONLY trigger signOut here, not clock_out.
   */
  onLogout: () => void
}) {
  const [wentWell, setWentWell] = useState('')
  const [toImprove, setToImprove] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submittedAt, setSubmittedAt] = useState<number | null>(null)

  // Live clock for the header — updates every second so the elapsed
  // string ticks while the modal is open. Cheap; modal is short-lived.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const displayNow = submittedAt ?? now
  const clockOutTime = new Date(displayNow).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  })
  const elapsed = clockedInAtIso ? elapsedShort(clockedInAtIso, now) : ''

  const canSubmit = wentWell.trim().length > 0 || toImprove.trim().length > 0
  const handleSubmit = () => {
    if (!canSubmit) return
    const notes = buildClockOutNotes(wentWell, toImprove)
    if (!notes) return // belt-and-suspenders — canSubmit guarantees this
    onClockOut(notes)
    setSubmittedAt(Date.now())
    setSubmitted(true)
  }

  // Escape dismisses the modal (stay on shift) when on the form,
  // and just closes when on the success screen (already clocked
  // out). Mirrors what the X button + backdrop do.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])

  // 2026-05-12 (clock polish) — modal owns its own portal so it
  // escapes the Layout header's backdrop-blur stacking context (PR
  // #72 fix). The previous content (mock-data summary counts +
  // collapsible details accordion) was REMOVED here — it pulled
  // from the placeholder `useTasks()` context and showed wrong
  // numbers. Real shift summary will land when the per-member
  // "today's completed work" RPC ships; until then, the modal
  // focuses on the two reflection prompts + clear actions.
  const modalContent = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        // Backdrop = dismiss without clocking out. Stays on shift.
        onClick={onDismiss}
      />
      <div className="relative bg-surface rounded-2xl border border-border w-full max-w-md mx-4 p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-text">End of shift</h2>
            <p className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
              <Clock size={11} className="text-gold" aria-hidden="true" />
              <span className="tabular-nums">{clockInTime} → {clockOutTime}</span>
              {elapsed && <span className="text-text-light">· {elapsed}</span>}
            </p>
          </div>
          <button
            // X = dismiss without clocking out. Stays on shift. The
            // user must explicitly hit "Submit & Clock Out" with a
            // reflection to actually close the shift.
            onClick={onDismiss}
            aria-label="Close (stays on shift)"
            title="Close (stays on shift)"
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-gold" />
            </div>
            <p className="text-[15px] font-semibold text-text">You're clocked out.</p>
            <p className="text-[12px] text-text-muted mt-1">
              Clocked out at <span className="tabular-nums text-text">{clockOutTime}</span>.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={onDismiss}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface-alt text-text-muted text-[13px] font-semibold border border-border hover:text-text transition-all focus-ring"
              >
                Stay signed in
              </button>
              <button
                onClick={onLogout}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-black text-[13px] font-bold hover:bg-gold-muted transition-all focus-ring"
              >
                <LogOut size={14} aria-hidden="true" />
                Log out
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-text-muted leading-relaxed">
              Take a beat to reflect — these notes save with the shift and help us spot patterns over time.
              At least one field is required.
            </p>

            {/* What went well */}
            <div>
              <label
                htmlFor="went-well"
                className="text-[11px] font-semibold text-text-muted uppercase tracking-wide block mb-1.5"
              >
                What went well today?
              </label>
              <textarea
                id="went-well"
                value={wentWell}
                onChange={(e) => setWentWell(e.target.value)}
                rows={3}
                placeholder="Wins, breakthroughs, things that clicked..."
                className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 resize-y"
              />
            </div>

            {/* What to improve */}
            <div>
              <label
                htmlFor="to-improve"
                className="text-[11px] font-semibold text-text-muted uppercase tracking-wide block mb-1.5"
              >
                Anything to improve next time?
              </label>
              <textarea
                id="to-improve"
                value={toImprove}
                onChange={(e) => setToImprove(e.target.value)}
                rows={3}
                placeholder="Friction, blockers, ideas to do better..."
                className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 resize-y"
              />
            </div>

            {/* Single primary action — Skip & Clock Out was removed
                per user direction. Reflections are required to clock
                out so we always capture something. The button is
                disabled until at least one of the two fields has
                content. */}
            <div className="pt-1">
              <button
                onClick={handleSubmit}
                disabled={!wentWell.trim() && !toImprove.trim()}
                className="w-full py-2.5 rounded-xl bg-gold text-black text-sm font-bold hover:bg-gold-muted transition-all focus-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gold"
              >
                Submit
              </button>
              {!wentWell.trim() && !toImprove.trim() && (
                <p className="text-[11px] text-text-light text-center mt-2">
                  Add a quick note in either field to clock out.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return modalContent
  return createPortal(modalContent, document.body)
}
