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
  onClose,
  onLogout,
}: {
  /** Display string for the clock-in time, e.g. "9:42 AM". */
  clockInTime: string
  /** ISO timestamp for the open shift; powers the elapsed counter. */
  clockedInAtIso?: string
  // Both close paths hand the reflection text up so the parent
  // (Layout) can pass it as `p_notes` to clock_out. Notes are null
  // when the user skips both reflection fields.
  onClose: (notes: string | null) => void
  onLogout: (notes: string | null) => void
}) {
  const [wentWell, setWentWell] = useState('')
  const [toImprove, setToImprove] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Live clock for the header — updates every second so the elapsed
  // string ticks while the modal is open. Cheap; modal is short-lived.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const clockOutTime = new Date(now).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  })
  const elapsed = clockedInAtIso ? elapsedShort(clockedInAtIso, now) : ''

  const currentNotes = () => buildClockOutNotes(wentWell, toImprove)
  const handleSubmit = () => {
    setSubmitted(true)
  }

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
        onClick={() => onClose(currentNotes())}
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
            onClick={() => onClose(currentNotes())}
            aria-label="Close"
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
            <p className="text-[12px] text-text-muted mt-1">Have a good one.</p>
            <button
              onClick={() => onLogout(currentNotes())}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-black text-[13px] font-bold hover:bg-gold-muted transition-all"
            >
              <LogOut size={14} aria-hidden="true" />
              Log out
            </button>
            <p className="text-[10px] text-text-light mt-3">
              Or close this window to stay signed in.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-text-muted leading-relaxed">
              Take a beat to reflect — these notes save with the shift and help us spot patterns. Or skip if you're rushing.
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

            {/* Two clear actions:
                  - Primary: Submit & Clock Out (saves the reflections)
                  - Secondary: Skip & Clock Out (clocks out with no notes)
                Skip removes the "do I have to fill these in?" friction
                that bottlenecks new members on day one. */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={handleSubmit}
                className="flex-1 py-2.5 rounded-xl bg-gold text-black text-sm font-bold hover:bg-gold-muted transition-all focus-ring"
              >
                Submit &amp; Clock Out
              </button>
              <button
                onClick={() => {
                  // Skip = no notes saved; close immediately.
                  onClose(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-surface-alt text-text-muted text-sm font-semibold border border-border hover:border-border-light hover:text-text transition-all focus-ring"
              >
                Skip &amp; Clock Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return modalContent
  return createPortal(modalContent, document.body)
}
