import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import { APP_ROUTES, DEPRECATED_MEMBER_ROUTES } from './app/routes'
import { MEMBER_ROUTES } from './features/member/routes'
import { ADMIN_ROUTES } from './features/admin/routes'

export default function App() {
  return (
    <ErrorBoundary label="Checkmark Audio Dashboard">
      <Routes>
        <Route path={APP_ROUTES.auth.login} element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {MEMBER_ROUTES.map((route) => (
            route.index
              ? <Route key="member-index" index element={route.element} />
              : <Route key={route.path} path={route.path} element={route.element} />
          ))}

          {/* Deprecated member routes — redirect to Overview */}
          {DEPRECATED_MEMBER_ROUTES.map(path => (
            <Route key={path} path={path} element={<Navigate to={APP_ROUTES.member.overview} replace />} />
          ))}

          {ADMIN_ROUTES.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <ProtectedRoute requiredCapabilities={['view_admin_app']}>
                  {route.element}
                </ProtectedRoute>
              }
            />
          ))}
        </Route>
        <Route path="*" element={<Navigate to={APP_ROUTES.member.overview} replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
