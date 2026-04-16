import type { ReactElement } from 'react'
import TeamManager from '../../pages/admin/TeamManager'
import Templates from '../../pages/admin/Templates'
import MyTeam from '../../pages/admin/MyTeam'
import BusinessHealth from '../../pages/admin/BusinessHealth'
import AnalyticsMockup from '../../pages/admin/AnalyticsMockup'
import AdminSettings from '../../pages/admin/AdminSettings'
import AdminHub from '../../pages/admin/Hub'
import { APP_ROUTES } from '../../app/routes'

export interface FeatureRouteDef {
  path?: string
  index?: boolean
  element: ReactElement
}

export const ADMIN_ROUTES: FeatureRouteDef[] = [
  { path: APP_ROUTES.admin.hub, element: <AdminHub /> },
  { path: APP_ROUTES.admin.team, element: <TeamManager /> },
  { path: APP_ROUTES.admin.templates, element: <Templates /> },
  { path: APP_ROUTES.admin.members, element: <MyTeam /> },
  { path: APP_ROUTES.admin.analytics, element: <BusinessHealth /> },
  { path: APP_ROUTES.admin.flywheel, element: <AnalyticsMockup /> },
  { path: APP_ROUTES.admin.settings, element: <AdminSettings /> },
]
