import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DailyNotes from './pages/DailyNotes'
import Leads from './pages/Leads'
import Schedule from './pages/Schedule'
import Reviews from './pages/Reviews'
import Tasks from './pages/Tasks'
import TeamManager from './pages/admin/TeamManager'
import Templates from './pages/admin/Templates'
import AdminSettings from './pages/admin/AdminSettings'

export default function App() {
  return (
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
        <Route path="daily" element={<DailyNotes />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="leads" element={<Leads />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="reviews" element={<Reviews />} />
        <Route
          path="admin/team"
          element={<ProtectedRoute adminOnly><TeamManager /></ProtectedRoute>}
        />
        <Route
          path="admin/templates"
          element={<ProtectedRoute adminOnly><Templates /></ProtectedRoute>}
        />
        <Route
          path="admin/settings"
          element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
