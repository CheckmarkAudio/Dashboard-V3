import SamplePreviewBadge from './SamplePreviewBadge'
import AppearanceLink from './AppearanceLink'
import { Suspense, useState, useRef, useEffect, type ComponentType } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useRouteAnnounce } from '../hooks/useRouteAnnounce'
import { useQuickKeyListener } from '../hooks/useQuickKeyListener'
import { usePresenceHeartbeat } from '../lib/presence/usePresenceHeartbeat'
import { APP_ROUTES } from '../app/routes'
import ErrorBoundary from './ErrorBoundary'
import HeaderActivityBar from './HeaderActivityBar'
import WorkspaceJump from './WorkspaceJump'
import NotificationsBell from './notifications/NotificationsBell'
import MessagesBell from './messages/MessagesBell'
import CommunicationNotifier from './communication/CommunicationNotifier'
import { DmDockProvider } from './messages/DmDockContext'
import DmDock from './messages/DmDock'
import FlywheelDemoBadge from './flywheel/FlywheelDemoBadge'
import ForcePasswordChangeModal from './auth/ForcePasswordChangeModal'
import MemberAvatar from './members/MemberAvatar'
import TroubleshootingButton from './TroubleshootingButton'
import checkmarkLogo from '../assets/checkmark-audio-logo.png'
import { fetchTeamSiteBranding, teamSiteBrandingKeys } from '../lib/queries/teamSiteBranding'
import type { LucideProps } from 'lucide-react'
import {
  LayoutDashboard, Users, Calendar, Settings, Gauge,
  Menu, X, ChevronDown, ClipboardList, CheckSquare,
  BarChart3, Briefcase, MessageSquare, Sun, Moon,
  Loader2, FolderUp, FolderKanban, Palette, Pencil,
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
          'workspace-nav-item relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus-ring',
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

/* ── Menu-Sidebar v5.2 — Main menu ──
   Note: "Content" was renamed to "Forum" in April 2026 to reflect what
   the page actually is (team discussion channels) rather than the more
   generic original name. The route URL stays as `/content` so existing
   bookmarks still work. */
const mainLinks: NavLinkDef[] = [
  { to: APP_ROUTES.member.overview, icon: LayoutDashboard, label: 'Overview' },
  { to: APP_ROUTES.member.tasks, icon: CheckSquare, label: 'Tasks' },
  { to: APP_ROUTES.member.projects, icon: FolderKanban, label: 'Projects' },
  { to: APP_ROUTES.member.calendar, icon: Calendar, label: 'Calendar' },
  { to: APP_ROUTES.member.booking, icon: Briefcase, label: 'Booking' },
  { to: APP_ROUTES.member.content, icon: MessageSquare, label: 'Forum' },
  // 2026-05-14 — Media tab. Visible to all logged-in members.
  // Uploads go to the per-member subfolder under the shared
  // "Checkmark Media" Drive folder via the upload-to-drive edge fn.
  // 2026-05-17 — label shortened from "Add Media" to "Media" per
  // user direction (cleaner nav read; the page still handles upload
  // as its primary action so the route key stays `addMedia`).
  { to: APP_ROUTES.member.addMedia, icon: FolderUp, label: 'Media' },
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
  // PR #49 — Members nav link points at `admin.members`
  // (`/admin/my-team`). Both `/admin/team` and `/admin/my-team`
  // now render the same TeamManager component (the legacy
  // read-only MyTeam.tsx was retired in this PR). Keeping the
  // friendlier `/admin/my-team` URL as the canonical link so saved
  // bookmarks still work — the route just renders the new
  // table-styled interactive Members admin page.
  { to: APP_ROUTES.admin.members, icon: Users, label: 'Members' },
  // PR #64 — Clients menu retired. Client management moved into the
  // Booking page (`/sessions`) as a Bookings ↔ Clients toggle so the
  // top nav stays focused on top-level surfaces.
  { to: APP_ROUTES.admin.analytics, icon: BarChart3, label: 'Analytics' },
]
const appearanceLink: NavLinkDef = { to: '/appearance', icon: Palette, label: 'Appearance' }
const settingsLink: NavLinkDef = { to: APP_ROUTES.admin.settings, icon: Settings, label: 'Settings' }

export default function Layout() {
  const { profile, canAccessAdmin, appRole } = useAuth()
  const { resolved: resolvedTheme, toggle: toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminExpanded, setAdminExpanded] = useState(true)

  const siteBrandingQuery = useQuery({
    queryKey: teamSiteBrandingKeys.current(),
    queryFn: fetchTeamSiteBranding,
    enabled: Boolean(profile?.id),
    staleTime: 5 * 60_000,
  })
  const siteBranding = siteBrandingQuery.data
  const siteBannerOpacity = siteBranding?.site_banner_url
    ? Math.max(0, Math.min(100, siteBranding.site_banner_opacity)) / 100
    : 0
  const siteBannerThemeOpacity = siteBranding?.site_banner_url
    ? 1 - siteBannerOpacity
    : 1
  const siteBannerReadabilityOpacity = siteBranding?.site_banner_url
    ? 0.28 + siteBannerThemeOpacity * 0.32
    : 1

  const navigate = useNavigate()
  const location = useLocation()
  usePresenceHeartbeat(profile?.id)
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [location.pathname])
  const drawerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(drawerRef, sidebarOpen)
  useRouteAnnounce()
  useQuickKeyListener()

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 760px)')
    const closeOnDesktop = () => { if (desktop.matches) setSidebarOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  useEffect(() => {
    if (!sidebarOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [sidebarOpen])

  const closeDrawer = () => setSidebarOpen(false)

  /* Shared destinations for the desktop rail and mobile drawer. */
  const renderSidebar = (id: string) => (
    <div className="flex flex-col h-full">
      <nav className="flex-1 px-3 pt-4 pb-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        <p className="px-3 pt-2 pb-2 text-label">Workspace</p>
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
                aria-controls={id}
              >
                <span className="text-label">Studio management</span>
                <ChevronDown
                  size={12}
                  aria-hidden="true"
                  className={`ml-auto text-text-light transition-transform duration-200 ${adminExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
            {adminExpanded && (
              <div id={id} className="space-y-0.5 animate-slide-up">
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
    <DmDockProvider>
    <div
      className="dashboard-shell workspace-shell"
    >
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <aside className="workspace-sidebar hidden lg:flex" aria-label="Workspace sidebar">
        <NavLink to="/" className="workspace-brand focus-ring">
          {/* Preserve the original headphones-and-microphone logo and brand name. */}
          <img src={checkmarkLogo} alt="Checkmark Audio logo" className="logo-themed h-10 w-10 shrink-0 object-contain" />
          <span><strong>Checkmark Audio</strong><small>Workspace</small></span>
        </NavLink>
        {renderSidebar('desktop-admin-nav')}
        <button className="workspace-account focus-ring" onClick={() => profile?.id && navigate(`/profile/${profile.id}`)} disabled={!profile?.id}>
          <MemberAvatar member={profile} size="sm" />
          <span><strong>{profile?.display_name ?? 'Your profile'}</strong><small>{appRole} · Account</small></span>
        </button>
      </aside>
      <div className="workspace-body">
      {/* Workspace tools and the existing configurable site banner. */}
      <header className="workspace-header relative border-b border-border shrink-0 z-40 bg-surface">
        <div className="workspace-header-banner relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {siteBranding?.site_banner_url ? (
            <>
              <img
                src={siteBranding.site_banner_url}
                alt=""
                className={[
                  'absolute inset-0 h-full w-full',
                  siteBranding.site_banner_fit === 'contain'
                    ? 'object-contain'
                    : siteBranding.site_banner_fit === 'original'
                      ? 'object-none object-center'
                      : 'object-cover',
                ].join(' ')}
                style={{ opacity: siteBannerOpacity }}
              />
              <div
                className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(212,170,74,0.14),transparent_32%),linear-gradient(90deg,rgba(255,255,255,0.03),transparent_42%,rgba(212,170,74,0.05))]"
                style={{ opacity: siteBannerThemeOpacity }}
              />
              <div
                className="absolute inset-0 bg-gradient-to-r from-bg/38 via-bg/10 to-bg/30"
                style={{ opacity: siteBannerReadabilityOpacity }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(212,170,74,0.10),transparent_32%),linear-gradient(90deg,rgba(255,255,255,0.03),transparent_42%,rgba(212,170,74,0.05))]" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/28 to-transparent" />
        </div>
        {canAccessAdmin && (
          <NavLink
            to={`${APP_ROUTES.admin.settings}?section=branding`}
            className="workspace-edit-header focus-ring"
            aria-label="Edit header"
            title="Edit header"
          >
            <Pencil size={12} aria-hidden="true" />
            <span>Edit header</span>
          </NavLink>
        )}

        <div className="workspace-toolbar relative z-10">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="workspace-mobile-trigger p-2 rounded-xl hover:bg-surface-hover transition-colors text-text-muted lg:hidden mr-2"
            aria-label="Open navigation menu"
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          {/* Left: Logo + brand. The two-line text block hides below md
              so the logo alone stays visible at narrow widths — matches
              GitHub's approach of compressing the brand chrome before
              compressing the nav. */}
          <div className="workspace-mobile-brand flex items-center gap-3 min-w-0 shrink-0 lg:hidden">
            <img
              src={checkmarkLogo}
              alt="Checkmark Audio logo"
              className="logo-themed w-10 h-10 object-contain shrink-0"
            />
            <div className="leading-tight hidden md:block">
              <h1 className="font-bold text-[15px] tracking-[-0.02em] text-text whitespace-nowrap">Checkmark Audio</h1>
              <p className="text-[12px] text-gold font-semibold whitespace-nowrap">Workspace</p>
            </div>
          </div>

          <WorkspaceJump links={[...mainLinks, appearanceLink, ...(canAccessAdmin ? [...adminLinks, settingsLink,
            { to: APP_ROUTES.admin.templateLibrary, icon: ClipboardList, label: 'Template library' },
            { to: APP_ROUTES.admin.assignClassic, icon: ClipboardList, label: 'Classic assignment tools' },
          ] : [])]} />
          {/* Cross-workspace controls */}
          <div className="workspace-utilities flex items-center gap-3 min-w-0">
            {/* Skin pass 2026-05-06 — SocialLinks (the small Instagram /
                TikTok / YouTube icons that were here as frontend-only
                stubs) removed per user direction "remove the small
                social media icons in the very top of the website." The
                live follower-count SocialStatsBar used by Overview/Hub stays —
                that's a separate component with real counts and compact route
                action-strip variants. */}

            {/* Skin pass 2026-05-06 — Book a Session moved back to the
                Overview page (sits to the right of the member panel
                via MemberHighlights' actions slot) per user feedback.
                Layout's top-bar reserves space for cross-app utilities
                only (activity bar, theme toggle, profile, bell). */}




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

            {/* Communication shortcuts stay together beside the account control. */}
            <SamplePreviewBadge />
            <AppearanceLink />
            <MessagesBell />
            <NotificationsBell />

            {/* Profile — clickable to the signed-in user's own profile */}
            <button
              onClick={() => profile?.id && navigate(`/profile/${profile.id}`)}
              disabled={!profile?.id}
              aria-label="Open my profile"
              className="workspace-profile flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer focus-ring rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Avatar — Lean 7 super-PR uses the canonical
                  `<MemberAvatar />` so an uploaded profile photo
                  shows up in the top bar instead of just the
                  initial. Wrapped with the existing thicker ring
                  per the mockup. */}
              <span
                className="ring-[3px] ring-white/12 rounded-full shrink-0 inline-flex"
                title={profile?.email ?? 'Signed in'}
              >
                <MemberAvatar member={profile} size="md" />
              </span>
              <div className="workspace-profile-name text-right hidden sm:block">
                <p className="text-[13px] font-semibold text-text tracking-tight truncate max-w-[140px]">
                  {profile?.display_name ?? 'User'}
                </p>
                <p className="text-[11px] text-text-light truncate max-w-[180px]">
                  {appRole}
                </p>
              </div>
            </button>
          </div>
        </div>
        </div>
        <div className="workspace-time-zone relative z-10" aria-label="Activity timeline">
          <div className="workspace-time-zone-inner">
            <div className="workspace-activity"><HeaderActivityBar /></div>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer (unchanged — uses vertical sidebar JSX) ── */}
      {sidebarOpen && (
        <div className="workspace-mobile-drawer fixed inset-0 z-50 lg:hidden" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" role="presentation" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-[220px] bg-surface h-full shadow-2xl animate-slide-in">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface-hover text-text-muted"
              aria-label="Close navigation menu"
            >
              <X size={18} aria-hidden="true" />
            </button>
            {renderSidebar('mobile-admin-nav')}
          </aside>
        </div>
      )}

      {/* Routed pages retain their existing state, permissions, and actions. */}
      <main ref={mainRef} id="main-content" className="workspace-main flex-1 flex flex-col min-w-0" tabIndex={-1}>
        <div className="workspace-content flex-1 p-4 lg:p-7">
          <ErrorBoundary key={location.pathname} label="This page">
            <Suspense fallback={<RouteLoadingFallback />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      </div>

      <ForcePasswordChangeModal />

      {/* Lean 8 — global Troubleshooting button. Floats bottom-right
          on every signed-in page. The inline form on /content was
          retired in the same PR. */}
      <TroubleshootingButton />

      {/* Messenger-style floating chat dock. Lives outside the routed
          <Outlet/> so open conversations follow the user page to page. */}
      <DmDock />

      {/* "DEMO DATA" badge — only renders when ?flywheel-demo=1 is active. */}
      <FlywheelDemoBadge />
      <CommunicationNotifier />
    </div>
    </DmDockProvider>
  )
}
