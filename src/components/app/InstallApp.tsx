import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button, Modal } from '../ui'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallApp() {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const update = () => setInstalled(media.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const done = () => { setInstalled(true); setPrompt(null); setOpen(false) }
    update()
    media.addEventListener('change', update)
    window.addEventListener('beforeinstallprompt', offer)
    window.addEventListener('appinstalled', done)
    return () => { media.removeEventListener('change', update); window.removeEventListener('beforeinstallprompt', offer); window.removeEventListener('appinstalled', done) }
  }, [])
  async function install() {
    if (!prompt) return
    setBusy(true); setError('')
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      if (choice.outcome === 'accepted') setOpen(false)
    } catch { setError('Use your browser’s install menu below.') }
    finally { setPrompt(null); setBusy(false) }
  }
  if (installed) return null
  return <>
    <button type="button" className="app-install-link workspace-nav-item focus-ring" onClick={() => setOpen(true)}><Download size={18} aria-hidden="true"/>Install app</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Install Checkmark" size="sm">
      <div className="app-install-guide">
        <p>Keep your projects one tap away on your phone, tablet, or computer.</p>
        {import.meta.env.DEV ? <p>This is a local preview. <a className="text-gold underline" href="https://cm-audio.vercel.app/projects" target="_blank" rel="noreferrer">Open the live app</a> to install it.</p> : prompt && <Button onClick={() => void install()} loading={busy}>Install on this device</Button>}
        {error && <p role="alert">{error}</p>}
        <div><h3>iPhone &amp; iPad</h3><p>Open in Safari. Tap Share → Add to Home Screen. Keep “Open as Web App” on if shown, then tap Add.</p></div>
        <div><h3>Android</h3><p>In Chrome, open the ⋮ menu → Add to Home screen → Install.</p></div>
        <div><h3>Computer</h3><p>Use the install icon in Chrome or Edge’s address bar. On a Mac, Safari also offers File → Add to Dock.</p></div>
        <p className="text-caption text-text-muted">Sign in with your Checkmark account. An internet connection is needed to load and save work.</p>
      </div>
    </Modal>
  </>
}
