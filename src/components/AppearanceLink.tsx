import { Link } from 'react-router-dom'
import { Palette } from 'lucide-react'
export default function AppearanceLink() {
  return <Link to="/appearance" title="Appearance" aria-label="Appearance" className="focus-ring inline-flex items-center justify-center rounded-lg p-2 text-text-muted hover:bg-surface-hover"><Palette size={18} aria-hidden="true" /></Link>
}
