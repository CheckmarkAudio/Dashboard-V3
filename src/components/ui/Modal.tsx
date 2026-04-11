import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

interface ModalProps {
  open: boolean
  onClose: () => void
  /** Heading text, rendered as the dialog's accessible name. */
  title: ReactNode
  /** Optional subtitle / helper text rendered under the title. */
  description?: ReactNode
  /** Body contents (usually a form). */
  children: ReactNode
  /** Optional footer. Usually one or two buttons in a right-aligned row. */
  footer?: ReactNode
  size?: ModalSize
  /** Hide the close button in the header. Useful for required confirmations. */
  hideCloseButton?: boolean
  /** Disables click-outside and Escape-to-close. Useful while a submission is in-flight. */
  locked?: boolean
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

/**
 * Accessible modal dialog. Automatically focus-traps, handles Escape,
 * backdrop-clicks, and restores focus to the trigger when closed. Use as
 * the shell for ConfirmModal, SubmissionModal, and any new dialogs.
 *
 *   <Modal
 *     open={open}
 *     onClose={close}
 *     title="Remove team member"
 *     description="This action cannot be undone."
 *     footer={
 *       <>
 *         <Button variant="ghost" onClick={close}>Cancel</Button>
 *         <Button variant="danger" loading={removing} onClick={confirm}>Remove</Button>
 *       </>
 *     }
 *   >
 *     Are you sure you want to remove {name}?
 *   </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideCloseButton = false,
  locked = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open)

  // Close on Escape (unless locked).
  useEffect(() => {
    if (!open || locked) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, locked, onClose])

  // Prevent background scrolling while the modal is open.
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        role="presentation"
        onClick={locked ? undefined : onClose}
      />
      <div className="absolute inset-0 overflow-y-auto flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
          className={[
            'relative w-full bg-surface rounded-2xl border border-border shadow-2xl animate-slide-up',
            SIZE_CLASSES[size],
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-text">{title}</h2>
              {description && (
                <p className="mt-1 text-sm text-text-muted">{description}</p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                disabled={locked}
                className="shrink-0 p-1.5 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text transition-colors focus-ring disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="px-6 pb-5">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Modal
