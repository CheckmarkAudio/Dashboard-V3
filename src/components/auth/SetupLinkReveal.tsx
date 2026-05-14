import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2, Copy, Mail } from 'lucide-react'
import { Button } from '../ui'

export interface SetupLinkRevealProps {
  email: string
  displayName: string
  setupLink: string
  headline?: string
  subhead?: string
}

export default function SetupLinkReveal({
  email,
  displayName,
  setupLink,
  headline,
  subhead,
}: SetupLinkRevealProps) {
  const [copied, setCopied] = useState(false)

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent('Set up your Checkmark Audio account')
    const body = encodeURIComponent(
      `Hi ${displayName},\n\nUse this secure link to set your Checkmark Audio password and sign in:\n\n${setupLink}\n\nThanks!`,
    )
    return `mailto:${email}?subject=${subject}&body=${body}`
  }, [displayName, email, setupLink])

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(setupLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Link stays visible/selectable as a manual-copy fallback.
    }
  }, [setupLink])

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 px-3 py-3 rounded-lg bg-status-success-bg border border-emerald-400/30">
        <CheckCircle2
          size={18}
          className="text-status-success-text mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-status-success-text">
            {headline ?? `Setup link ready for ${email}`}
          </p>
          <p className="text-[12px] text-text-muted mt-1">
            {subhead ?? `Send this link to ${displayName}. They'll choose their own password.`}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-alt/60 p-3">
        <p className="text-[10px] font-semibold tracking-wider uppercase text-text-light mb-1.5">
          Setup link
        </p>
        <div className="flex items-start gap-2">
          <code
            className="flex-1 min-w-0 px-3 py-2 rounded-md bg-surface border border-border-light font-mono text-xs text-text break-all select-all"
            onClick={(e) => {
              const range = document.createRange()
              range.selectNodeContents(e.currentTarget)
              const sel = window.getSelection()
              sel?.removeAllRanges()
              sel?.addRange(range)
            }}
          >
            {setupLink}
          </code>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Copy size={13} aria-hidden="true" />}
            onClick={() => void onCopy()}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={mailtoHref}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-alt px-3 text-xs font-semibold text-text transition-colors hover:bg-surface-hover focus-ring"
        >
          <Mail size={13} aria-hidden="true" />
          Open email draft
        </a>
      </div>
    </div>
  )
}
