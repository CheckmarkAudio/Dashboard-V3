import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import SetupLinkReveal from '../auth/SetupLinkReveal'

export interface SetupLinkModalProps {
  email: string
  displayName: string
  setupLink: string
  headline?: string
  subhead?: string
  onClose: () => void
}

/**
 * Small dialog wrapper around SetupLinkReveal for the roster actions
 * ("New setup link" for pending members, "Password reset link" for active
 * ones). The link is the guaranteed handoff path — email delivery on this
 * project is best-effort until custom SMTP is configured.
 */
export default function SetupLinkModal({
  email,
  displayName,
  setupLink,
  headline,
  subhead,
  onClose,
}: SetupLinkModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Setup link for ${displayName}`}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
      />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-surface-hover text-text-muted focus-ring"
          aria-label="Close"
        >
          <X size={16} aria-hidden="true" />
        </button>
        <div className="p-6">
          <SetupLinkReveal
            email={email}
            displayName={displayName}
            setupLink={setupLink}
            headline={headline}
            subhead={subhead}
          />
        </div>
      </div>
    </div>
  )
}
