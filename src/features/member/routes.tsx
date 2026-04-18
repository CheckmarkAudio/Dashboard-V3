import { lazy, type ReactElement } from 'react'
import { APP_ROUTES } from '../../app/routes'

// Code-split member pages. Each lazy() call becomes its own JS chunk at
// build time, downloaded only when the route is first visited. Layout,
// Suspense, and the page shell stay in the main bundle so navigations
// feel instant and only the unique page payload streams in. Suspense
// fallback lives in Layout so every member route shares one loading
// boundary without reinitialising the header/nav on each nav.
const Dashboard      = lazy(() => import('../../pages/Dashboard'))
const Profile        = lazy(() => import('../../pages/Profile'))
const DailyChecklist = lazy(() => import('../../pages/DailyChecklist'))
const Sessions       = lazy(() => import('../../pages/Sessions'))
const Calendar       = lazy(() => import('../../pages/Calendar'))
const Content        = lazy(() => import('../../pages/Content'))

export interface FeatureRouteDef {
  path?: string
  index?: boolean
  element: ReactElement
}

export const MEMBER_ROUTES: FeatureRouteDef[] = [
  { index: true, element: <Dashboard /> },
  { path: APP_ROUTES.member.profile,  element: <Profile /> },
  { path: APP_ROUTES.member.tasks,    element: <DailyChecklist /> },
  { path: APP_ROUTES.member.booking,  element: <Sessions /> },
  { path: APP_ROUTES.member.calendar, element: <Calendar /> },
  { path: APP_ROUTES.member.content,  element: <Content /> },
]
