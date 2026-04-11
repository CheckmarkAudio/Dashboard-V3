import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional label shown in the fallback header. */
  label?: string
  /** Optional render-prop fallback. Receives the error and a reset function. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Generic React error boundary. Class component is required — React 19
 * still has no hooks-based API for rendering fallbacks on render-time throws.
 *
 * Wraps any subtree so a single broken component can't white-screen the app.
 * Falls back to a friendly card with "Try again" (resets the boundary) and
 * "Go home" (full reload to `/`). Logs the error to the console for dev.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? 'unknown', error, info.componentStack)
  }

  reset = () => {
    this.setState({ error: null })
  }

  goHome = () => {
    window.location.assign(import.meta.env.BASE_URL || '/')
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="mx-auto my-10 max-w-xl rounded-2xl border border-red-500/30 bg-surface p-6 shadow-lg animate-fade-in"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle size={18} className="text-red-400" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-text">
              {this.props.label ? `${this.props.label} crashed` : 'Something went wrong'}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              The dashboard hit an unexpected error. Your data is safe — you can retry, or head back home.
            </p>
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface-alt/50 p-3 text-xs text-text-light">
              {error.message}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={this.reset}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-muted transition-colors"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Try again
              </button>
              <button
                type="button"
                onClick={this.goHome}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text hover:bg-surface-hover transition-colors"
              >
                <Home size={14} aria-hidden="true" />
                Go home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
