import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { CheckSquare, FolderKanban, Menu, MessageSquare, WifiOff } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

export default function AppNavigation({ openMenu }: { openMenu: () => void }) {
  return <nav className="app-bottom-nav" aria-label="Quick navigation">
    <NavLink to="/projects" className="focus-ring"><FolderKanban size={21}/><span>Projects</span></NavLink>
    <NavLink to="/daily" className="focus-ring"><CheckSquare size={21}/><span>Tasks</span></NavLink>
    <NavLink to="/content" className="focus-ring"><MessageSquare size={21}/><span>Forum</span></NavLink>
    <button type="button" className="focus-ring" onClick={openMenu}><Menu size={21}/><span>More</span></button>
  </nav>
}

export function ConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const client = useQueryClient()
  useEffect(() => {
    const reconnect = () => { setOnline(true); void client.invalidateQueries({ predicate: query => !String(query.queryKey[0]).endsWith('-draft') }) }
    const disconnect = () => setOnline(false)
    window.addEventListener('online', reconnect)
    window.addEventListener('offline', disconnect)
    return () => { window.removeEventListener('online', reconnect); window.removeEventListener('offline', disconnect) }
  }, [client])
  if (online) return null
  return <div className="app-connection-status" role="status"><WifiOff size={18}/><span>You’re offline. Keep this app open; reconnect before saving.</span></div>
}
