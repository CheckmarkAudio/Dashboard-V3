import { flushSync } from 'react-dom'
import type { NavigateFunction } from 'react-router-dom'

export function navigateWithTransition(navigate: NavigateFunction, href: string) {
  const go = () => { navigate(href) }
  const canTransition = typeof document !== 'undefined'
    && typeof document.startViewTransition === 'function'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!canTransition) {
    go()
    return
  }
  document.startViewTransition?.(() => { flushSync(go) })
}
