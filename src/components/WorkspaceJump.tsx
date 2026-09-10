import { useEffect, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Search, type LucideProps } from 'lucide-react'
import { Modal } from './ui/Modal'

type Destination = { to: string; label: string; icon: ComponentType<LucideProps> }

/** Searches the existing destinations, including less visible admin tools. */
export default function WorkspaceJump({ links }: { links: Destination[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const results = links.filter(link => link.label.toLowerCase().includes(query.trim().toLowerCase()))
  const close = () => { setOpen(false); setQuery('') }
  const go = (to: string) => { close(); navigate(to) }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(value => !value)
        setQuery('')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return <>
    <button type="button" onClick={() => setOpen(true)} className="workspace-jump focus-ring" aria-label="Find a page" aria-keyshortcuts="Meta+k Control+k">
      <Search size={16} aria-hidden="true" />
      <span>Go to a page…</span><kbd>⌘ / Ctrl K</kbd>
    </button>
    <Modal open={open} onClose={close} title="Go to a page" size="md" hideCloseButton
      footer={<button type="button" onClick={close} className="rounded-lg border border-border px-3 py-2 text-sm focus-ring">Close</button>}>
      <input autoFocus value={query} onChange={event => setQuery(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && results[0]) go(results[0].to) }}
        placeholder="Tasks, booking, analytics…" aria-label="Filter pages"
        className="w-full rounded-lg border border-border px-3 py-3 mb-3 text-sm" />
      <div className="max-h-[50vh] overflow-y-auto space-y-1">
        {results.map(link => <button type="button" key={link.to} onClick={() => go(link.to)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-text hover:bg-surface-alt focus-ring">
          <link.icon size={17} className="text-gold" aria-hidden="true" />{link.label}<ArrowUpRight size={14} className="ml-auto text-text-light" aria-hidden="true" />
        </button>)}
        {results.length === 0 && <p className="p-3 text-sm text-text-muted" role="status">No matching pages. Try another name.</p>}
      </div>
    </Modal>
  </>
}
