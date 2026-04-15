import { useState, useRef, useEffect, type ComponentType } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useRouteAnnounce } from '../hooks/useRouteAnnounce'
import ErrorBoundary from './ErrorBoundary'
import SelfReportModal from './SelfReportModal'
import ForcePasswordChangeModal from './auth/ForcePasswordChangeModal'
import TeamHubIcon from './icons/TeamHubIcon'
import checkmarkLogo from '../assets/checkmark-audio-logo.png'
import type { LucideProps } from 'lucide-react'
import {
  LayoutDashboard, Users, Calendar, Settings,
  LogOut, LogIn, Menu, X, ChevronDown, ClipboardList, CheckSquare,
  BarChart3, Briefcase, Lightbulb, Clock,
} from 'lucide-react'

type NavLinkDef = {
  to: string
  icon: ComponentType<LucideProps>
  label: string
}

/**
 * Single nav entry in the sidebar. Lifts the link styling out of Layout so
 * hover / active / focus states stay in one place, and so keyboard focus
 * gets the gold `focus-ring` treatment automatically.
 */
function NavItem({ link, onNavigate }: { link: NavLinkDef; onNavigate: () => void }) {
  return (
    <NavLink
      to={link.to}
      end={link.to === '/' || link.to === '/admin'}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus-ring',
          isActive
            ? 'bg-white/[0.08] text-gold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-5 before:rounded-r-full before:bg-gold'
            : 'text-text-muted hover:bg-white/[0.04] hover:text-text',
        ].join(' ')
      }
    >
      <link.icon size={17} strokeWidth={2} aria-hidden="true" />
      {link.label}
    </NavLink>
  )
}

/* ── Menu-Sidebar v5.2 — Main menu ── */
const mainLinks: NavLinkDef[] = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/daily', icon: CheckSquare, label: 'Tasks' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/sessions', icon: Briefcase, label: 'Booking Agent' },
  { to: '/content', icon: Lightbulb, label: 'Idea Board' },
]

/* ── Menu-Sidebar v5.2 — Admin menu ── */
const adminLinks: NavLinkDef[] = [
  { to: '/admin', icon: TeamHubIcon as ComponentType<LucideProps>, label: 'Team Hub' },
  { to: '/admin/templates', icon: ClipboardList, label: 'Assign Tasks' },
  { to: '/admin/my-team', icon: Users, label: 'Members' },
  { to: '/admin/health', icon: BarChart3, label: 'Analytics' },
]
const settingsLink: NavLinkDef = { to: '/admin/settings', icon: Settings, label: 'Settings' }

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [clockedIn, setClockedIn] = useState(false)
  const [clockInTime, setClockInTime] = useState('')
  const [showSelfReport, setShowSelfReport] = useState(false)
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

  const closeDrawer = () => setSidebarOpen(false)

  /* ── Sidebar (navigation only — no logo/profile per v5.2) ── */
  const sidebar = (
    <div className="flex flex-col h-full">
      <nav className="flex-1 px-3 pt-4 pb-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        <p className="px-3 pt-2 pb-2 text-label">Menu</p>
        {mainLinks.map(link => (
          <NavItem key={link.to} link={link} onNavigate={closeDrawer} />
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1">
              <button
                type="button"
                onClick={() => setAdminExpanded(!adminExpanded)}
                className="flex items-center gap-2 px-3 w-full focus-ring rounded-md"
                aria-expanded={adminExpanded}
                aria-controls="admin-nav"
              >
                <p className="text-label">Admin</p>
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
                  <NavItem key={link.to} link={link} onNavigate={closeDrawer} />
                ))}
                <div className="mx-3 my-1.5 border-t border-border/40" />
                <NavItem link={settingsLink} onNavigate={closeDrawer} />
              </div>
            )}
          </>
        )}
      </nav>
    </div>
  )

  return (
    <div className="flex flex-col h-screen bg-bg">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* ── Header (full-width, flat, sticky — Menu-Sidebar v5.2) ── */}
      <header className="h-14 border-b border-border bg-surface flex items-center px-4 lg:px-6 shrink-0 z-40">
        {/* Mobile hamburger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl hover:bg-surface-hover transition-colors text-text-muted lg:hidden mr-2"
          aria-label="Open navigation menu"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        {/* Left: Logo + title */}
        <div className="flex items-center gap-3">
          <img
            src={checkmarkLogo}
            alt="Checkmark Audio logo"
            className="w-8 h-8 object-contain"
          />
          <div className="leading-tight">
            <h1 className="font-bold text-sm tracking-tight text-text">Checkmark Audio</h1>
            <p className="text-[11px] text-gold font-medium">dashboard</p>
          </div>
        </div>

        {/* Right section: Clock + Profile */}
        <div className="ml-auto flex items-center gap-4">
          {/* Clock In / Clock Out */}
          {!clockedIn ? (
            <button
              onClick={() => { setClockedIn(true); setClockInTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold text-black text-[12px] font-bold hover:bg-gold-muted transition-all shadow-sm"
            >
              <Clock size={13} />
              Clock In
            </button>
          ) : (
            <>
              {showSelfReport && <SelfReportModal clockInTime={clockInTime} onClose={() => { setShowSelfReport(false); setClockedIn(false); setClockInTime('') }} onLogout={() => { setShowSelfReport(false); setClockedIn(false); setClockInTime(''); navigate('/login') }} />}
              <button
                onClick={() => setShowSelfReport(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold/12 text-gold border border-gold/25 text-[12px] font-semibold hover:bg-gold/20 transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                {clockInTime} · Clock Out
              </button>
            </>
          )}

          {/* Profile — clickable to profile page */}
          <button onClick={() => navigate('/profile/jordan')} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer focus-ring rounded-xl">
            <div
              className="w-10 h-10 rounded-full bg-surface-alt border-2 border-border-light text-gold flex items-center justify-center text-[14px] font-bold shrink-0"
              title={profile?.email ?? 'Signed in'}
            >
              {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[13px] font-semibold text-text tracking-tight truncate max-w-[140px]">
                {profile?.display_name ?? 'User'}
              </p>
              <p className="text-[11px] text-text-light truncate max-w-[180px]">
                {profile?.role ?? 'Member'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="shrink-0 p-2 rounded-lg text-text-light hover:bg-surface-hover hover:text-red-400 transition-colors focus-ring"
            aria-label={`Sign out of ${profile?.email ?? 'this account'}`}
            title="Sign out"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── Desktop sidebar ── */}
        <aside className="hidden lg:flex w-[220px] border-r border-border bg-surface flex-col shrink-0">
          {sidebar}
        </aside>

        {/* ── Mobile drawer ── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" role="presentation" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-[220px] bg-surface h-full shadow-2xl animate-slide-in">
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

        {/* ── Main content ── */}
        <main id="main-content" className="flex-1 flex flex-col min-w-0" tabIndex={-1}>
          <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            <ErrorBoundary key={location.pathname} label="This page">
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <ForcePasswordChangeModal />
    </div>
  )
}
