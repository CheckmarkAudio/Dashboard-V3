import { lazy, type ReactElement } from 'react'
import { APP_ROUTES } from '../../app/routes'

// Code-split admin pages. See notes on the member routes file — same
// rationale. Admin pages tend to be heavier (BusinessHealth pulls in
// the full recharts bundle; TeamManager ships a lot of form state), so
// deferring them off the initial member bundle is especially valuable:
// a regular employee who never visits /admin never downloads any of it.
const AdminHub       = lazy(() => import('../../pages/admin/Hub'))
const TeamManager    = lazy(() => import('../../pages/admin/TeamManager'))
// PR #52 — Assign page redesign. The new member-centric editor
// (`AssignAdmin`) takes over the `/admin/templates` route (which is
// what the top-nav "Assign" link points at). The old widget-grid
// page (`Templates.tsx`) moves to `/admin/assign-classic` so the
// data + components stay reachable for the planned "tabs"
// integration on the new page.
const AssignAdmin    = lazy(() => import('../../pages/admin/AssignAdmin'))
const TemplatesClassic = lazy(() => import('../../pages/admin/Templates'))
// PR #49 — MyTeam.tsx retired. The read-only roster table got merged
// into TeamManager (now table-styled) so we have ONE canonical
// Members admin surface. Both `/admin/team` and `/admin/my-team`
// resolve to TeamManager so any saved bookmark / nav link still
// works.
// PR #64 — ClientsAdmin retired. Client management lives on the
// Booking page (`/sessions`) as a Bookings ↔ Clients toggle.
// PR #56 — full-page Templates manager. Reachable from the new
// Assign page sidebar's "Templates" link.
const TemplateLibrary = lazy(() => import('../../pages/admin/TemplateLibrary'))
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
  // PR #52 — canonical Assign route now renders the new member-
  // centric editor. The legacy widget-grid page is preserved at
  // /admin/assign-classic.
  { path: APP_ROUTES.admin.templates,     element: <AssignAdmin /> },
  { path: APP_ROUTES.admin.assignClassic, element: <TemplatesClassic /> },
  { path: APP_ROUTES.admin.assignMockup,  element: <AssignAdmin /> },
  { path: APP_ROUTES.admin.members,   element: <TeamManager /> },
  { path: APP_ROUTES.admin.templateLibrary, element: <TemplateLibrary /> },
  // Analytics now owns every chart + flywheel drill-down (was two
  // routes: /admin/health and /admin/flywheel). The mockup page is
  // deleted and its route removed — see notes in app/routes.ts.
  { path: APP_ROUTES.admin.analytics, element: <BusinessHealth /> },
  { path: APP_ROUTES.admin.settings,  element: <AdminSettings /> },
]
