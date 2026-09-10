import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'
import workspaceCss from '../workspace.css?inline'
import { APPEARANCE_KEY, resolvePortalStyle, type PortalStyle } from '../lib/appearance'

const AppearanceContext = createContext<{ style: PortalStyle; setStyle: (style: PortalStyle) => void; reducedMotion: boolean; setReducedMotion: (value: boolean) => void } | null>(null)

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<PortalStyle>(() => {
    try { return resolvePortalStyle(localStorage.getItem(APPEARANCE_KEY)) } catch { return 'classic' }
  })
  const [reducedMotion, setMotionState] = useState(() => {
    try { return localStorage.getItem('checkmark-reduce-motion') !== 'false' } catch { return true }
  })
  useLayoutEffect(() => {
    document.documentElement.dataset.portalStyle = style
    document.documentElement.dataset.reduceMotion = String(reducedMotion)
    if (style === 'classic') return
    const sheet = document.createElement('style')
    sheet.dataset.portalStylesheet = style
    sheet.textContent = workspaceCss
    document.head.appendChild(sheet)
    return () => sheet.remove()
  }, [style, reducedMotion])
  const setStyle = (next: PortalStyle) => {
    setStyleState(next)
    try { localStorage.setItem(APPEARANCE_KEY, next) } catch { /* Browser-only preference. */ }
  }
  const setReducedMotion = (next: boolean) => {
    setMotionState(next)
    try { localStorage.setItem('checkmark-reduce-motion', String(next)) } catch { /* Browser-only preference. */ }
  }
  return <AppearanceContext.Provider value={{ style, setStyle, reducedMotion, setReducedMotion }}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('AppearanceProvider is required')
  return value
}
