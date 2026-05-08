import { useCallback, useState } from 'react'
import { CheckCircle2, Copy } from 'lucide-react'
import { Button } from '../ui'

/**
 * Shared temp-password handoff UI block.
 *
 * Used by both:
 *   - `AccountAccessPanel` — owner-only "Reset password" flow
 *   - `TeamManager` — Add Member onboarding success state
 *
 * Renders a green confirmation banner, the password in a mono code
 * block (select-all on click + Copy button), and a tip about secure
 * handoff. The member is forced to change it on first login via
 * `ForcePasswordChangeModal` (triggered by `requires_password_change`
 * in their auth user_metadata).
 *
 * Props
 *   - `email` — target email, shown in the success banner
 *   - `displayName` — target's name, used in the body copy
 *   - `tempPassword` — the password to reveal
 *   - `headline` — overrides the default banner headline ("New password set for …")
 *   - `subhead`  — overrides the default banner body copy
 */
export interface TempPasswordRevealProps {
  email: string
  displayName: string
  tempPassword: string
  headline?: string
  subhead?: string
}

export default function TempPasswordReveal({
  email,
  displayName,
  tempPassword,
  headline,
  subhead,
}: TempPasswordRevealProps) {
  const [copied, setCopied] = useState(false)

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail in non-secure contexts; the password is
      // still visible and selectable so the owner can copy manually.
    }
  }, [tempPassword])

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
            {headline ?? `New password set for ${email}`}
          </p>
          <p className="text-[12px] text-text-muted mt-1">
            {subhead ??
              `Share the password below with ${displayName}. They'll be forced to choose their own on first login.`}
          </p>
        </div>
      </div>
      {/* Copyable password block. Mono font + select-all on click so
          the owner can either hit Copy or just triple-click → ⌘C as a
          backup. */}
      <div className="rounded-lg border border-border bg-surface-alt/60 p-3">
        <p className="text-[10px] font-semibold tracking-wider uppercase text-text-light mb-1.5">
          Temporary password
        </p>
        <div className="flex items-center gap-2">
          <code
            className="flex-1 min-w-0 px-3 py-2 rounded-md bg-surface border border-border-light font-mono text-sm text-text break-all select-all"
            onClick={(e) => {
              const range = document.createRange()
              range.selectNodeContents(e.currentTarget)
              const sel = window.getSelection()
              sel?.removeAllRanges()
              sel?.addRange(range)
            }}
          >
            {tempPassword}
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
      <p className="text-[11px] text-text-light">
        Tip: send it through a private channel (DM, in-person). The password is single-use —
        Checkmark forces a change as soon as they log in.
      </p>
    </div>
  )
}
