import { useEffect, useRef } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open, title, message, confirmLabel = 'Confirm',
  variant = 'danger', loading = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  const confirmColors = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-amber-500 hover:bg-amber-600 text-black'

  const iconColors = variant === 'danger' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <button onClick={onCancel} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-surface-hover text-text-muted">
          <X size={16} />
        </button>

        <div className="p-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconColors}`}>
            <AlertTriangle size={20} />
          </div>
          <h3 className="text-lg font-semibold mb-1">{title}</h3>
          <p className="text-sm text-text-muted leading-relaxed">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pb-6">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${confirmColors}`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
