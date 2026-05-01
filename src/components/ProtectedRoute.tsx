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
