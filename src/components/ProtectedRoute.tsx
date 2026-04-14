import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, adminOnly: _adminOnly = false }: {
  children: React.ReactNode
  adminOnly?: boolean
}) {
  // DEMO BYPASS — skip auth for draft/demo site and local dev
  if (import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true') {
    return <>{children}</>
  }

  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (_adminOnly && !isAdmin) return <Navigate to="/" replace />

  return <>{children}</>
}
