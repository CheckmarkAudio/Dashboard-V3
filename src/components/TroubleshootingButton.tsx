import { useCallback, useState } from 'react'
import { LifeBuoy, Send } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'
import { Button, Input, Modal, Select, Textarea } from './ui'

/**
 * Lean 8 — global Troubleshooting button.
 *
 * Replaces the inline Troubleshooting form that used to live at the
 * bottom of the Forum page. The user wanted it accessible from any
 * page (not just /content), so it's now a floating button anchored
 * to the bottom-right of the viewport with a Modal for the form.
 *
 * The form itself is unchanged from the original — short
 * description, what we tried, severity, submit. There's no backend
 * yet to receive these reports (the original was placeholder UI
 * too), so submit shows a thank-you toast and closes. When the
 * future `support_reports` table lands, only the submit handler
 * needs to change.
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
        // No backend table for support reports yet — the original
        // form on /content was placeholder too. When `support_reports`
        // lands, swap this for a `supabase.from('support_reports').insert(...)`.
        await new Promise((r) => setTimeout(r, 300))
        toast('Thanks — issue logged. We\'ll take a look.', 'success')
        setOpen(false)
        reset()
      } finally {
        setSubmitting(false)
      }
    },
    [description, toast],
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Report an issue"
        aria-label="Report an issue"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-surface ring-1 ring-border-light shadow-lg text-text-muted hover:text-gold hover:ring-gold/40 transition-colors focus-ring"
      >
        <LifeBuoy size={14} aria-hidden="true" />
        <span className="text-[12px] font-semibold">Help</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Report an issue"
        description="Tell us what's broken or feels off. Goes straight to the team."
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
