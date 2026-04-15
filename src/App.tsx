import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DailyChecklist from './pages/DailyChecklist'
import Sessions from './pages/Sessions'
import Calendar from './pages/Calendar'
import Content from './pages/Content'
import TeamManager from './pages/admin/TeamManager'
import Templates from './pages/admin/Templates'
import MyTeam from './pages/admin/MyTeam'
import BusinessHealth from './pages/admin/BusinessHealth'
import AnalyticsMockup from './pages/admin/AnalyticsMockup'
import AdminSettings from './pages/admin/AdminSettings'
import AdminHub from './pages/admin/Hub'
import Profile from './pages/Profile'

/**
 * Foundation-First Phase 1: deprecated member routes (/weekly, /notes,
 * /schedule, /projects, /pipeline, /education, /reviews, /kpis) redirect
 * to / so old bookmarks keep working while the canonical IA narrows to
 * Overview / Tasks / Calendar / Booking / Content + admin. Their page
 * files are left on disk (unrouted) per the plan; they'll be pruned once
 * Phase 2 confirms nothing else depends on them.
 */
const DEPRECATED_ROUTES = [
  'weekly', 'notes', 'schedule', 'projects', 'pipeline', 'education', 'reviews', 'kpis',
]

export default function App() {
  return (
    <ErrorBoundary label="Checkmark Audio Dashboard">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="profile/:memberId" element={<Profile />} />
          <Route path="daily" element={<DailyChecklist />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="content" element={<Content />} />

          {/* Deprecated member routes — redirect to Overview */}
          {DEPRECATED_ROUTES.map(path => (
            <Route key={path} path={path} element={<Navigate to="/" replace />} />
          ))}

          <Route
            path="admin"
            element={<ProtectedRoute adminOnly><AdminHub /></ProtectedRoute>}
          />
          <Route
            path="admin/team"
            element={<ProtectedRoute adminOnly><TeamManager /></ProtectedRoute>}
          />
          <Route
            path="admin/templates"
            element={<ProtectedRoute adminOnly><Templates /></ProtectedRoute>}
          />
          <Route
            path="admin/my-team"
            element={<ProtectedRoute adminOnly><MyTeam /></ProtectedRoute>}
          />
          <Route
            path="admin/health"
            element={<ProtectedRoute adminOnly><BusinessHealth /></ProtectedRoute>}
          />
          <Route
            path="admin/flywheel"
            element={<ProtectedRoute adminOnly><AnalyticsMockup /></ProtectedRoute>}
          />
          <Route
            path="admin/settings"
            element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
