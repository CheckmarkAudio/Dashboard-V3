import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getMustDoConfig } from '../lib/mustDoConfig'
import { localDateKey } from '../lib/dates'
import { useToast } from './Toast'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { X, Upload, Loader2 } from 'lucide-react'

const PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const

interface SubmissionModalProps {
  onClose: () => void
  onSubmitted: () => void
}

export default function SubmissionModal({ onClose, onSubmitted }: SubmissionModalProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [dropboxUrl, setDropboxUrl] = useState('')
  const [platform, setPlatform] = useState<string>('instagram')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  const position = profile?.position ?? 'intern'
  const isContentRole = ['intern', 'marketing_admin'].includes(position)
  const isArtistDev = position === 'artist_development'

  const config = getMustDoConfig(position)
  const submissionType = config.submissionType

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSubmitting(true)

    const { error } = await supabase.from('deliverable_submissions').insert({
      intern_id: profile.id,
      submission_date: localDateKey(),
      submission_type: submissionType,
      dropbox_url: dropboxUrl || null,
      platform_tag: isContentRole ? platform : null,
      notes: notes || null,
    })

    setSubmitting(false)
    if (error) {
      toast('Failed to submit. Try again.', 'error')
    } else {
      toast('Deliverable submitted')
      onSubmitted()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="submission-modal-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" role="presentation" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-2xl border border-border p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 id="submission-modal-title" className="font-semibold text-lg">Submit Deliverable</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted" aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isContentRole && (
            <>
              <div>
                <label htmlFor="submission-dropbox" className="block text-sm font-medium mb-1.5 text-text-muted">Dropbox Link</label>
                <input
                  id="submission-dropbox"
                  type="url"
                  value={dropboxUrl}
                  onChange={e => setDropboxUrl(e.target.value)}
                  placeholder="https://dropbox.com/..."
                  className="w-full px-4 py-3 rounded-xl border border-border text-sm"
                />
              </div>
              <div>
                <label id="platform-label" className="block text-sm font-medium mb-1.5 text-text-muted">Platform</label>
                <div className="flex gap-2" role="radiogroup" aria-labelledby="platform-label">
                  {PLATFORMS.map(p => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={platform === p}
                      onClick={() => setPlatform(p)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all border ${
                        platform === p
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-border text-text-muted hover:border-border-light'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {isArtistDev && (
            <div>
              <label htmlFor="submission-contact" className="block text-sm font-medium mb-1.5 text-text-muted">Who was contacted?</label>
              <input
                id="submission-contact"
                value={dropboxUrl}
                onChange={e => setDropboxUrl(e.target.value)}
                placeholder="Client / artist name"
                className="w-full px-4 py-3 rounded-xl border border-border text-sm"
              />
            </div>
          )}

          <div>
            <label htmlFor="submission-notes" className="block text-sm font-medium mb-1.5 text-text-muted">
              {isContentRole ? 'Description' : isArtistDev ? 'Communication summary & next steps' : 'Notes'}
            </label>
            <textarea
              id="submission-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder={isContentRole ? 'What did you create?' : 'Details...'}
              className="w-full px-4 py-3 rounded-xl border border-border text-sm resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="w-full py-3 rounded-xl bg-gold hover:bg-gold-muted text-black font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
            Submit
          </button>
        </form>
      </div>
    </div>
  )
}
