import { lazy, type ReactElement } from 'react'
import { APP_ROUTES } from '../../app/routes'

// Code-split admin pages. See notes on the member routes file — same
// rationale. Admin pages tend to be heavier (BusinessHealth pulls in
// the full recharts bundle; TeamManager ships a lot of form state), so
// deferring them off the initial member bundle is especially valuable:
// a regular employee who never visits /admin never downloads any of it.
const AdminHub       = lazy(() => import('../../pages/admin/Hub'))
const TeamManager    = lazy(() => import('../../pages/admin/TeamManager'))
const Templates      = lazy(() => import('../../pages/admin/Templates'))
const MyTeam         = lazy(() => import('../../pages/admin/MyTeam'))
const BusinessHealth = lazy(() => import('../../pages/admin/BusinessHealth'))
const AdminSettings  = lazy(() => import('../../pages/admin/AdminSettings'))

export interface FeatureRouteDef {
  path?: string
  index?: boolean
  element: ReactElement
}

export const ADMIN_ROUTES: FeatureRouteDef[] = [
  { path: APP_ROUTES.admin.hub,       element: <AdminHub /> },
  { path: APP_ROUTES.admin.team,      element: <TeamManager /> },
  { path: APP_ROUTES.admin.templates, element: <Templates /> },
  { path: APP_ROUTES.admin.members,   element: <MyTeam /> },
  // Analytics now owns every chart + flywheel drill-down (was two
  // routes: /admin/health and /admin/flywheel). The mockup page is
  // deleted and its route removed — see notes in app/routes.ts.
  { path: APP_ROUTES.admin.analytics, element: <BusinessHealth /> },
  { path: APP_ROUTES.admin.settings,  element: <AdminSettings /> },
]
