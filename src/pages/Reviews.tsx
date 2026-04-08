import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { PerformanceReview, PerformanceScore, TeamMember } from '../types'
import { Star, Plus, X, Loader2, User, Calendar } from 'lucide-react'

const CATEGORIES = [
  'Communication', 'Technical Skills', 'Initiative', 'Teamwork',
  'Time Management', 'Quality of Work', 'Reliability',
]

export default function Reviews() {
  const { profile, isAdmin } = useAuth()
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [scores, setScores] = useState<PerformanceScore[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedMember, setSelectedMember] = useState('')
  const [reviewScores, setReviewScores] = useState<Record<string, number>>({})
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    loadData()
  }, [profile])

  const loadData = async () => {
    if (!profile) { setLoading(false); return }
    try {
      if (isAdmin) {
        const [usersRes, reviewsRes, scoresRes] = await Promise.all([
          supabase.from('intern_users').select('*'),
          supabase.from('intern_performance_reviews').select('*').order('review_date', { ascending: false }),
          supabase.from('intern_performance_scores').select('*'),
        ])
        if (usersRes.data) setTeamMembers(usersRes.data as TeamMember[])
        if (reviewsRes.data) setReviews(reviewsRes.data as PerformanceReview[])
        if (scoresRes.data) setScores(scoresRes.data as PerformanceScore[])
      } else {
        const [reviewsRes, scoresRes] = await Promise.all([
          supabase.from('intern_performance_reviews').select('*').eq('intern_id', profile.id).order('review_date', { ascending: false }),
          supabase.from('intern_performance_scores').select('*'),
        ])
        if (reviewsRes.data) setReviews(reviewsRes.data as PerformanceReview[])
        if (scoresRes.data) setScores(scoresRes.data as PerformanceScore[])
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !selectedMember) return
    setSubmitting(true)

    const categoryScores = Object.entries(reviewScores)
    const overall = categoryScores.length > 0
      ? Math.round((categoryScores.reduce((sum, [, v]) => sum + v, 0) / categoryScores.length) * 10) / 10
      : 0

    const { data: review, error } = await supabase.from('intern_performance_reviews').insert({
      intern_id: selectedMember,
      reviewer: profile.display_name,
      review_date: new Date().toISOString().split('T')[0],
      overall_score: overall,
      feedback,
    }).select().single()

    if (!error && review) {
      const scoreInserts = categoryScores.map(([category, score]) => ({
        review_id: review.id,
        category,
        score,
      }))
      if (scoreInserts.length > 0) {
        await supabase.from('intern_performance_scores').insert(scoreInserts)
      }
    }

    setShowForm(false)
    setSelectedMember('')
    setReviewScores({})
    setFeedback('')
    setSubmitting(false)
    loadData()
  }

  const getMemberName = (id: string) => teamMembers.find(m => m.id === id)?.display_name ?? 'Team Member'
  const getReviewScores = (reviewId: string) => scores.filter(s => s.review_id === reviewId)

  const renderStars = (score: number, editable = false, category = '') => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={!editable}
          onClick={() => editable && setReviewScores({ ...reviewScores, [category]: n })}
          className={`${editable ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          <Star
            size={editable ? 20 : 16}
            className={n <= score ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
          />
        </button>
      ))}
    </div>
  )

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Reviews</h1>
          <p className="text-text-muted mt-1">{isAdmin ? 'Create and manage team reviews' : 'View your performance reviews'}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-medium hover:from-brand-600 hover:to-brand-700 shadow-sm shadow-brand-200 transition-all">
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'New Review'}
          </button>
        )}
      </div>

      {/* New review form (admin only) */}
      {showForm && isAdmin && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-border p-6 space-y-5 shadow-sm">
          <h2 className="font-semibold">Create Performance Review</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Team Member</label>
            <select required value={selectedMember} onChange={e => setSelectedMember(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:ring-2 focus:ring-brand-500">
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
            <label className="block text-sm font-medium mb-1.5">Feedback</label>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Overall feedback and areas for growth..." />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-medium hover:from-brand-600 hover:to-brand-700 shadow-sm shadow-brand-200 transition-all disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
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
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
                      <User size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isAdmin ? getMemberName(review.intern_id) : 'Your Review'}
                      </p>
                      <p className="text-xs text-text-muted flex items-center gap-1">
                        <Calendar size={11} /> {review.review_date} · by {review.reviewer}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold">{review.overall_score}</span>
                    <span className="text-xs text-text-muted">/5</span>
                    {renderStars(Math.round(review.overall_score))}
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
                  {review.feedback && (
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase mb-1">Feedback</p>
                      <p className="text-sm whitespace-pre-wrap">{review.feedback}</p>
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
