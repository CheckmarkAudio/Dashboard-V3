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
    members: '/admin/my-team',
    analytics: '/admin/health',
    flywheel: '/admin/flywheel',
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
