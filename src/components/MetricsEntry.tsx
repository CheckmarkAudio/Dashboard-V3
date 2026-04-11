import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { localDateKey } from '../lib/dates'
import { useToast } from './Toast'
import { BarChart3, Loader2, Save } from 'lucide-react'

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', color: 'text-pink-400' },
  { key: 'tiktok', label: 'TikTok', color: 'text-cyan-400' },
  { key: 'youtube', label: 'YouTube', color: 'text-red-400' },
] as const

export default function MetricsEntry({ onSaved }: { onSaved?: () => void }) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [counts, setCounts] = useState<Record<string, string>>({ instagram: '', tiktok: '', youtube: '' })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!profile) return
    const today = localDateKey()
    setSaving(true)

    const entries = PLATFORMS
      .filter(p => counts[p.key] && parseInt(counts[p.key]) > 0)
      .map(p => ({
        platform: p.key,
        metric_date: today,
        follower_count: parseInt(counts[p.key]),
        entered_by: profile.id,
      }))

    if (entries.length === 0) {
      toast('Enter at least one count', 'error')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('platform_metrics').upsert(entries, {
      onConflict: 'platform,metric_date',
    })

    setSaving(false)
    if (error) {
      toast('Failed to save metrics', 'error')
    } else {
      toast('Metrics saved')
      setCounts({ instagram: '', tiktok: '', youtube: '' })
      onSaved?.()
    }
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-gold" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Log Today's Follower Counts</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {PLATFORMS.map(p => (
          <div key={p.key}>
            <label htmlFor={`metrics-${p.key}`} className={`block text-xs font-medium mb-1 ${p.color}`}>{p.label}</label>
            <input
              id={`metrics-${p.key}`}
              type="number"
              value={counts[p.key]}
              onChange={e => setCounts({ ...counts, [p.key]: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        aria-busy={saving}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-alt hover:bg-surface-hover border border-border text-sm font-medium text-text-muted transition-all disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
        Save Metrics
      </button>
    </div>
  )
}
