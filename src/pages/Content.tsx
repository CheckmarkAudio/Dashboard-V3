import { useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  ExternalLink, Plus,
} from 'lucide-react'

/* ── Flywheel stage categories for suggestion form ── */
const SUGGESTION_CATEGORIES = ['Deliver', 'Capture', 'Share', 'Attract', 'Book'] as const
const ORG_CATEGORIES = ['Organizational', 'Technical'] as const

/* ── Placeholder inspo links (matching mockup) ── */
const inspoLinks = [
  { id: '1', title: 'Notion for Audio Prod', url: '#', thumbnail: '🎵' },
  { id: '2', title: 'UI Moodboard', url: '#', thumbnail: '🎨' },
  { id: '3', title: 'Apple Audio Gear', url: '#', thumbnail: '🎧' },
]

/* ── Placeholder troubleshooting entries ── */
const troubleshootEntries = [
  { id: '1', issue: 'Podcast publishing in new project', severity: 'Medium' },
  { id: '2', issue: 'Unable to import MP3 files', severity: 'High' },
]

function CategoryTag({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
        active
          ? 'bg-gold/15 text-gold border-gold/30'
          : 'text-text-muted border-border hover:text-text hover:border-border-light'
      }`}
    >
      {label}
    </button>
  )
}

export default function Content() {
  useDocumentTitle('Idea Board - Checkmark Audio')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [tab, setTab] = useState<'ideas' | 'submit'>('submit')
  const [newUrl, setNewUrl] = useState('')

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-text">Idea Board</h1>
        <p className="text-xs text-text-muted mt-0.5">Suggestions, fixes, and inspiration in one place.</p>
      </div>

      {/* Top row: Suggestions + Troubleshooting */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Suggestions */}
        <div className="bg-surface rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-text">Suggestions</h2>
            {/* Tab switcher */}
            <div className="flex gap-1 bg-surface-alt/50 p-0.5 rounded-lg border border-border">
              <button
                onClick={() => setTab('ideas')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  tab === 'ideas' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                Ideas
              </button>
              <button
                onClick={() => setTab('submit')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  tab === 'submit' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                Submit idea
              </button>
            </div>
          </div>
          <p className="text-[11px] text-text-muted mb-4">Small improvement ideas from the team.</p>

          {tab === 'submit' ? (
            <div className="space-y-3">
              {/* Category: What are you improving? */}
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">What are you improving?</label>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTION_CATEGORIES.map((cat) => (
                    <CategoryTag
                      key={cat}
                      label={cat}
                      active={selectedCategory === cat}
                      onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {ORG_CATEGORIES.map((cat) => (
                    <CategoryTag
                      key={cat}
                      label={cat}
                      active={selectedCategory === cat}
                      onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                    />
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <textarea
                  className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-text-light resize-none focus:border-gold"
                  rows={3}
                  placeholder="Describe your suggestion..."
                />
              </div>

              {/* Submit */}
              <button className="px-5 py-2 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold transition-colors">
                Submit
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-sm text-text-muted italic">No suggestions submitted yet. Switch to "Submit idea" to add one.</p>
            </div>
          )}
        </div>

        {/* Troubleshooting */}
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text mb-1">Troubleshooting</h2>
          <p className="text-[11px] text-text-muted mb-4">Report issues and propose fixes.</p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">Short issue description</label>
              <input
                type="text"
                className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm placeholder:text-text-light focus:border-gold"
                placeholder="Describe the issue..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">What we tried / ideas to fix</label>
              <input
                type="text"
                className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm placeholder:text-text-light focus:border-gold"
                placeholder="Steps taken and potential fixes"
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-text-muted block mb-1.5">Severity</label>
                <select className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm focus:border-gold">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>
              <button className="px-5 py-2 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold transition-colors shrink-0">
                Submit report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inspo board */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Inspo board</h2>
            <p className="text-[11px] text-text-muted mt-0.5">Links that help the business — products, aesthetics, references.</p>
          </div>
        </div>
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-1 bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm placeholder:text-text-light focus:border-gold"
            placeholder="Enter URL..."
          />
          <button className="px-4 py-2 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold transition-colors flex items-center gap-1.5">
            <Plus size={14} />
            Add link
          </button>
        </div>
        {/* Link cards */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {inspoLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              className="bg-surface-alt rounded-xl border border-border p-4 hover:border-gold/30 transition-colors group"
            >
              <div className="text-3xl mb-2">{link.thumbnail}</div>
              <p className="text-sm font-medium text-text group-hover:text-gold transition-colors truncate">{link.title}</p>
              <div className="flex items-center gap-1 mt-1 text-text-muted">
                <ExternalLink size={10} />
                <span className="text-[10px]">Open link</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
