import { useEffect, useState, createContext, useContext, useCallback, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error'
}

interface ToastContextType {
  toast: (message: string, type?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" aria-live="polite" aria-relevant="additions">
        {toasts.map(t => (
          <ToastNotification key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastNotification({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 3000)
    return () => clearTimeout(timer)
  }, [item.id, onDismiss])

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border shadow-lg animate-slide-up min-w-[280px] ${
        item.type === 'success' ? 'border-emerald-500/30' : 'border-red-500/30'
      }`}
      role={item.type === 'error' ? 'alert' : 'status'}
    >
      {item.type === 'success' ? (
        <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0" aria-hidden="true">
          <CheckCircle2 size={14} className="text-emerald-400" />
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full bg-red-500/15 flex items-center justify-center shrink-0" aria-hidden="true">
          <AlertCircle size={14} className="text-red-400" />
        </div>
      )}
      <span className="text-sm text-text flex-1">{item.message}</span>
      <button onClick={() => onDismiss(item.id)} className="text-text-light hover:text-text shrink-0 p-0.5" aria-label="Dismiss notification">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
