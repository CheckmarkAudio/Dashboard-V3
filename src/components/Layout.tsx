import { Suspense, useState, useRef, useEffect, useLayoutEffect, useMemo, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useRouteAnnounce } from '../hooks/useRouteAnnounce'
import { useQuickKeyListener } from '../hooks/useQuickKeyListener'
import { APP_ROUTES } from '../app/routes'
import ErrorBoundary from './ErrorBoundary'
import SelfReportModal from './SelfReportModal'
import ForcePasswordChangeModal from './auth/ForcePasswordChangeModal'
import checkmarkLogo from '../assets/checkmark-audio-logo.png'
import type { LucideProps } from 'lucide-react'
import {
  LayoutDashboard, Users, Calendar, Settings, Gauge,
  LogOut, Menu, X, ChevronDown, ClipboardList, CheckSquare,
  BarChart3, Briefcase, MessageSquare, Clock, Sun, Moon,
  Loader2, MoreHorizontal,
} from 'lucide-react'

/**
 * Shared fallback for the route-level Suspense boundary. Kept minimal
 * and centered so the header/nav stay fixed and only the page area
 * shows a spinner while a lazy route chunk streams in. The fallback
 * role/aria-label lets screen readers announce the loading state.
 */
function RouteLoadingFallback() {
  return (
    <div
      className="flex items-center justify-center py-24 text-text-light"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <Loader2 size={22} className="animate-spin text-gold" aria-hidden="true" />
    </div>
  )
}

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

/**
 * Horizontal variant used in the desktop top nav strip. Lighter visual weight
 * than the sidebar NavItem — icon + label sit inline, active state is a soft
 * outline + gold text rather than a bg-pill-with-bar, matching the reference
 * aesthetic (readable, spacious, no vertical accent bar).
 */
function TopNavItem({ link }: { link: NavLinkDef }) {
  return (
    <NavLink
      to={link.to}
      end={link.to === '/' || link.to === '/admin'}
      className={({ isActive }) =>
        [
          // Mockup spec: 22px rounded, 16px vertical padding equivalent
          // (h-10 reads ~40px), 14px font, gap-2.5 between icon + label.
          'inline-flex items-center gap-2.5 h-10 px-3.5 rounded-[22px] text-[14px] font-semibold transition-all duration-200 focus-ring whitespace-nowrap',
          isActive
            ? 'text-gold bg-gradient-to-b from-gold/18 to-gold/8 ring-1 ring-gold/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
            : 'text-text-muted hover:text-text hover:bg-white/[0.03]',
        ].join(' ')
      }
    >
      <link.icon size={16} strokeWidth={1.8} aria-hidden="true" />
      {link.label}
    </NavLink>
  )
}

/**
 * GitHub-style responsive top nav. Measures each item's natural width
 * once on mount, then watches the container with ResizeObserver. When
 * items won't fit, the tail is moved into a "More" overflow dropdown
 * instead of spawning a horizontal scrollbar. The divider between main
 * and admin items stays put when both sides have visible items, and
 * drops out cleanly when the boundary is crossed.
 */
type TopNavEntry =
  | { kind: 'link'; link: NavLinkDef }
  | { kind: 'divider' }

function MoreDropdown({ entries }: { entries: TopNavEntry[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const links = entries.filter((e): e is Extract<TopNavEntry, { kind: 'link' }> => e.kind === 'link')

  // Close when route changes (covers item-click navigation)
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Anchor the dropdown to the button on open + window resize/scroll
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      if (!buttonRef.current) return
      const r = buttonRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (buttonRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const anyActive = links.some(({ link }) => {
    const end = link.to === '/' || link.to === '/admin'
    return end ? location.pathname === link.to : location.pathname.startsWith(link.to)
  })

  // Three states with distinct visual weight so More never competes
  // with the truly-active nav pill:
  //   • anyActive — overflow link is the current page → full gold pill
  //   • open      — menu is showing but no active link → muted ring only
  //   • idle      — same neutral hover style as other TopNavItems
  const triggerClass = anyActive
    ? 'text-gold bg-gradient-to-b from-gold/18 to-gold/8 ring-1 ring-gold/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
    : open
      ? 'text-text bg-white/[0.04] ring-1 ring-white/10'
      : 'text-text-muted hover:text-text hover:bg-white/[0.03]'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-[22px] text-[14px] font-semibold transition-all duration-200 focus-ring ${triggerClass}`}
      >
        <MoreHorizontal size={16} strokeWidth={1.8} aria-hidden="true" />
        More
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="menu"
          style={{ top: pos.top, right: pos.right }}
          className="fixed min-w-[200px] rounded-xl border border-border/60 bg-surface/95 backdrop-blur-md shadow-2xl py-1 z-[60] animate-slide-up"
        >
          {links.map(({ link }) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/' || link.to === '/admin'}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg text-[13px] font-medium transition-colors',
                  isActive
                    ? 'text-gold bg-gold/10'
                    : 'text-text-muted hover:bg-white/[0.04] hover:text-text',
                ].join(' ')
              }
            >
              <link.icon size={15} strokeWidth={1.8} aria-hidden="true" />
              {link.label}
            </NavLink>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

function ResponsiveTopNav({ entries }: { entries: TopNavEntry[] }) {
  const containerRef = useRef<HTMLElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const widthsRef = useRef<number[]>([])
  const moreWidthRef = useRef<number>(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [measureTick, setMeasureTick] = useState(0)

  // Gap between children is gap-1 → 4px. Tiny safety buffer keeps the
  // last item from flirting with sub-pixel rounding bugs that would
  // produce the dreaded 1px scrollbar.
  const GAP = 4
  const SAFETY = 2

  // Stable signature of the entries array — reduces churn so the
  // measurement effect doesn't fire when the parent passes a fresh
  // array literal each render with the same content.
  const entriesKey = useMemo(
    () => entries.map((e) => (e.kind === 'divider' ? '|' : e.link.to)).join(','),
    [entries],
  )

  // Measure each entry's natural width whenever the entries list
  // changes. Stored in refs so we don't trigger a re-render storm
  // through useState; we bump `measureTick` once when measurements
  // are ready so visibleCount can recompute.
  useLayoutEffect(() => {
    if (!measureRef.current) return
    const nodes = Array.from(measureRef.current.children) as HTMLElement[]
    widthsRef.current = nodes.map((n) => n.offsetWidth)
    if (moreRef.current) moreWidthRef.current = moreRef.current.offsetWidth
    setMeasureTick((t) => t + 1)
  }, [entriesKey])

  // Track the container width via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    setContainerWidth(el.clientWidth)
    const ro = new ResizeObserver((es) => {
      for (const e of es) setContainerWidth(e.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // How many leading entries fit, reserving space for "More" when needed.
  const visibleCount = useMemo(() => {
    const widths = widthsRef.current
    const moreWidth = moreWidthRef.current
    if (!containerWidth || widths.length !== entries.length) return entries.length

    const sumWith = (count: number) =>
      widths.slice(0, count).reduce((s, w, i) => s + w + (i > 0 ? GAP : 0), 0)

    // Fits all without any overflow button?
    if (sumWith(entries.length) + SAFETY <= containerWidth) return entries.length

    // Otherwise reserve the "More" button's width (+ gap before it)
    const reserve = moreWidth + GAP + SAFETY
    for (let count = entries.length - 1; count >= 0; count--) {
      if (sumWith(count) + reserve <= containerWidth) {
        // Don't leave a trailing divider visible with nothing after it
        const last = entries[count - 1]
        if (last && last.kind === 'divider') return count - 1
        return count
      }
    }
    return 0
  }, [containerWidth, measureTick, entries])

  const visible = entries.slice(0, visibleCount)
  const overflow = entries.slice(visibleCount).filter((e) => e.kind === 'link')

  return (
    <nav
      ref={containerRef}
      className="hidden lg:flex items-center gap-1 px-4 lg:px-6 h-11 border-t border-border/60 relative overflow-hidden"
      aria-label="Primary navigation"
    >
      {/* Hidden measurement row — absolute + invisible so it doesn't
          affect layout, but rendered in the DOM so we can read each
          item's natural offsetWidth. The parent's `overflow-hidden`
          clips it so it can't trigger a scrollbar even before measured. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="absolute left-0 top-0 invisible pointer-events-none flex items-center gap-1"
      >
        {entries.map((entry, i) =>
          entry.kind === 'divider'
            ? <span key={`m-div-${i}`} className="mx-2 h-5 w-px bg-border/60" />
            : <TopNavItem key={`m-${entry.link.to}`} link={entry.link} />
        )}
      </div>
      <div
        ref={moreRef}
        aria-hidden="true"
        className="absolute left-0 top-0 invisible pointer-events-none"
      >
        <div className="inline-flex items-center gap-1.5 h-10 px-3 rounded-[22px] text-[14px] font-semibold">
          <MoreHorizontal size={16} strokeWidth={1.8} />
          More
        </div>
      </div>

      {/* Actual visible items */}
      {visible.map((entry, i) =>
        entry.kind === 'divider'
          ? <span key={`div-${i}`} className="mx-2 h-5 w-px bg-border/60" aria-hidden="true" />
          : <TopNavItem key={entry.link.to} link={entry.link} />
      )}

      {overflow.length > 0 && <MoreDropdown entries={overflow} />}
    </nav>
  )
}

/* ── Menu-Sidebar v5.2 — Main menu ──
   Note: "Content" was renamed to "Forum" in April 2026 to reflect what
   the page actually is (team discussion channels) rather than the more
   generic original name. The route URL stays as `/content` so existing
   bookmarks still work. */
const mainLinks: NavLinkDef[] = [
  { to: APP_ROUTES.member.overview, icon: LayoutDashboard, label: 'Overview' },
  { to: APP_ROUTES.member.tasks, icon: CheckSquare, label: 'Tasks' },
  { to: APP_ROUTES.member.calendar, icon: Calendar, label: 'Calendar' },
  { to: APP_ROUTES.member.booking, icon: Briefcase, label: 'Booking' },
  { to: APP_ROUTES.member.content, icon: MessageSquare, label: 'Forum' },
]

/* ── Menu-Sidebar v5.2 — Admin menu ──
   "Flywheel" removed in April 2026; everything merged into Analytics.
   Same chart content now lives under /admin/health. */
const adminLinks: NavLinkDef[] = [
  // Label renamed from "Hub" → "Dashboard" per product direction.
  // The underlying route (APP_ROUTES.admin.hub = /admin) is unchanged
  // so existing links/bookmarks still work; only the UI label shifts.
  // Admin Dashboard — Gauge icon reads as "metrics / control view,"
  // matches what the page actually is (admin widget grid for ops
  // oversight). Distinct from the Overview icon (LayoutDashboard)
  // so the two don't look identical in the top nav.
  { to: APP_ROUTES.admin.hub, icon: Gauge, label: 'Dashboard' },
  { to: APP_ROUTES.admin.templates, icon: ClipboardList, label: 'Assign' },
  // PR #49 — Members nav link repointed from `admin.members`
  // (`/admin/my-team`, the legacy read-only roster table) to
  // `admin.team` (`/admin/team`, TeamManager) so the visible
  // "Members" page is the interactive management surface (Add /
  // Edit / role toggle / search / filter / status / templates).
  // The legacy `/admin/my-team` route still resolves for any saved
  // bookmark; it's just no longer linked from the top nav.
  { to: APP_ROUTES.admin.team, icon: Users, label: 'Members' },
  { to: APP_ROUTES.admin.analytics, icon: BarChart3, label: 'Analytics' },
]
const settingsLink: NavLinkDef = { to: APP_ROUTES.admin.settings, icon: Settings, label: 'Settings' }

export default function Layout() {
  const { profile, canAccessAdmin, appRole, signOut } = useAuth()
  const { resolved: resolvedTheme, toggle: toggleTheme } = useTheme()
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
  useQuickKeyListener()

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
    navigate(APP_ROUTES.auth.login)
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

        {canAccessAdmin && (
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
    <div
      className="dashboard-shell flex flex-col"
      style={{ minHeight: 'calc(100vh - var(--shell-gap) * 2)' }}
    >
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* ── Top header (two-row: logo/controls + horizontal nav) ── */}
      <header className="border-b border-border/60 shrink-0 z-40 sticky top-0 backdrop-blur-md bg-surface/70">
        {/* Row 1: logo · (mobile hamburger) · right-aligned controls */}
        <div className="h-14 flex items-center px-4 lg:px-6">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-surface-hover transition-colors text-text-muted lg:hidden mr-2"
            aria-label="Open navigation menu"
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          {/* Left: Logo + brand. The two-line text block hides below md
              so the logo alone stays visible at narrow widths — matches
              GitHub's approach of compressing the brand chrome before
              compressing the nav. */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <img
              src={checkmarkLogo}
              alt="Checkmark Audio logo"
              className="w-10 h-10 object-contain shrink-0"
            />
            <div className="leading-tight hidden md:block">
              <h1 className="font-bold text-[15px] tracking-[-0.02em] text-text whitespace-nowrap">Checkmark Audio</h1>
              <p className="text-[12px] text-gold font-semibold whitespace-nowrap">Workspace</p>
            </div>
          </div>

          {/* Right section: Theme toggle + Clock + Profile */}
          <div className="ml-auto flex items-center gap-3 lg:gap-4 min-w-0">
            {/* Theme toggle — light/dark. System preference stays accessible
                via ThemeContext for anyone who wants a future Settings UI. */}
            <button
              type="button"
              onClick={toggleTheme}
              className="shrink-0 p-2 rounded-lg text-text-muted hover:bg-surface-hover hover:text-gold transition-colors focus-ring"
              aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {resolvedTheme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </button>

            {/* Clock In / Clock Out — gold gradient pill with soft
                drop shadow, matching the mockup's clock-btn. */}
            {!clockedIn ? (
              <button
                onClick={() => { setClockedIn(true); setClockInTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })) }}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-b from-gold to-gold-muted text-black text-[13px] font-extrabold hover:brightness-105 transition-all shadow-[0_14px_28px_rgba(214,170,55,0.22)]"
              >
                <Clock size={14} strokeWidth={2} />
                Clock In
              </button>
            ) : (
              <>
                {showSelfReport && (
                  <SelfReportModal
                    clockInTime={clockInTime}
                    onClose={() => { setShowSelfReport(false); setClockedIn(false); setClockInTime('') }}
                    // Log Out must actually end the Supabase session — the
                    // previous version only navigated to /login, which
                    // bounced right back to / because the session was
                    // still active. Reuse handleSignOut so the session is
                    // destroyed locally (and best-effort server-side)
                    // before we reset clock-in state and navigate.
                    onLogout={async () => {
                      setShowSelfReport(false)
                      setClockedIn(false)
                      setClockInTime('')
                      await handleSignOut()
                    }}
                  />
                )}
                <button
                  onClick={() => setShowSelfReport(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold/12 text-gold border border-gold/25 text-[12px] font-semibold hover:bg-gold/20 transition-all"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                  {clockInTime} · Clock Out
                </button>
              </>
            )}

            {/* Profile — clickable to the signed-in user's own profile */}
            <button
              onClick={() => profile?.id && navigate(`/profile/${profile.id}`)}
              disabled={!profile?.id}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer focus-ring rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Avatar — bigger (44px) + thicker ring per mockup. */}
              <div
                className="w-11 h-11 rounded-full bg-surface-alt border-[3px] border-white/12 text-gold flex items-center justify-center text-[15px] font-bold shrink-0"
                title={profile?.email ?? 'Signed in'}
              >
                {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[13px] font-semibold text-text tracking-tight truncate max-w-[140px]">
                  {profile?.display_name ?? 'User'}
                </p>
                <p className="text-[11px] text-text-light truncate max-w-[180px]">
                  {appRole}
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
        </div>

        {/* Row 2: horizontal top nav (desktop) — responsive with
            GitHub-style overflow dropdown. Tail items collapse into a
            "More" menu when they don't fit instead of spawning a
            horizontal scrollbar. */}
        <ResponsiveTopNav
          entries={[
            ...mainLinks.map<TopNavEntry>((link) => ({ kind: 'link', link })),
            ...(canAccessAdmin
              ? [
                  { kind: 'divider' } as TopNavEntry,
                  ...adminLinks.map<TopNavEntry>((link) => ({ kind: 'link', link })),
                  { kind: 'link', link: settingsLink } as TopNavEntry,
                ]
              : []),
          ]}
        />
      </header>

      {/* ── Mobile drawer (unchanged — uses vertical sidebar JSX) ── */}
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

      {/* ── Main content (now full-width — nav lives in the top header) ── */}
      <main id="main-content" className="flex-1 flex flex-col min-w-0 overflow-hidden" tabIndex={-1}>
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <ErrorBoundary key={location.pathname} label="This page">
            <Suspense fallback={<RouteLoadingFallback />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <ForcePasswordChangeModal />
    </div>
  )
}
