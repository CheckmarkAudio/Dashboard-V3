import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { ScheduleTemplate } from '../types'
import { Calendar, Plus, X, Save, Loader2, Edit2, Trash2, CheckSquare, Square } from 'lucide-react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const DAY_COLORS = [
  'bg-blue-50 border-blue-200',
  'bg-purple-50 border-purple-200',
  'bg-green-50 border-green-200',
  'bg-amber-50 border-amber-200',
  'bg-pink-50 border-pink-200',
  'bg-cyan-50 border-cyan-200',
  'bg-gray-50 border-gray-200',
]

interface FocusTask {
  text: string
  done: boolean
}

function TodayFocus({ profileId }: { profileId?: string }) {
  const [tasks, setTasks] = useState<FocusTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const jsDay = new Date().getDay() // 0=Sun, 1=Mon...6=Sat
    // DAYS array: 0=Monday...4=Friday, 5=Saturday, 6=Sunday
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
    if (profileId) query = query.eq('intern_id', profileId)
    query
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const areas: string[] = data?.focus_areas ?? []
        setTasks(areas.map(a => ({ text: a, done: false })))
        setLoading(false)
      })
  }, [profileId])

  const toggle = (idx: number) => {
    setTasks(prev => prev.map((t, i) => i === idx ? { ...t, done: !t.done } : t))
  }

  if (loading) return <div className="h-20 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-text-muted" /></div>

  const done = tasks.filter(t => t.done).length

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm animate-slide-up mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Calendar size={16} className="text-brand-500" />
          Today's Focus
        </h2>
        {tasks.length > 0 && (
          <span className="text-xs text-text-muted">{done}/{tasks.length} done</span>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-text-muted italic">No focus areas for today</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((task, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-alt/50 transition-colors text-left group"
            >
              {task.done ? (
                <CheckSquare size={18} className="text-brand-500 shrink-0" />
              ) : (
                <Square size={18} className="text-text-light group-hover:text-text-muted shrink-0 transition-colors" />
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
  const { profile, isAdmin } = useAuth()
  const [schedules, setSchedules] = useState<ScheduleTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)
  const [editAreas, setEditAreas] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newDay, setNewDay] = useState(0)
  const [newAreas, setNewAreas] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadSchedule() }, [profile])

  const loadSchedule = async () => {
    if (!profile) { setLoading(false); return }
    try {
      let query = supabase.from('intern_schedule_templates').select('*').order('day_of_week', { ascending: true })
      if (!isAdmin) query = query.eq('intern_id', profile.id)
      const { data } = await query
      if (data) setSchedules(data as ScheduleTemplate[])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!profile || !newAreas.trim()) return
    setSaving(true)
    await supabase.from('intern_schedule_templates').insert({
      intern_id: profile.id,
      day_of_week: newDay,
      focus_areas: newAreas.split(',').map(s => s.trim()).filter(Boolean),
      frequency: 'weekly',
    })
    setShowAdd(false)
    setNewAreas('')
    setSaving(false)
    loadSchedule()
  }

  const handleUpdate = async (id: string) => {
    setSaving(true)
    await supabase.from('intern_schedule_templates').update({
      focus_areas: editAreas.split(',').map(s => s.trim()).filter(Boolean),
    }).eq('id', id)
    setEditing(null)
    setSaving(false)
    loadSchedule()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule entry?')) return
    await supabase.from('intern_schedule_templates').delete().eq('id', id)
    loadSchedule()
  }

  const groupedByDay = DAYS.map((day, i) => ({
    day,
    index: i,
    entries: schedules.filter(s => s.day_of_week === i),
  }))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Weekly Schedule</h1>
          <p className="text-text-muted mt-1">Focus areas for each day</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-medium hover:from-brand-600 hover:to-brand-700 shadow-sm shadow-brand-200 transition-all">
          {showAdd ? <X size={16} /> : <Plus size={16} />}
          {showAdd ? 'Cancel' : 'Add Entry'}
        </button>
      </div>

      <TodayFocus profileId={isAdmin ? undefined : profile?.id} />

      {showAdd && (
        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-semibold">New Schedule Entry</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Day of Week</label>
              <select value={newDay} onChange={e => setNewDay(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:ring-2 focus:ring-brand-500">
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Focus Areas (comma-separated)</label>
              <input value={newAreas} onChange={e => setNewAreas(e.target.value)} placeholder="e.g. Content creation, SEO, Outreach"
                className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleAdd} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {groupedByDay.map(({ day, index, entries }) => (
          <div
            key={day}
            className={`rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all duration-200 animate-slide-up ${DAY_COLORS[index]}`}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-text-muted" />
              <h3 className="font-semibold">{day}</h3>
              <span className="text-xs text-text-muted">({entries.length} {entries.length === 1 ? 'entry' : 'entries'})</span>
            </div>
            {entries.length === 0 ? (
              <p className="text-sm text-text-muted italic">No focus areas set</p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry, i) => (
                  <div key={entry.id} className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                    {editing === i && entry.day_of_week === index ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input value={editAreas} onChange={e => setEditAreas(e.target.value)}
                          className="flex-1 px-2 py-1 rounded border border-border text-sm focus:ring-2 focus:ring-brand-500" />
                        <button onClick={() => handleUpdate(entry.id)} disabled={saving}
                          className="p-1 rounded text-brand-600 hover:bg-brand-50">
                          <Save size={14} />
                        </button>
                        <button onClick={() => setEditing(null)} className="p-1 rounded text-text-muted hover:bg-surface-hover">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 flex flex-wrap gap-1.5">
                          {(entry.focus_areas || []).map((area, ai) => (
                            <span key={ai} className="px-2 py-0.5 rounded-full bg-white text-xs font-medium border border-border">
                              {area}
                            </span>
                          ))}
                        </div>
                        <button onClick={() => { setEditing(i); setEditAreas((entry.focus_areas || []).join(', ')) }}
                          className="p-1 rounded text-text-muted hover:text-brand-600 hover:bg-brand-50">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(entry.id)}
                          className="p-1 rounded text-text-muted hover:text-red-600 hover:bg-red-50">
                          <Trash2 size={14} />
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
