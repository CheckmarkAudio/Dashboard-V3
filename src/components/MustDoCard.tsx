import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getMustDoConfig } from '../lib/mustDoConfig'
import { localDateKey } from '../lib/dates'
import type { DeliverableSubmission } from '../types'
import { CheckCircle2, AlertCircle, Upload } from 'lucide-react'

interface MustDoCardProps {
  onSubmit: () => void
}

export default function MustDoCard({ onSubmit }: MustDoCardProps) {
  const { profile } = useAuth()
  const [submission, setSubmission] = useState<DeliverableSubmission | null>(null)
  const [loading, setLoading] = useState(true)

  const position = profile?.position ?? 'intern'
  const config = getMustDoConfig(position)

  useEffect(() => {
    if (!profile) { setLoading(false); return }
    const today = localDateKey()
    supabase
      .from('deliverable_submissions')
      .select('*')
      .eq('intern_id', profile.id)
      .eq('submission_date', today)
      .eq('submission_type', config.submissionType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('MustDo fetch error:', error.message)
        setSubmission(data as DeliverableSubmission | null)
        setLoading(false)
      })
  }, [profile, config.submissionType])

  if (loading) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-6 animate-pulse" role="status" aria-live="polite">
        <div className="h-5 bg-surface-alt rounded w-32 mb-3" aria-hidden="true" />
        <div className="h-4 bg-surface-alt rounded w-64" aria-hidden="true" />
        <span className="sr-only">Loading today's must-do…</span>
      </div>
    )
  }

  const isComplete = !!submission
  const isReviewed = !!submission?.reviewed_by

  return (
    <div className={`rounded-2xl border p-6 transition-all ${
      isComplete
        ? 'bg-emerald-500/5 border-emerald-500/20'
        : 'bg-gold/5 border-gold/20 animate-pulse-gold'
    }`}>
      <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {isComplete ? (
              <CheckCircle2 size={18} className="text-emerald-400" aria-hidden="true" />
            ) : (
              <AlertCircle size={18} className="text-gold" aria-hidden="true" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Today's Must-Do
            </span>
            {isReviewed && (
              <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                Reviewed
              </span>
            )}
          </div>
          <p className={`text-sm font-medium ${isComplete ? 'text-text-muted line-through' : 'text-text'}`}>
            {config.label}
          </p>
          {isComplete && submission && (
            <p className="text-xs text-text-light mt-1">
              Submitted at {new Date(submission.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {submission.notes && ` — ${submission.notes}`}
            </p>
          )}
        </div>
        {!isComplete && (
          <button
            onClick={onSubmit}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold transition-all shrink-0"
          >
            <Upload size={14} aria-hidden="true" />
            Submit
          </button>
        )}
      </div>
    </div>
  )
}
