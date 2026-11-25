import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Small pointer-follow tilt via CSS variables. No-ops when reduced motion is on. */
export function useCardTilt() {
  const ref = useRef<HTMLElement | null>(null)

  const reset = useCallback(() => {
    const node = ref.current
    if (!node) return
    node.style.setProperty('--tilt-x', '0deg')
    node.style.setProperty('--tilt-y', '0deg')
    node.style.setProperty('--glow-x', '50%')
    node.style.setProperty('--glow-y', '30%')
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const node = ref.current
    if (!node || prefersReducedMotion()) return
    const box = node.getBoundingClientRect()
    const px = (event.clientX - box.left) / box.width - 0.5
    const py = (event.clientY - box.top) / box.height - 0.5
    node.style.setProperty('--tilt-x', `${(-py * 6).toFixed(2)}deg`)
    node.style.setProperty('--tilt-y', `${(px * 7).toFixed(2)}deg`)
    node.style.setProperty('--glow-x', `${((px + 0.5) * 100).toFixed(1)}%`)
    node.style.setProperty('--glow-y', `${((py + 0.5) * 100).toFixed(1)}%`)
  }, [])

  return { ref, onPointerMove, onPointerLeave: reset }
}
