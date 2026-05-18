import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { APP_ROUTES } from '../app/routes'
import { hasCapability, isAtLeastRole, type AppCapability, type AppRole } from '../domain/permissions'

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
  // Local-dev bypass only. `import.meta.env.DEV` is build-time true ONLY
  // when running `vite dev` — Vercel builds (preview AND production) get
  // `DEV=false`, so this can never bypass auth on a deployed site.
  if (import.meta.env.DEV) {
    return <>{children}</>
  }

  const { user, loading, isAdmin, appRole, profile } = useAuth()

  if (loading) {
    return <RouteSpinner />
  }

  if (!user) return <Navigate to={APP_ROUTES.auth.login} replace />

  // 2026-05-18 (Refresh-stays-put fix) — when a capability/role check
  // is required but the profile fetch is still in flight, KEEP showing
  // the spinner instead of pre-emptively redirecting to Overview.
  //
  // The bug: `AuthContext` defers the profile fetch via `setTimeout(0)`
  // so `setLoading(false)` lands BEFORE the profile arrives. During
  // that window `appRole` defaults to `'member'` (the safe fallback in
  // `getAppRole`), which fails admin-capability checks on the inner
  // `<ProtectedRoute requiredCapabilities=...>` wrappers in App.tsx.
  // The fallback `<Navigate to={overview} replace />` then changes the
  // URL — so refreshing any admin page bounced the user back to "/".
  //
  // Owner is a special case: `getAppRole(profile, email)` returns
  // 'owner' from email alone (before profile loads), so we don't have
  // to wait for them. Anyone else needs the profile before we can
  // honestly evaluate "do you have this capability?".
  const needsCapabilityCheck =
    _adminOnly || requiredRole !== undefined || requiredCapabilities.length > 0
  const profileStillResolving = needsCapabilityCheck && !profile && appRole !== 'owner'
  if (profileStillResolving) {
    return <RouteSpinner />
  }

  if (_adminOnly && !isAdmin) return <Navigate to={APP_ROUTES.member.overview} replace />
  if (requiredRole && !isAtLeastRole(appRole, requiredRole)) {
    return <Navigate to={APP_ROUTES.member.overview} replace />
  }
  if (requiredCapabilities.some(capability => !hasCapability(appRole, capability))) {
    return <Navigate to={APP_ROUTES.member.overview} replace />
  }

  return <>{children}</>
}

function RouteSpinner() {
  return (
    <div className="flex items-center justify-center h-screen bg-bg" role="status" aria-live="polite">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
