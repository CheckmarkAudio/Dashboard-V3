import { isSampleMode } from '../preview/sampleMode'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Palette } from 'lucide-react'
import { useAppearance } from '../contexts/AppearanceContext'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { Button, PageHeader } from '../components/ui'
import type { PortalStyle } from '../lib/appearance'

const styles: { id: PortalStyle; name: string }[] = [
  { id: 'classic', name: 'Classic' }, { id: 'soft-gold', name: 'Soft Gold' }, { id: 'studio', name: 'Studio' },
]
const memberPages: [string, string][] = [['Overview', '/'], ['Tasks', '/daily'], ['Projects', '/projects'], ['Calendar', '/calendar'], ['Booking & clients', '/sessions'], ['Forum & messages', '/content'], ['Media library', '/add-media']]
const adminPages: [string, string][] = [['Dashboard', '/admin'], ['Assign', '/admin/templates'], ['Assignment tools', '/admin/assign-classic'], ['Members', '/admin/my-team'], ['Template library', '/admin/template-library'], ['Analytics', '/admin/health'], ['Settings', '/admin/settings']]

export default function Appearance() {
  useDocumentTitle('Appearance — Checkmark Audio')
  const { style, setStyle, reducedMotion, setReducedMotion } = useAppearance()
  const { preference, setPreference } = useTheme()
  const { profile, canAccessAdmin } = useAuth()
  const [selected, setSelected] = useState(style)
  return <div className="appearance-page space-y-7">
    <PageHeader title="Appearance" icon={Palette} />
    <section aria-label="Portal style">
      <div className="appearance-styles">
        {styles.map(option => <button key={option.id} type="button" aria-pressed={selected === option.id} onClick={() => setSelected(option.id)} className="appearance-choice focus-ring">
          <span className={`appearance-swatch appearance-swatch-${option.id}`} aria-hidden="true"><i /><span><b /><b /><b /></span></span>
          <span className="flex items-center justify-between gap-2 p-4"><strong>{option.name}</strong>{selected === option.id && <Check size={18} />}</span>
        </button>)}
      </div>
      <div className="flex items-center gap-4 mt-4"><Button disabled={selected === style} onClick={() => setStyle(selected)}>Apply style</Button><span className="text-xs text-text-muted">Saved on this browser</span></div>
    </section>
    <section className="appearance-preferences" aria-label="Display preferences">
      <fieldset><legend>Light & dark</legend><div className="flex flex-wrap gap-2 mt-3">{(['light', 'dark', 'system'] as const).map(value => <button key={value} type="button" aria-pressed={preference === value} onClick={() => setPreference(value)} className="appearance-mode focus-ring capitalize">{value}</button>)}</div></fieldset>
      <label className="flex items-center gap-3"><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} />Reduce motion</label>
    </section>
    {import.meta.env.DEV && <div className="flex flex-wrap items-center gap-3"><a className="appearance-mode focus-ring" href={isSampleMode() ? "/appearance?sample=0" : "/appearance?sample=1"}>{isSampleMode() ? "Exit sample preview" : "Open sample preview"}</a><span className="text-xs text-text-muted">Local sample data · read-only</span></div>}
    <section aria-labelledby="preview-pages"><h2 id="preview-pages" className="text-xl mb-4">Pages</h2><div className="appearance-pages">{[...memberPages, ...(profile ? [['My profile', `/profile/${profile.id}`] as [string, string]] : []), ...(canAccessAdmin ? adminPages : [])].map(([label, path]) => <Link key={path} to={path} className="appearance-page-link focus-ring">{label}<ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div></section>
  </div>
}
