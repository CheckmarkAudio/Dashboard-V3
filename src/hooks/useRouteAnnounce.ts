import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function useRouteAnnounce() {
  const { pathname } = useLocation()

  useEffect(() => {
    const main = document.getElementById('main-content')
    if (main) {
      main.focus({ preventScroll: true })
    }
  }, [pathname])
}
