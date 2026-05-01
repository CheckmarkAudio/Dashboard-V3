import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { APP_ROUTES } from '../app/routes'
import { hasCapability, isAtLeastRole, type AppCapability, type AppRole } from '../domain/permissions'

/**
 * Production alias — the canonical Live URL. The auth bypass below
 * MUST never fire on this hostname, even if `VITE_DEMO_MODE=true`
 * accidentally leaks into the production env scope on Vercel.
 *
 * PR #72 — hardened after the user reported "the login page is gone"
 * on the live URL. Root cause was `VITE_DEMO_MODE=true` getting baked
 * into the production build (env var was scoped wrong on Vercel,
 * making every visit auto-pass through to the dashboard). This guard
 * is defense-in-depth: even if the env var leaks, production refuses
 * to bypass.
 */
function isProductionAlias(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'dashboard-v3-dusky.vercel.app'
}

export default function ProtectedRoute({
  children,
  adminOnly: _adminOnly = false,
  requiredRole,
  requiredCapabilities = [],
}: {
  children: React.ReactNode
  adminOnly?: boolean
  requiredRole?: AppRole
  requiredCapabilities?: AppCapability[]
}) {
  // DEMO BYPASS — skip auth for local dev and (intentionally) the
  // Vercel branch-preview URLs when `VITE_DEMO_MODE=true`. Production
  // alias is hard-excluded by `isProductionAlias()` so a misconfigured
  // env var can NEVER bypass auth on the Live URL.
  const bypassEnabled = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true'
  if (bypassEnabled && !isProductionAlias()) {
    return <>{children}</>
  }

  const { user, loading, isAdmin, appRole } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  if (!user) return <Navigate to={APP_ROUTES.auth.login} replace />
  if (_adminOnly && !isAdmin) return <Navigate to={APP_ROUTES.member.overview} replace />
  if (requiredRole && !isAtLeastRole(appRole, requiredRole)) {
    return <Navigate to={APP_ROUTES.member.overview} replace />
  }
  if (requiredCapabilities.some(capability => !hasCapability(appRole, capability))) {
    return <Navigate to={APP_ROUTES.member.overview} replace />
  }

  return <>{children}</>
}
