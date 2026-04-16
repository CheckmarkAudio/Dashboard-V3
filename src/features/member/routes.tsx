import type { ReactElement } from 'react'
import Dashboard from '../../pages/Dashboard'
import Profile from '../../pages/Profile'
import DailyChecklist from '../../pages/DailyChecklist'
import Sessions from '../../pages/Sessions'
import Calendar from '../../pages/Calendar'
import Content from '../../pages/Content'
import { APP_ROUTES } from '../../app/routes'

export interface FeatureRouteDef {
  path?: string
  index?: boolean
  element: ReactElement
}

export const MEMBER_ROUTES: FeatureRouteDef[] = [
  { index: true, element: <Dashboard /> },
  { path: APP_ROUTES.member.profile, element: <Profile /> },
  { path: APP_ROUTES.member.tasks, element: <DailyChecklist /> },
  { path: APP_ROUTES.member.booking, element: <Sessions /> },
  { path: APP_ROUTES.member.calendar, element: <Calendar /> },
  { path: APP_ROUTES.member.content, element: <Content /> },
]
