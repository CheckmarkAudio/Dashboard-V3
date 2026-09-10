import { lazy, Suspense } from 'react'
import { useAppearance } from '../contexts/AppearanceContext'
const Classic = lazy(() => import('./LayoutClassic'))
const Workspace = lazy(() => import('./Layout'))
export default function PortalLayout() {
  const { style } = useAppearance()
  return <Suspense fallback={<div role="status" className="p-8">Loading workspace…</div>}>{style === 'classic' ? <Classic /> : <Workspace />}</Suspense>
}
