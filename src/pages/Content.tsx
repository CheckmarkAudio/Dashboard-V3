import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { DeliverableSubmission, PlatformMetric, TeamMember } from '../types'
import {
  Pencil,
  ExternalLink,
  Plus,
  X,
  Lightbulb,
  Instagram,
  Youtube,
  Music2,
} from 'lucide-react'

const CONTENT_TYPES = ['social_media_content', 'content_and_schedule'] as const

type SubmissionRow = DeliverableSubmission & { display_name?: string }

type Idea = { id: string; text: string; archived: boolean }

const PLATFORMS: { key: PlatformMetric['platform']; label: string; icon: typeof Instagram }[] = [
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'tiktok', label: 'TikTok', icon: Music2 },
  { key: 'youtube', label: 'YouTube', icon: Youtube },
]

export default function Content() {
  useDocumentTitle('Content - Checkmark Audio')
  const { profile } = useAuth()
  const { toast } = useToast()
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [metrics, setMetrics] = useState<Partial<Record<PlatformMetric['platform'], PlatformMetric>>>({})
  const [loading, setLoading] = useState(true)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [draftIdea, setDraftIdea] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: subs, error: subsErr }, { data: allMetrics, error: metErr }, { data: members }] =
        await Promise.all([
          supabase
            .from('deliverable_submissions')
            .select('*')
            .in('submission_type', [...CONTENT_TYPES])
            .order('submission_date', { ascending: false })
            .limit(80),
          supabase.from('platform_metrics').select('*').order('metric_date', { ascending: false }),
          supabase.from('intern_users').select('id, display_name'),
        ])

      if (subsErr) {
        toast('Could not load submissions', 'error')
        console.error(subsErr)
      }
      if (metErr) {
        toast('Could not load platform metrics', 'error')
        console.error(metErr)
      }

      const memberMap = new Map((members ?? []).map((m: TeamMember) => [m.id, m.display_name]))
      const enriched = (subs ?? []).map((s: DeliverableSubmission) => ({
        ...s,
        display_name: memberMap.get(s.intern_id) ?? 'Unknown',
      }))
      setSubmissions(enriched)

      const latestByPlatform: Partial<Record<PlatformMetric['platform'], PlatformMetric>> = {}
      for (const row of allMetrics ?? []) {
        const m = row as PlatformMetric
        if (!latestByPlatform[m.platform]) latestByPlatform[m.platform] = m
      }
      setMetrics(latestByPlatform)
    } catch (e) {
      console.error(e)
      toast('Failed to load content data', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const addIdea = () => {
    const t = draftIdea.trim()
    if (!t) return
    setIdeas(prev => [...prev, { id: crypto.randomUUID(), text: t, archived: false }])
    setDraftIdea('')
  }

  const archiveIdea = (id: string) => {
    setIdeas(prev => prev.map(i => (i.id === id ? { ...i, archived: true } : i)))
  }

  const unarchiveIdea = (id: string) => {
    setIdeas(prev => prev.map(i => (i.id === id ? { ...i, archived: false } : i)))
  }

  const removeIdea = (id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id))
  }

  const startEdit = (i: Idea) => {
    setEditingId(i.id)
    setEditText(i.text)
  }

  const saveEdit = () => {
    if (!editingId) return
    const t = editText.trim()
    if (!t) return
    setIdeas(prev => prev.map(i => (i.id === editingId ? { ...i, text: t } : i)))
    setEditingId(null)
    setEditText('')
  }

  const activeIdeas = ideas.filter(i => !i.archived)
  const archivedIdeas = ideas.filter(i => i.archived)

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading…</span>
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold"
          aria-hidden="true"
        />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">Marketing</p>
          <h1 className="text-2xl font-bold mt-1">Content &amp; distribution</h1>
          <p className="text-text-muted text-sm mt-1 max-w-xl">
            Submission log, channel snapshot, and scratchpad ideas for the team.
            {profile?.display_name && (
              <span className="text-text-light"> Signed in as {profile.display_name}.</span>
            )}
          </p>
        </div>
      </div>

      {/* Platform snapshot */}
      <section>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Platform snapshot
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLATFORMS.map(({ key, label, icon: Icon }) => {
            const m = metrics[key]
            return (
              <div
                key={key}
                className="bg-surface rounded-2xl border border-border p-4 flex flex-col gap-2 hover:border-gold/20 transition-colors"
                aria-label={`${label}: ${m ? m.follower_count.toLocaleString() : 'no data'} followers`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">{label}</span>
                  <Icon size={18} className="text-gold" aria-hidden="true" />
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  {m ? m.follower_count.toLocaleString() : '—'}
                </p>
                {m && (
                  <p className="text-[11px] text-text-light">
                    As of {new Date(m.metric_date + 'T12:00:00').toLocaleDateString()}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Content submission log */}
      <section>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Content submission log
        </h2>
        {submissions.length === 0 ? (
          <div className="bg-surface-alt/50 rounded-2xl border border-dashed border-border p-8 text-center text-text-muted text-sm">
            No social or schedule submissions yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {submissions.map(s => (
              <li
                key={s.id}
                className="bg-surface rounded-2xl border border-border p-4 sm:p-5 hover:bg-surface-hover/40 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text">{s.display_name}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {new Date(s.submission_date + 'T12:00:00').toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {s.platform_tag && (
                        <span className="text-gold"> · {s.platform_tag}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.reviewed_at ? (
                      <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-400/90 bg-emerald-500/10 px-2 py-1 rounded-full">
                        Reviewed
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium uppercase tracking-wide text-amber-400/90 bg-amber-500/10 px-2 py-1 rounded-full">
                        Pending review
                      </span>
                    )}
                  </div>
                </div>
                {s.notes && (
                  <p className="text-sm text-text-muted mt-3 leading-relaxed">{s.notes}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  {s.dropbox_url ? (
                    <a
                      href={s.dropbox_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline"
                    >
                      <ExternalLink size={14} aria-hidden="true" />
                      Dropbox
                    </a>
                  ) : (
                    <span className="text-xs text-text-light">No Dropbox link</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ideas */}
      <section className="bg-surface rounded-2xl border border-border p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={18} className="text-gold" aria-hidden="true" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text">Content ideas</h2>
        </div>
        <p className="text-xs text-text-muted mb-4">
          Local scratchpad only — not saved to the database yet.
        </p>
        <div className="flex gap-2 mb-5">
          <input
            type="text"
            value={draftIdea}
            onChange={e => setDraftIdea(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addIdea()}
            placeholder="Drop a hook, format, or campaign idea…"
            aria-label="New content idea"
            className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-bg text-sm placeholder:text-text-light focus:outline-none focus:ring-1 focus:ring-gold/40"
          />
          <button
            type="button"
            onClick={addIdea}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gold text-black text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        </div>
        <ul className="space-y-2">
          {activeIdeas.map(i => (
            <li
              key={i.id}
              className="flex items-start gap-2 p-3 rounded-xl bg-surface-alt border border-border group"
            >
              {editingId === i.id ? (
                <div className="flex-1 flex gap-2">
                  <input
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-bg text-sm"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    aria-label="Edit idea"
                  />
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="text-xs text-gold font-medium px-2"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <p className="flex-1 text-sm text-text leading-relaxed">{i.text}</p>
                  <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEdit(i)}
                      className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text"
                      aria-label="Edit idea"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => archiveIdea(i.id)}
                      className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text text-xs font-medium px-2"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => removeIdea(i.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400"
                      aria-label="Remove idea"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        {archivedIdeas.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-light mb-2">
              Archived
            </p>
            <ul className="space-y-1">
              {archivedIdeas.map(i => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-2 text-sm text-text-muted py-1.5"
                >
                  <span className="line-through opacity-70">{i.text}</span>
                  <button
                    type="button"
                    onClick={() => unarchiveIdea(i.id)}
                    className="text-xs text-gold shrink-0"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
