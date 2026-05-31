import { useState } from 'react'
import { Calendar, Save, Loader2 } from 'lucide-react'
import type { TeamMember, WeeklyAdminReview, FlywheelStage } from '../../types'
import { FLYWHEEL_STAGES as FLYWHEEL_STAGES_CANON, FLYWHEEL_STAGE_KEYS } from '../../lib/flywheel/stages'

const FLYWHEEL_STAGES: { key: FlywheelStage; label: string; color: string }[] =
  FLYWHEEL_STAGES_CANON.map((s) => ({ key: s.key, label: s.label, color: s.text }))

const DEFAULT_REVIEW_SCORES = (): Record<FlywheelStage, number> =>
  FLYWHEEL_STAGE_KEYS.reduce(
    (acc, k) => { acc[k] = 3; return acc },
    {} as Record<FlywheelStage, number>,
  )

export interface WeeklyReviewFormProps {
  reports: TeamMember[]
  selectedMember: TeamMember | null
  reviews: WeeklyAdminReview[]
  weekStart: string
  onSelectMember: (member: TeamMember) => void
  onSubmitReview: (data: {
    scores: Record<FlywheelStage, number>
    kpiOnTrack: boolean
    strengths: string
    improvements: string
    actions: string
  }) => Promise<void>
  /** Initial form values, pre-filled from an existing review when available. */
  initialValues?: {
    scores: Record<FlywheelStage, number>
    kpiOnTrack: boolean
    strengths: string
    improvements: string
    actions: string
  }
}

export default function WeeklyReviewForm({
  reports, selectedMember, reviews, weekStart, onSelectMember, onSubmitReview, initialValues,
}: WeeklyReviewFormProps) {
  const [reviewScores, setReviewScores] = useState<Record<FlywheelStage, number>>(
    initialValues?.scores ?? DEFAULT_REVIEW_SCORES(),
  )
  const [reviewStrengths, setReviewStrengths] = useState(initialValues?.strengths ?? '')
  const [reviewImprovements, setReviewImprovements] = useState(initialValues?.improvements ?? '')
  const [reviewActions, setReviewActions] = useState(initialValues?.actions ?? '')
  const [reviewKpiOnTrack, setReviewKpiOnTrack] = useState(initialValues?.kpiOnTrack ?? true)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  // Sync form values when initialValues changes (member selection)
  const [lastMemberId, setLastMemberId] = useState(selectedMember?.id ?? '')
  if (selectedMember && selectedMember.id !== lastMemberId) {
    setLastMemberId(selectedMember.id)
    if (initialValues) {
      setReviewScores(initialValues.scores)
      setReviewStrengths(initialValues.strengths)
      setReviewImprovements(initialValues.improvements)
      setReviewActions(initialValues.actions)
      setReviewKpiOnTrack(initialValues.kpiOnTrack)
    }
  }

  const handleSubmit = async () => {
    setReviewSubmitting(true)
    await onSubmitReview({
      scores: reviewScores,
      kpiOnTrack: reviewKpiOnTrack,
      strengths: reviewStrengths,
      improvements: reviewImprovements,
      actions: reviewActions,
    })
    setReviewSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {reports.map(m => (
          <button key={m.id} onClick={() => onSelectMember(m)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedMember?.id === m.id ? 'bg-gold/10 text-gold ring-1 ring-gold/30' : 'bg-surface border border-border text-text-muted hover:text-text'
            }`}>
            <div className="w-6 h-6 rounded-full bg-gold/15 text-gold flex items-center justify-center text-[10px] font-bold">
              {m.display_name?.charAt(0)?.toUpperCase()}
            </div>
            {m.display_name}
          </button>
        ))}
      </div>

      {selectedMember && (
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Manager Review: {selectedMember.display_name}</h2>
              <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                <Calendar size={12} aria-hidden="true" /> Week of {weekStart}
              </p>
            </div>
          </div>

          {/* Flywheel scores */}
          <div>
            <p id="myteam-flywheel-scores-heading" className="block text-sm font-medium mb-3">Flywheel Stage Scores</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" aria-labelledby="myteam-flywheel-scores-heading">
              {FLYWHEEL_STAGES.map(stage => (
                <div key={stage.key} className="text-center">
                  <p className={`text-xs font-semibold mb-2 ${stage.color}`}>{stage.label}</p>
                  <div className="flex flex-col items-center gap-1" role="radiogroup" aria-label={stage.label}>
                    {[5, 4, 3, 2, 1].map(n => (
                      <button key={n} type="button" role="radio" aria-checked={reviewScores[stage.key] === n}
                        onClick={() => setReviewScores({ ...reviewScores, [stage.key]: n })}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          reviewScores[stage.key] >= n
                            ? 'bg-gold/20 text-gold border border-gold/40'
                            : 'bg-surface-alt text-text-light border border-border hover:border-gold/20'
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="myteam-review-kpi-on-track" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input id="myteam-review-kpi-on-track" type="checkbox" checked={reviewKpiOnTrack}
                onChange={e => setReviewKpiOnTrack(e.target.checked)} className="rounded border-border" />
              KPI on track this week
            </label>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${reviewKpiOnTrack ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {reviewKpiOnTrack ? 'On Track' : 'Needs Attention'}
            </span>
          </div>

          <div>
            <label htmlFor="myteam-review-strengths" className="block text-sm font-medium mb-1.5">Strengths</label>
            <textarea id="myteam-review-strengths" value={reviewStrengths} onChange={e => setReviewStrengths(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none"
              placeholder="What did they do well this week?" />
          </div>

          <div>
            <label htmlFor="myteam-review-improvements" className="block text-sm font-medium mb-1.5">Areas for Improvement</label>
            <textarea id="myteam-review-improvements" value={reviewImprovements} onChange={e => setReviewImprovements(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none"
              placeholder="Where can they improve?" />
          </div>

          <div>
            <label htmlFor="myteam-review-actions" className="block text-sm font-medium mb-1.5">Action Items (one per line)</label>
            <textarea id="myteam-review-actions" value={reviewActions} onChange={e => setReviewActions(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none"
              placeholder={"Submit content by 3pm daily\nUpdate pipeline before EOD"} />
          </div>

          <div className="flex justify-end">
            <button onClick={handleSubmit} disabled={reviewSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold disabled:opacity-50">
              {reviewSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              Submit Review
            </button>
          </div>
        </div>
      )}

      {/* Past manager reviews */}
      {selectedMember && (() => {
        const memberReviews = reviews.filter(r => r.intern_id === selectedMember.id)
        if (memberReviews.length === 0) return null
        return (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-sm">Past Manager Reviews</h2>
            </div>
            <div className="divide-y divide-border/50">
              {memberReviews.map(r => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Week of {r.week_start}</span>
                    <span className="text-sm font-bold">{r.overall_score}/5</span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    {FLYWHEEL_STAGES.map(s => (
                      <span key={s.key} className={`text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-alt ${s.color}`}>
                        {s.label}: {(r.flywheel_scores as Record<string, number>)?.[s.key] ?? '—'}
                      </span>
                    ))}
                  </div>
                  {r.strengths && <p className="text-xs text-text-muted mt-1"><span className="font-medium text-emerald-400">Strengths:</span> {r.strengths}</p>}
                  {r.improvements && <p className="text-xs text-text-muted mt-1"><span className="font-medium text-amber-400">Improve:</span> {r.improvements}</p>}
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
