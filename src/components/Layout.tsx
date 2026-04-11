import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useRouteAnnounce } from '../hooks/useRouteAnnounce'
import ErrorBoundary from './ErrorBoundary'
import {
  LayoutDashboard, Users, Calendar, Settings,
  LogOut, Menu, X, ChevronDown, ClipboardList, CheckSquare,
  FolderKanban, Mic, GitBranch, GraduationCap, BarChart3, Pencil,
  Target, Star, UsersRound, FileText,
} from 'lucide-react'

const memberLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Today' },
  { to: '/daily', icon: ClipboardList, label: 'Daily Tasks' },
  { to: '/notes', icon: FileText, label: 'Daily Notes' },
  { to: '/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/kpis', icon: Target, label: 'My KPIs' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/sessions', icon: Mic, label: 'Sessions' },
  { to: '/content', icon: Pencil, label: 'Content' },
  { to: '/pipeline', icon: GitBranch, label: 'Pipeline' },
  { to: '/education', icon: GraduationCap, label: 'Education' },
  { to: '/weekly', icon: CheckSquare, label: 'Weekly Tasks' },
  { to: '/reviews', icon: Star, label: 'Performance Reviews' },
]

const adminLinks = [
  { to: '/admin/my-team', icon: UsersRound, label: 'My Team' },
  { to: '/admin/team', icon: Users, label: 'Team Manager' },
  { to: '/admin/templates', icon: ClipboardList, label: 'Templates' },
  { to: '/admin/health', icon: BarChart3, label: 'Business Health' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminExpanded, setAdminExpanded] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()
  const drawerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(drawerRef, sidebarOpen)
  useRouteAnnounce()

  useEffect(() => {
    if (!sidebarOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [sidebarOpen])

  const handleSignOut = async () => {
    try { await signOut() } catch {}
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-white/[0.08] text-gold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-5 before:rounded-r-full before:bg-gold'
        : 'text-text-muted hover:bg-white/[0.04] hover:text-text'
    }`

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold text-sm">
            CA
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-text">Checkmark Audio</h1>
            <p className="text-[11px] text-text-light font-medium">Command Center</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 pb-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        <p className="px-3 pt-2 pb-2 text-[10px] font-semibold text-text-light uppercase tracking-widest">Menu</p>
        {memberLinks.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={linkClass}
            onClick={() => setSidebarOpen(false)}
          >
            <link.icon size={17} strokeWidth={2} aria-hidden="true" />
            {link.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1">
              <button
                onClick={() => setAdminExpanded(!adminExpanded)}
                className="flex items-center gap-2 px-3 w-full"
                aria-expanded={adminExpanded}
                aria-controls="admin-nav"
              >
                <p className="text-[10px] font-semibold text-text-light uppercase tracking-widest">Admin</p>
                <ChevronDown
                  size={12}
                  aria-hidden="true"
                  className={`ml-auto text-text-light transition-transform duration-200 ${adminExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
            {adminExpanded && (
              <div id="admin-nav" className="space-y-0.5 animate-slide-up">
                {adminLinks.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={linkClass}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <link.icon size={17} strokeWidth={2} aria-hidden="true" />
                    {link.label}
                  </NavLink>
                ))}
              </div>
            )}
          </>
        )}
      </nav>

      <button
        onClick={handleSignOut}
        className="p-3 mx-3 mb-3 rounded-xl bg-surface-alt border border-border hover:bg-surface-hover transition-all cursor-pointer w-[calc(100%-1.5rem)] text-left"
        aria-label="Sign out"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gold/15 text-gold flex items-center justify-center text-xs font-bold" aria-hidden="true">
            {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-text">{profile?.display_name ?? 'User'}</p>
            <p className="text-[11px] text-text-light truncate capitalize">{profile?.position ?? 'Member'}</p>
          </div>
          <LogOut size={15} className="text-text-light shrink-0" aria-hidden="true" />
        </div>
      </button>
    </div>
  )

  return (
    <div className="flex h-screen bg-bg">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <aside className="hidden lg:flex w-[260px] border-r border-border bg-surface flex-col shrink-0">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" role="presentation" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-[260px] bg-surface h-full shadow-2xl animate-slide-in">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface-hover text-text-muted"
              aria-label="Close navigation menu"
            >
              <X size={18} aria-hidden="true" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main id="main-content" className="flex-1 flex flex-col min-w-0" tabIndex={-1}>
        <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-md flex items-center px-4 lg:hidden shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-surface-hover transition-colors text-text-muted" aria-label="Open navigation menu">
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold text-[9px]" aria-hidden="true">CA</div>
            <span className="font-bold text-sm text-text">Checkmark Audio</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {/* Per-route boundary — keyed by pathname so navigating away from
              a crashed page resets the boundary and renders the next page
              cleanly, while keeping the sidebar alive. */}
          <ErrorBoundary key={location.pathname} label="This page">
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
