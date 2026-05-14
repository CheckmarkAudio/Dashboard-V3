export const APP_ROUTES = {
  auth: {
    login: '/login',
  },
  member: {
    overview: '/',
    profile: '/profile/:memberId',
    tasks: '/daily',
    booking: '/sessions',
    calendar: '/calendar',
    content: '/content',
    addMedia: '/add-media',
  },
  admin: {
    hub: '/admin',
    // PR #52 — `/admin/templates` (the canonical Assign route the
    // top-nav points at) renders the member-centric Assign editor.
    // The legacy widget-grid Assign page (Task Requests / Approval
    // Log / Edit Tasks / Assign / Assign Log / Templates) lives at
    // `/admin/assign-classic` so the data + components stay
    // reachable for the planned "tabs" integration.
    //
    // 2026-05-07 link audit (PR #160) — dropped two legacy aliases
    // that nothing actively links to:
    //   • `team: '/admin/team'` (alias of `members: '/admin/my-team'`)
    //   • `assignMockup: '/admin/assign-mockup'` (preview-phase URL)
    // Either bookmark from before May 2026 now hits the app-level
    // fallback route → member overview, which is acceptable.
    templates: '/admin/templates',
    assignClassic: '/admin/assign-classic',
    // PR #56 — full-page Templates manager. Reachable from the new
    // Assign page sidebar's "Templates" link. The legacy widget is
    // still rendered inside `/admin/assign-classic` for reference.
    templateLibrary: '/admin/template-library',
    members: '/admin/my-team',
    // Analytics merged the standalone Flywheel page in April 2026.
    // All KPI charts, monthly trends, employee breakdowns, and the
    // stage drill-down live at `/admin/health` under BusinessHealth.
    // The legacy `/admin/flywheel` route is intentionally gone — a
    // stale bookmark hits the app-level fallback route and lands on
    // the member Overview, which is safer than 404-ing.
    analytics: '/admin/health',
    settings: '/admin/settings',
  },
} as const

export const DEPRECATED_MEMBER_ROUTES = [
  'weekly',
  'notes',
  'schedule',
  'projects',
  'pipeline',
  'education',
  'reviews',
  'kpis',
] as const

export function isAdminRoute(pathname: string): boolean {
  return pathname === APP_ROUTES.admin.hub || pathname.startsWith('/admin/')
}
