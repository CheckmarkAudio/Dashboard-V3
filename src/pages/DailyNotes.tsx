import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { DailyNote, TeamMember } from '../types'
import {
  Plus, Send, MessageSquare, Calendar, ChevronDown, X, Loader2,
} from 'lucide-react'

const DEFAULT_PROMPTS = [
  { id: 'accomplished', label: 'What did you accomplish today?' },
  { id: 'blockers', label: 'Any blockers or challenges?' },
  { id: 'tomorrow', label: 'What will you work on tomorrow?' },
]

export default function DailyNotes() {
  const { profile, isAdmin } = useAuth()
  const [notes, setNotes] = useState<DailyNote[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [formData, setFormData] = useState<Record<string, string>>({})

  useEffect(() => {
    loadNotes()
    if (isAdmin) loadTeamMembers()
  }, [profile, isAdmin])

  const loadTeamMembers = async () => {
    const { data } = await supabase.from('intern_users').select('*')
    if (data) setTeamMembers(data as TeamMember[])
  }

  const loadNotes = async () => {
    if (!profile) { setLoading(false); return }
    try {
      let query = supabase.from('intern_daily_notes').select('*').order('note_date', { ascending: false })
      if (!isAdmin) query = query.eq('intern_id', profile.id)
      const { data } = await query
      if (data) setNotes(data as DailyNote[])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSubmitting(true)

    const content = JSON.stringify(
      DEFAULT_PROMPTS.map(p => ({ question: p.label, answer: formData[p.id] || '' }))
    )

    const { error } = await supabase.from('intern_daily_notes').insert({
      intern_id: profile.id,
      note_date: new Date().toISOString().split('T')[0],
      content,
      focus_areas: [],
      submitted_at: new Date().toISOString(),
    })

    if (!error) {
      setShowForm(false)
      setFormData({})
      loadNotes()
    }
    setSubmitting(false)
  }

  const handleReply = async (noteId: string) => {
    if (!replyText.trim()) return
    await supabase.from('intern_daily_notes').update({ manager_reply: replyText }).eq('id', noteId)
    setReplyingTo(null)
    setReplyText('')
    loadNotes()
  }

  const getDisplayName = (internId: string) => {
    return teamMembers.find(m => m.id === internId)?.display_name ?? 'Unknown'
  }

  const filteredNotes = selectedMember === 'all'
    ? notes
    : notes.filter(n => n.intern_id === selectedMember)

  const parseContent = (content: string) => {
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // plain text
    }
    return [{ question: 'Notes', answer: content }]
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Notes</h1>
          <p className="text-text-muted mt-1">Track your daily progress and accomplishments</p>
        </div>
        {!isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-medium hover:from-brand-600 hover:to-brand-700 shadow-sm shadow-brand-200 transition-all"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'New Note'}
          </button>
        )}
      </div>

      {/* Admin filter */}
      {isAdmin && teamMembers.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-text-muted">Filter by member:</label>
          <div className="relative">
            <select
              value={selectedMember}
              onChange={e => setSelectedMember(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-border bg-surface text-sm focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Members</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>
        </div>
      )}

      {/* New Note Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-border p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar size={16} />
            Daily Note — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          {DEFAULT_PROMPTS.map(prompt => (
            <div key={prompt.id}>
              <label className="block text-sm font-medium mb-1.5">{prompt.label}</label>
              <textarea
                value={formData[prompt.id] || ''}
                onChange={e => setFormData({ ...formData, [prompt.id]: e.target.value })}
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm focus:ring-2 focus:ring-brand-500 resize-none"
                placeholder="Type your answer..."
              />
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-medium hover:from-brand-600 hover:to-brand-700 shadow-sm shadow-brand-200 transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Submit Note
            </button>
          </div>
        </form>
      )}

      {/* Notes List */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-8 text-center text-text-muted">
            No notes yet. {!isAdmin && 'Click "New Note" to submit your first daily note.'}
          </div>
        ) : (
          filteredNotes.map(note => {
            const entries = parseContent(note.content)
            return (
              <div key={note.id} className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                <div className="px-5 py-3 border-b border-border border-l-4 border-l-brand-500/35 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-text-muted" />
                    <span className="text-sm font-medium">{note.note_date}</span>
                    {isAdmin && (
                      <span className="text-sm text-text-muted">— {getDisplayName(note.intern_id)}</span>
                    )}
                  </div>
                  <span className="text-xs text-text-light">
                    {new Date(note.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="p-5 space-y-3">
                  {entries.map((entry: { question: string; answer: string }, i: number) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                        {entry.question}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{entry.answer || '—'}</p>
                    </div>
                  ))}
                </div>

                {/* Manager Reply */}
                {note.manager_reply && (
                  <div className="px-5 py-3 bg-brand-50 border-t border-brand-100">
                    <p className="text-xs font-semibold text-brand-700 mb-1">Manager Reply</p>
                    <p className="text-sm text-brand-800">{note.manager_reply}</p>
                  </div>
                )}

                {/* Reply action (admin only) */}
                {isAdmin && !note.manager_reply && (
                  <div className="px-5 py-3 border-t border-border">
                    {replyingTo === note.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Write a reply..."
                          className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:ring-2 focus:ring-brand-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleReply(note.id)}
                          className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700"
                        >
                          Send
                        </button>
                        <button
                          onClick={() => { setReplyingTo(null); setReplyText('') }}
                          className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReplyingTo(note.id)}
                        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-brand-600"
                      >
                        <MessageSquare size={14} /> Reply
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
