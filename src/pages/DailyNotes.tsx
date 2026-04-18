import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { localDateKey } from '../lib/dates'
import { useToast } from '../components/Toast'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  Button, Textarea, Select, Input, EmptyState, PageHeader,
} from '../components/ui'
import type { DailyNote, TeamMember } from '../types'
import {
  Plus, Send, MessageSquare, Calendar, X, FileText,
} from 'lucide-react'

const DEFAULT_PROMPTS = [
  { id: 'accomplished', label: 'What did you accomplish today?' },
  { id: 'blockers', label: 'Any blockers or challenges?' },
  { id: 'tomorrow', label: 'What will you work on tomorrow?' },
]

export default function DailyNotes() {
  useDocumentTitle('Daily Notes - Checkmark Audio')
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
  const { toast } = useToast()

  useEffect(() => {
    loadNotes()
    if (isAdmin) loadTeamMembers()
  }, [profile, isAdmin])

  const loadTeamMembers = async () => {
    const { data } = await supabase.from('team_members').select('*')
    if (data) setTeamMembers(data as TeamMember[])
  }

  const loadNotes = async () => {
    if (!profile) { setLoading(false); return }
    try {
      let query = supabase.from('team_daily_notes').select('*').order('note_date', { ascending: false })
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

    const { error } = await supabase.from('team_daily_notes').insert({
      intern_id: profile.id,
      note_date: localDateKey(),
      content,
      submitted_at: new Date().toISOString(),
    })

    if (error) {
      toast('Failed to submit note', 'error')
    } else {
      setShowForm(false)
      setFormData({})
      loadNotes()
    }
    setSubmitting(false)
  }

  const handleReply = async (noteId: string) => {
    if (!replyText.trim()) return
    const { error } = await supabase.from('team_daily_notes').update({ manager_reply: replyText }).eq('id', noteId)
    if (error) { toast('Failed to send reply', 'error'); return }
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
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-live="polite"
      >
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold"
          aria-hidden="true"
        />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        icon={FileText}
        title="Daily Notes"
        subtitle="Track your daily progress and accomplishments."
        actions={
          !isAdmin ? (
            <Button
              variant="primary"
              onClick={() => setShowForm(!showForm)}
              iconLeft={showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            >
              {showForm ? 'Cancel' : 'New Note'}
            </Button>
          ) : undefined
        }
      />

      {/* Admin filter */}
      {isAdmin && teamMembers.length > 0 && (
        <Select
          id="notes-member-filter"
          label="Filter by member"
          value={selectedMember}
          onChange={e => setSelectedMember(e.target.value)}
          wrapperClassName="max-w-xs"
        >
          <option value="all">All Members</option>
          {teamMembers.map(m => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </Select>
      )}

      {/* New Note Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-border p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar size={16} aria-hidden="true" />
            Daily Note — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          {DEFAULT_PROMPTS.map(prompt => (
            <Textarea
              key={prompt.id}
              id={`note-${prompt.id}`}
              label={prompt.label}
              rows={3}
              placeholder="Type your answer..."
              value={formData[prompt.id] || ''}
              onChange={e => setFormData({ ...formData, [prompt.id]: e.target.value })}
            />
          ))}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              iconLeft={!submitting ? <Send size={16} aria-hidden="true" /> : undefined}
            >
              Submit Note
            </Button>
          </div>
        </form>
      )}

      {/* Notes List */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No notes yet"
            description={
              isAdmin
                ? 'Team members haven\u2019t submitted any notes yet.'
                : 'Click \u201cNew Note\u201d to submit your first daily note.'
            }
            action={
              !isAdmin ? (
                <Button
                  variant="primary"
                  onClick={() => setShowForm(true)}
                  iconLeft={<Plus size={16} aria-hidden="true" />}
                >
                  New Note
                </Button>
              ) : undefined
            }
          />
        ) : (
          filteredNotes.map(note => {
            const entries = parseContent(note.content)
            return (
              <div key={note.id} className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                <div className="px-5 py-3 border-b border-border border-l-4 border-l-gold/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-text-muted" aria-hidden="true" />
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
                  <div className="px-5 py-3 bg-gold/5 border-t border-gold/10">
                    <p className="text-xs font-semibold text-gold mb-1">Manager Reply</p>
                    <p className="text-sm text-text">{note.manager_reply}</p>
                  </div>
                )}

                {/* Reply action (admin only) */}
                {isAdmin && !note.manager_reply && (
                  <div className="px-5 py-3 border-t border-border">
                    {replyingTo === note.id ? (
                      <div className="flex gap-2 items-start">
                        <Input
                          type="text"
                          autoFocus
                          placeholder="Write a reply..."
                          aria-label="Reply to note"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          wrapperClassName="flex-1"
                        />
                        <Button variant="primary" size="sm" onClick={() => handleReply(note.id)}>
                          Send
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => { setReplyingTo(null); setReplyText('') }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplyingTo(note.id)}
                        iconLeft={<MessageSquare size={14} aria-hidden="true" />}
                      >
                        Reply
                      </Button>
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
