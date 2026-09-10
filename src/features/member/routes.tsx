import { lazy, type ReactElement } from 'react'
import { useAppearance } from '../../contexts/AppearanceContext'
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
const Projects       = lazy(() => import('../../pages/Projects'))
const Sessions       = lazy(() => import('../../pages/Sessions'))
const Calendar       = lazy(() => import('../../pages/Calendar'))
const Content        = lazy(() => import('../../pages/Content'))
const AddMedia       = lazy(() => import('../../pages/AddMedia'))

const Appearance = lazy(() => import('../../pages/Appearance'))
const classicPages = {
  Dashboard: lazy(() => import('../../pages/DashboardClassic')),
  Calendar: lazy(() => import('../../pages/CalendarClassic')),
  Content: lazy(() => import('../../pages/ContentClassic')),
  AddMedia: lazy(() => import('../../pages/AddMediaClassic')),
}
function StyledPage({ name, children }: { name: keyof typeof classicPages; children: ReactElement }) {
  const { style } = useAppearance()
  const Classic = classicPages[name]
  return style === 'classic' ? <Classic /> : children
}

export interface FeatureRouteDef {
  path?: string
  index?: boolean
  element: ReactElement
}

export const MEMBER_ROUTES: FeatureRouteDef[] = [
  { path: "/appearance", element: <Appearance /> },
  { index: true, element: <StyledPage name="Dashboard"><Dashboard /></StyledPage> },
  { path: APP_ROUTES.member.profile,  element: <Profile /> },
  { path: APP_ROUTES.member.tasks,    element: <DailyChecklist /> },
  { path: APP_ROUTES.member.projects, element: <Projects /> },
  { path: APP_ROUTES.member.booking,  element: <Sessions /> },
  { path: APP_ROUTES.member.calendar, element: <StyledPage name="Calendar"><Calendar /></StyledPage> },
  { path: APP_ROUTES.member.content,  element: <StyledPage name="Content"><Content /></StyledPage> },
  { path: APP_ROUTES.member.addMedia, element: <StyledPage name="AddMedia"><AddMedia /></StyledPage> },
]
