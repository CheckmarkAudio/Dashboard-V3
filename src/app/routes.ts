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
  },
  admin: {
    hub: '/admin',
    team: '/admin/team',
    // PR #52 — `/admin/templates` (the canonical Assign route the
    // top-nav points at) now renders the member-centric Assign
    // editor. The legacy widget-grid Assign page (Task Requests /
    // Approval Log / Edit Tasks / Assign / Assign Log / Templates)
    // moved to `/admin/assign-classic` so the data + components
    // stay reachable for the planned "tabs" integration.
    templates: '/admin/templates',
    assignClassic: '/admin/assign-classic',
    // Legacy preview-phase URL — kept so any saved bookmark still
    // works. Renders the same component as `templates`.
    assignMockup: '/admin/assign-mockup',
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
