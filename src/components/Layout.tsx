import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, FileText, Users, Calendar, Star, Target, Settings,
  LogOut, Menu, X, ChevronDown, Shield, ClipboardList, CheckSquare,
} from 'lucide-react'

const memberLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/daily', icon: FileText, label: 'Daily Notes' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/leads', icon: Target, label: 'Leads' },
  { to: '/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/reviews', icon: Star, label: 'Reviews' },
]

const adminLinks = [
  { to: '/admin/team', icon: Users, label: 'Team Manager' },
  { to: '/admin/templates', icon: ClipboardList, label: 'Templates' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminExpanded, setAdminExpanded] = useState(true)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-gradient-to-r from-brand-50 to-brand-100/50 text-brand-700 shadow-sm shadow-brand-100'
        : 'text-text-muted hover:bg-surface-hover hover:text-text'
    }`

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-brand-200">
            CA
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight">Checkmark Audio</h1>
            <p className="text-[11px] text-text-muted font-medium">Team Dashboard</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 pb-3 space-y-0.5 overflow-y-auto">
        <p className="px-3 pt-2 pb-2 text-[10px] font-semibold text-text-light uppercase tracking-widest">Menu</p>
        {memberLinks.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={linkClass}
            onClick={() => setSidebarOpen(false)}
          >
            <link.icon size={17} strokeWidth={2} />
            {link.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1">
              <button
                onClick={() => setAdminExpanded(!adminExpanded)}
                className="flex items-center gap-2 px-3 w-full"
              >
                <p className="text-[10px] font-semibold text-text-light uppercase tracking-widest">Admin</p>
                <ChevronDown
                  size={12}
                  className={`ml-auto text-text-light transition-transform duration-200 ${adminExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
            {adminExpanded && (
              <div className="space-y-0.5 animate-slide-up">
                {adminLinks.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={linkClass}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <link.icon size={17} strokeWidth={2} />
                    {link.label}
                  </NavLink>
                ))}
              </div>
            )}
          </>
        )}
      </nav>

      <div className="p-3 mx-3 mb-3 rounded-xl bg-surface-alt border border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
            {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{profile?.display_name ?? 'User'}</p>
            <p className="text-[11px] text-text-muted truncate capitalize">{profile?.position ?? 'Member'}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 transition-all"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen">
      <aside className="hidden lg:flex w-[260px] border-r border-border bg-surface flex-col shrink-0">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-[260px] bg-surface h-full shadow-2xl animate-slide-in">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface-hover"
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-md flex items-center px-4 lg:hidden shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-surface-hover transition-colors">
            <Menu size={20} />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-[9px]">CA</div>
            <span className="font-bold text-sm">Checkmark Audio</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
