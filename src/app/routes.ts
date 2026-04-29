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
    templates: '/admin/templates',
    // PR #52 (draft) — visual mock-up of the new Assign page per
    // boss's sketch. Lives alongside `/admin/templates` during the
    // visual pass; once the rebuild ships for real this likely
    // takes over the `templates` route.
    assignMockup: '/admin/assign-mockup',
    members: '/admin/my-team',
    // PR #51 — Clients admin page. Manages the studio's client list
    // — bookings link to a `clients` row so confirmations + reminders
    // (Tier 2 / Lean 2) have an email + phone on file.
    clients: '/admin/clients',
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
