import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { localDateKey } from '../lib/dates'
import { useToast } from '../components/Toast'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { PerformanceReview, PerformanceScore, TeamMember } from '../types'
import { Star, Plus, X, Loader2, User, Calendar } from 'lucide-react'

const CATEGORIES = [
  'Communication', 'Technical Skills', 'Initiative', 'Teamwork',
  'Time Management', 'Quality of Work', 'Reliability',
]

export default function Reviews() {
  useDocumentTitle('Performance Reviews - Checkmark Workspace')
  const { profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [scores, setScores] = useState<PerformanceScore[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedMember, setSelectedMember] = useState('')
  const [reviewScores, setReviewScores] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')

  const loadData = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    try {
      if (isAdmin) {
        const [usersRes, reviewsRes, scoresRes] = await Promise.all([
          supabase.from('team_members').select('*'),
          supabase.from('team_performance_reviews').select('*').order('created_at', { ascending: false }),
          supabase.from('team_performance_scores').select('*'),
        ])
        if (usersRes.data) setTeamMembers(usersRes.data as TeamMember[])
        if (reviewsRes.data) setReviews(reviewsRes.data as PerformanceReview[])
        if (scoresRes.data) setScores(scoresRes.data as PerformanceScore[])
      } else {
        const [reviewsRes, scoresRes] = await Promise.all([
          supabase.from('team_performance_reviews').select('*').eq('intern_id', profile.id).order('created_at', { ascending: false }),
          supabase.from('team_performance_scores').select('*'),
        ])
        if (reviewsRes.data) setReviews(reviewsRes.data as PerformanceReview[])
        if (scoresRes.data) setScores(scoresRes.data as PerformanceScore[])
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [profile, isAdmin])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !selectedMember) return
    setSubmitting(true)

    const categoryScores = Object.entries(reviewScores)
    const overall = categoryScores.length > 0
      ? Math.round((categoryScores.reduce((sum, [, v]) => sum + v, 0) / categoryScores.length) * 10) / 10
      : 0

    const { data: review, error } = await supabase.from('team_performance_reviews').insert({
      intern_id: selectedMember,
      reviewer_id: profile.id,
      review_period: localDateKey(),
      overall_score: overall,
      notes,
      status: 'published',
    }).select().single()

    if (error || !review) {
      toast('Failed to create review', 'error')
      setSubmitting(false)
      return
    }

    if (categoryScores.length > 0) {
      const scoreInserts = categoryScores.map(([category, score]) => ({
        review_id: review.id,
        category,
        score,
      }))
      const { error: scoresError } = await supabase.from('team_performance_scores').insert(scoreInserts)
      if (scoresError) {
        await supabase.from('team_performance_reviews').delete().eq('id', review.id)
        toast('Failed to save scores. Review was not created.', 'error')
        setSubmitting(false)
        return
      }
    }

    setShowForm(false)
    setSelectedMember('')
    setReviewScores({})
    setNotes('')
    setSubmitting(false)
    loadData()
  }

  const getMemberName = (id: string) => teamMembers.find(m => m.id === id)?.display_name ?? 'Team Member'
  const getReviewerName = (id: string) => teamMembers.find(m => m.id === id)?.display_name ?? 'Reviewer'
  const getReviewScores = (reviewId: string) => scores.filter(s => s.review_id === reviewId)

  const renderStars = (score: number, editable = false, category = '') => {
    if (editable) {
      return (
        <div className="flex items-center gap-0.5" role="radiogroup" aria-label={category}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n <= score}
              aria-label={`${n} of 5 stars`}
              onClick={() => setReviewScores({ ...reviewScores, [category]: n })}
              className="cursor-pointer hover:scale-110 transition-transform"
            >
              <Star
                size={20}
                className={n <= score ? 'text-amber-400 fill-amber-400' : 'text-text-light'}
              />
            </button>
          ))}
        </div>
      )
    }
    return (
      <span role="img" aria-label={`${score} out of 5 stars`} className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} aria-hidden="true" className="inline-flex">
            <Star
              size={16}
              className={n <= score ? 'text-amber-400 fill-amber-400' : 'text-text-light'}
            />
          </span>
        ))}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Reviews</h1>
          <p className="text-text-muted mt-1">{isAdmin ? 'Create and manage performance reviews' : 'View your performance reviews'}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black font-semibold text-sm transition-all">
            {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {showForm ? 'Cancel' : 'New Review'}
          </button>
        )}
      </div>

      {/* New review form (admin only) */}
      {showForm && isAdmin && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-border p-6 space-y-5 shadow-sm">
          <h2 className="font-semibold">Create Performance Review</h2>
          <div>
            <label htmlFor="review-member" className="block text-sm font-medium mb-1.5">Team Member</label>
            <select id="review-member" required value={selectedMember} onChange={e => setSelectedMember(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
              <option value="">Select a team member...</option>
              {teamMembers.filter(m => m.role !== 'admin').map(m => (
                <option key={m.id} value={m.id}>{m.display_name} ({m.position})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-3">Category Scores</label>
            <div className="grid sm:grid-cols-2 gap-3">
              {CATEGORIES.map(cat => (
                <div key={cat} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <span className="text-sm">{cat}</span>
                  {renderStars(reviewScores[cat] ?? 0, true, cat)}
                </div>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="review-notes" className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea id="review-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none"
              placeholder="Overall feedback and areas for growth..." />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black font-semibold text-sm transition-all disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Star size={16} aria-hidden="true" />}
              Submit Review
            </button>
          </div>
        </form>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-8 text-center text-text-muted">
          No reviews yet.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => {
            const rScores = getReviewScores(review.id)
            return (
              <div key={review.id} className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                <div className="px-5 py-3 bg-surface-alt border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold/15 text-gold flex items-center justify-center text-xs font-semibold">
                      <User size={14} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isAdmin ? getMemberName(review.intern_id) : 'Your Review'}
                      </p>
                      <p className="text-xs text-text-muted flex items-center gap-1">
                        <Calendar size={11} aria-hidden="true" /> {review.review_period} · by {getReviewerName(review.reviewer_id)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold">{review.overall_score ?? 0}</span>
                    <span className="text-xs text-text-muted">/5</span>
                    {renderStars(Math.round(review.overall_score ?? 0))}
                  </div>
                </div>
                <div className="p-5">
                  {rScores.length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-2 mb-4">
                      {rScores.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-surface-alt">
                          <span className="text-sm text-text-muted">{s.category}</span>
                          {renderStars(s.score)}
                        </div>
                      ))}
                    </div>
                  )}
                  {review.notes && (
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase mb-1">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{review.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
