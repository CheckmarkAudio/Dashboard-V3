import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import type { ScheduleTemplate, TeamMember } from '../types'
import { Calendar, Plus, X, Save, Loader2, Edit2, Trash2, CheckSquare, Square } from 'lucide-react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface FocusTask {
  text: string
  done: boolean
}

function TodayFocus({ profileId, isAdmin }: { profileId?: string; isAdmin?: boolean }) {
  const [tasks, setTasks] = useState<FocusTask[]>([])
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState(profileId ?? '')

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('intern_users').select('id, display_name').order('display_name')
      .then(({ data }) => {
        const list = (data ?? []) as TeamMember[]
        setMembers(list)
        if (!selectedMemberId && list.length > 0) setSelectedMemberId(list[0].id)
      })
  }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const targetId = isAdmin ? selectedMemberId : profileId

  useEffect(() => {
    if (isAdmin && !targetId) { setLoading(false); return }
    setLoading(true)
    const jsDay = new Date().getDay()
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1
    if (dayIndex > 4) {
      setTasks([{ text: 'Weekend - no scheduled tasks', done: false }])
      setLoading(false)
      return
    }
    let query = supabase
      .from('intern_schedule_templates')
      .select('focus_areas')
      .eq('day_of_week', dayIndex)
    if (targetId) query = query.eq('intern_id', targetId)
    query
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const areas: string[] = data?.focus_areas ?? []
        setTasks(areas.map(a => ({ text: a, done: false })))
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [targetId, isAdmin])

  const toggle = (idx: number) => {
    setTasks(prev => prev.map((t, i) => i === idx ? { ...t, done: !t.done } : t))
  }

  if (loading) {
    return (
      <div className="h-20 flex items-center justify-center" role="status" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <Loader2 size={16} className="animate-spin text-text-muted" aria-hidden="true" />
      </div>
    )
  }

  const done = tasks.filter(t => t.done).length

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm animate-slide-up mb-6">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Calendar size={16} className="text-gold" aria-hidden="true" />
          Today's Focus
        </h2>
        <div className="flex items-center gap-3">
          {isAdmin && members.length > 0 && (
            <select
              value={selectedMemberId}
              onChange={e => setSelectedMemberId(e.target.value)}
              className="text-xs px-2 py-1 rounded-lg border border-border bg-surface"
              aria-label="Select team member"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </select>
          )}
          {tasks.length > 0 && (
            <span className="text-xs text-text-muted">{done}/{tasks.length} done</span>
          )}
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-text-muted italic">No focus areas for today</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((task, i) => (
            <button
              key={i}
              aria-pressed={task.done}
              onClick={() => toggle(i)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-alt/50 transition-colors text-left group"
            >
              {task.done ? (
                <CheckSquare size={18} className="text-gold shrink-0" aria-hidden="true" />
              ) : (
                <Square size={18} className="text-text-light group-hover:text-text-muted shrink-0 transition-colors" aria-hidden="true" />
              )}
              <span className={`text-sm ${task.done ? 'line-through text-text-light' : ''}`}>
                {task.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Schedule() {
  useDocumentTitle('Schedule - Checkmark Audio')
  const { profile, isAdmin } = useAuth()
  const [schedules, setSchedules] = useState<ScheduleTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)
  const [editAreas, setEditAreas] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newDay, setNewDay] = useState(0)
  const [newAreas, setNewAreas] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const loadSchedule = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    try {
      let query = supabase.from('intern_schedule_templates').select('*').order('day_of_week', { ascending: true })
      if (!isAdmin) query = query.eq('intern_id', profile.id)
      const { data } = await query
      if (data) setSchedules(data as ScheduleTemplate[])
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [profile, isAdmin])

  useEffect(() => { loadSchedule() }, [loadSchedule])

  const handleAdd = async () => {
    if (!profile || !newAreas.trim()) return
    setSaving(true)
    const { error } = await supabase.from('intern_schedule_templates').insert({
      intern_id: profile.id,
      day_of_week: newDay,
      focus_areas: newAreas.split(',').map(s => s.trim()).filter(Boolean),
      frequency: 'weekly',
    })
    if (error) { toast('Failed to add entry', 'error') }
    setShowAdd(false)
    setNewAreas('')
    setSaving(false)
    loadSchedule()
  }

  const handleUpdate = async (id: string) => {
    setSaving(true)
    const { error } = await supabase.from('intern_schedule_templates').update({
      focus_areas: editAreas.split(',').map(s => s.trim()).filter(Boolean),
    }).eq('id', id)
    if (error) { toast('Failed to update entry', 'error') }
    setEditing(null)
    setSaving(false)
    loadSchedule()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule entry?')) return
    const { error } = await supabase.from('intern_schedule_templates').delete().eq('id', id)
    if (error) toast('Failed to delete entry', 'error')
    loadSchedule()
  }

  const groupedByDay = DAYS.map((day, i) => ({
    day,
    index: i,
    entries: schedules.filter(s => s.day_of_week === i),
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Weekly Schedule</h1>
          <p className="text-text-muted mt-1">Focus areas for each day</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black font-semibold transition-all">
          {showAdd ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          {showAdd ? 'Cancel' : 'Add Entry'}
        </button>
      </div>

      <TodayFocus profileId={profile?.id} isAdmin={isAdmin} />

      {showAdd && (
        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-semibold">New Schedule Entry</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="schedule-new-day" className="block text-sm font-medium mb-1.5">Day of Week</label>
              <select id="schedule-new-day" value={newDay} onChange={e => setNewDay(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="schedule-new-areas" className="block text-sm font-medium mb-1.5">Focus Areas (comma-separated)</label>
              <input id="schedule-new-areas" value={newAreas} onChange={e => setNewAreas(e.target.value)} placeholder="e.g. Content creation, SEO, Outreach"
                className="w-full px-3 py-2.5 rounded-lg border border-border text-sm" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleAdd} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gold hover:bg-gold-muted text-black font-semibold text-sm disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />} Save
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {groupedByDay.map(({ day, index, entries }) => (
          <div
            key={day}
            className="rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all duration-200 animate-slide-up bg-surface border-border"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-text-muted" aria-hidden="true" />
              <h3 className="font-semibold">{day}</h3>
              <span className="text-xs text-text-muted">({entries.length} {entries.length === 1 ? 'entry' : 'entries'})</span>
            </div>
            {entries.length === 0 ? (
              <p className="text-sm text-text-muted italic">No focus areas set</p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry, i) => (
                  <div key={entry.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                    {editing === i && entry.day_of_week === index ? (
                      <div className="flex-1 flex items-center gap-2">
                        <label htmlFor={`schedule-edit-${entry.id}`} className="sr-only">Focus areas (comma-separated)</label>
                        <input id={`schedule-edit-${entry.id}`} value={editAreas} onChange={e => setEditAreas(e.target.value)}
                          className="flex-1 px-2 py-1 rounded border border-border text-sm" />
                        <button aria-label="Save entry" onClick={() => handleUpdate(entry.id)} disabled={saving}
                          className="p-1 rounded text-gold hover:bg-gold/10">
                          <Save size={14} aria-hidden="true" />
                        </button>
                        <button aria-label="Cancel editing" onClick={() => setEditing(null)} className="p-1 rounded text-text-muted hover:bg-surface-hover">
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 flex flex-wrap gap-1.5">
                          {(entry.focus_areas || []).map((area, ai) => (
                            <span key={ai} className="px-2 py-0.5 rounded-full bg-surface-alt text-xs font-medium border border-border">
                              {area}
                            </span>
                          ))}
                        </div>
                        <button aria-label="Edit entry" onClick={() => { setEditing(i); setEditAreas((entry.focus_areas || []).join(', ')) }}
                          className="p-1 rounded text-text-muted hover:text-gold hover:bg-gold/10">
                          <Edit2 size={14} aria-hidden="true" />
                        </button>
                        <button aria-label="Delete entry" onClick={() => handleDelete(entry.id)}
                          className="p-1 rounded text-text-muted hover:text-red-600 hover:bg-red-50">
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
