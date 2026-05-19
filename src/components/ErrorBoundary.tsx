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

// 2026-05-19 (Stale-chunk auto-recovery) — sessionStorage key holding
// the unix-ms timestamp of the last auto-reload. We only auto-reload
// if the LAST attempt is older than RELOAD_GUARD_WINDOW_MS. Using a
// timestamp (instead of a one-shot boolean) means a single user
// session can recover from multiple deploys — but a persistently
// broken bundle that fails again within seconds surfaces the crash
// UI instead of looping forever.
const RELOAD_GUARD_KEY = 'errorBoundary:lastChunkReloadAt'
const RELOAD_GUARD_WINDOW_MS = 30_000  // 30s — generous for a slow reload, tight enough to stop a real loop

/**
 * Returns true when the error looks like a stale-chunk failure from a
 * deploy mid-session — the browser has the old index.html cached with
 * old chunk hashes, but Vercel already replaced the assets, so the
 * lazy import 404s.
 *
 * Match string-list (covers Vite + Webpack + Safari + Chrome wording):
 *   - "Failed to fetch dynamically imported module" (Vite, Chrome)
 *   - "error loading dynamically imported module" (Vite, Safari)
 *   - "Importing a module script failed" (Safari fallback)
 *   - "Loading chunk" / "Loading CSS chunk" (Webpack-style)
 *   - "ChunkLoadError" (the class name some bundlers throw)
 */
function isStaleChunkError(error: Error): boolean {
  const message = `${error.name} ${error.message}`.toLowerCase()
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('loading chunk') ||
    message.includes('loading css chunk') ||
    message.includes('chunkloaderror')
  )
}

/**
 * Generic React error boundary. Class component is required — React 19
 * still has no hooks-based API for rendering fallbacks on render-time throws.
 *
 * Wraps any subtree so a single broken component can't white-screen the app.
 * Falls back to a friendly card with "Try again" (resets the boundary) and
 * "Go home" (full reload to `/`). Logs the error to the console for dev.
 *
 * 2026-05-19 — stale-chunk auto-recovery: when the caught error looks
 * like a Vercel-deploy-mid-session chunk failure, the boundary
 * triggers one full page reload (guarded by a sessionStorage flag so
 * a persistent failure doesn't loop). The user sees a brief reload
 * instead of the crash card, which matches what they'd manually do
 * with Cmd+Shift+R anyway.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? 'unknown', error, info.componentStack)

    // Auto-recover from stale-chunk errors after a deploy. Skip if we
    // reloaded within the guard window (means the new bundle ALSO
    // failed and looping won't help) — fall through to the normal
    // crash UI in that case.
    if (isStaleChunkError(error)) {
      let recentlyReloaded = false
      try {
        const last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY) ?? '0')
        recentlyReloaded = Date.now() - last < RELOAD_GUARD_WINDOW_MS
      } catch {
        // Storage can throw in private-mode browsers; fall through to
        // attempting the reload (worst case: a private-mode user sees
        // the crash UI on the second consecutive failure).
      }
      if (!recentlyReloaded) {
        try { window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now())) } catch { /* ignore */ }
        console.warn('[ErrorBoundary] stale-chunk detected; reloading once to pull the fresh bundle')
        window.location.reload()
      }
    }
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
