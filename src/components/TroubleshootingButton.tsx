import { useCallback, useState } from 'react'
import { MessageSquareText, Send } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'
import { submitSupportReport } from '../lib/queries/supportReports'
import { Button, Input, Modal, Select, Textarea } from './ui'

/**
 * Global "Feedback" button (formerly "Help" / Troubleshooting).
 *
 * Replaces the inline Troubleshooting form that used to live at the
 * bottom of the Forum page. Accessible from any page as a floating
 * button — anchored to the bottom-LEFT so it stays clear of the
 * Messenger-style chat dock in the bottom-right. Opens a Modal form.
 * (Component/file name kept as TroubleshootingButton to avoid churn;
 * only the user-facing label changed to "Feedback".)
 *
 * The form — short description, what we tried, severity — submits
 * through the `submit_support_report()` RPC into the `support_reports`
 * table (team-scoped; the page path + user-agent are captured for
 * triage). Admins can read their team's reports via RLS.
 */

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const
type Severity = (typeof SEVERITIES)[number]

export default function TroubleshootingButton() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [whatTried, setWhatTried] = useState('')
  const [severity, setSeverity] = useState<Severity>('Medium')
  const [submitting, setSubmitting] = useState(false)

  // Hide the floating button when not signed in — the Login page
  // doesn't need a "report a bug" affordance, and an unsigned modal
  // submit has nowhere to attribute it anyway.
  if (!user) return null

  const reset = () => {
    setDescription('')
    setWhatTried('')
    setSeverity('Medium')
  }

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!description.trim()) {
        toast('Add a short description so we know what to look at.', 'error')
        return
      }
      setSubmitting(true)
      try {
        // Persists via the submit_support_report() RPC (the only write
        // path — support_reports has no direct INSERT policy). Captures
        // the current page + user-agent so admins can triage.
        await submitSupportReport({
          description,
          whatTried,
          severity,
          pageUrl: typeof window !== 'undefined' ? window.location.pathname + window.location.search : null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        })
        toast('Thanks — feedback sent. We\'ll take a look.', 'success')
        setOpen(false)
        reset()
      } catch (err) {
        console.error('[Feedback] submit failed:', err)
        toast('Couldn\'t send that — please try again.', 'error')
      } finally {
        setSubmitting(false)
      }
    },
    [description, whatTried, severity, toast],
  )

  return (
    <>
      {/* Bottom-LEFT so it stays clear of the chat dock (bottom-right). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send feedback"
        aria-label="Send feedback"
        className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-surface ring-1 ring-border-light shadow-lg text-text-muted hover:text-gold hover:ring-gold/40 transition-colors focus-ring"
      >
        <MessageSquareText size={14} aria-hidden="true" />
        <span className="text-[12px] font-semibold">Feedback</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Send feedback"
        description="Tell us what's broken or what could be better. Goes straight to the team."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="troubleshooting-form"
              variant="primary"
              loading={submitting}
              iconLeft={!submitting ? <Send size={14} aria-hidden="true" /> : undefined}
            >
              Submit report
            </Button>
          </>
        }
      >
        <form id="troubleshooting-form" onSubmit={onSubmit} className="space-y-3">
          <Input
            id="ts-description"
            label="Short issue description"
            required
            placeholder="e.g. Calendar notes vanish after I refresh"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Textarea
            id="ts-what-tried"
            label="What we tried / ideas to fix"
            placeholder="Steps you took, things you ruled out, anything that helps."
            value={whatTried}
            onChange={(e) => setWhatTried(e.target.value)}
            rows={3}
          />
          <Select
            id="ts-severity"
            label="Severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </form>
      </Modal>
    </>
  )
}
