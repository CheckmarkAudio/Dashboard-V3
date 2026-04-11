import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DailyChecklist from './pages/DailyChecklist'
import WeeklyChecklist from './pages/WeeklyChecklist'
import DailyNotes from './pages/DailyNotes'
import Schedule from './pages/Schedule'
import Projects from './pages/Projects'
import Sessions from './pages/Sessions'
import Content from './pages/Content'
import Pipeline from './pages/Pipeline'
import Education from './pages/Education'
import Reviews from './pages/Reviews'
import KPIDashboard from './pages/KPIDashboard'
import TeamManager from './pages/admin/TeamManager'
import Templates from './pages/admin/Templates'
import MyTeam from './pages/admin/MyTeam'
import BusinessHealth from './pages/admin/BusinessHealth'
import AdminSettings from './pages/admin/AdminSettings'

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
          <Route path="daily" element={<DailyChecklist />} />
          <Route path="weekly" element={<WeeklyChecklist />} />
          <Route path="notes" element={<DailyNotes />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="projects" element={<Projects />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="content" element={<Content />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="education" element={<Education />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="kpis" element={<KPIDashboard />} />
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
            path="admin/settings"
            element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
