import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  CheckSquare, Square, Plus, X, Loader2, Trash2, RotateCcw, Sparkles,
  ListChecks, ChevronDown,
} from 'lucide-react'

interface ChecklistItem {
  id: string
  intern_id: string
  item_text: string
  is_completed: boolean
  category?: string
  created_at?: string
}

const PRESET_CHECKLISTS: Record<string, string[]> = {
  'Daily Standup': [
    'Review yesterday\'s progress',
    'Check and respond to messages',
    'Update task status in project board',
    'Submit daily standup note',
    'Review upcoming deadlines',
  ],
  'Marketing Daily': [
    'Check social media analytics',
    'Review and respond to comments/DMs',
    'Review content calendar',
    'Monitor active campaigns',
    'Follow up on leads',
    'Update marketing dashboard',
    'Schedule tomorrow\'s content',
  ],
  'Intern Daily': [
    'Attend/review team standup',
    '30 min learning or training',
    'Complete assigned tasks',
    'Update project notes',
    'Ask at least one question',
    'Submit daily report',
  ],
  'Sales Daily': [
    'Review pipeline and priorities',
    'Follow up on pending proposals',
    'Make outreach calls/emails',
    'Update CRM records',
    'Prep for tomorrow\'s meetings',
  ],
  'Content Creator': [
    'Research trending topics',
    'Draft or edit content piece',
    'Review analytics on recent posts',
    'Engage with audience comments',
    'Plan next content batch',
  ],
  'End of Week': [
    'Submit weekly summary report',
    'Update project milestones',
    'Clean up inbox and tasks',
    'Plan next week\'s priorities',
    'Back up important files',
  ],
}

export default function Tasks() {
  const { profile } = useAuth()
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState('')
  const [showPresets, setShowPresets] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => { loadItems() }, [profile])

  const loadItems = async () => {
    if (!profile) { setLoading(false); return }
    try {
      const { data } = await supabase
        .from('intern_checklist_items')
        .select('*')
        .eq('intern_id', profile.id)
        .order('created_at', { ascending: true })
      if (data) setItems(data as ChecklistItem[])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const addItem = async (text: string) => {
    if (!profile || !text.trim()) return
    setAdding(true)
    await supabase.from('intern_checklist_items').insert({
      intern_id: profile.id,
      item_text: text.trim(),
      is_completed: false,
    })
    setNewItem('')
    setAdding(false)
    loadItems()
  }

  const toggleItem = async (item: ChecklistItem) => {
    await supabase.from('intern_checklist_items')
      .update({ is_completed: !item.is_completed })
      .eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: !i.is_completed } : i))
  }

  const deleteItem = async (id: string) => {
    await supabase.from('intern_checklist_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const clearCompleted = async () => {
    if (!profile) return
    const completedIds = items.filter(i => i.is_completed).map(i => i.id)
    if (completedIds.length === 0) return
    for (const id of completedIds) {
      await supabase.from('intern_checklist_items').delete().eq('id', id)
    }
    loadItems()
  }

  const resetAll = async () => {
    if (!profile) return
    for (const item of items) {
      if (item.is_completed) {
        await supabase.from('intern_checklist_items').update({ is_completed: false }).eq('id', item.id)
      }
    }
    loadItems()
  }

  const loadPreset = async (name: string) => {
    if (!profile) return
    const presetItems = PRESET_CHECKLISTS[name]
    if (!presetItems) return
    setAdding(true)
    for (const text of presetItems) {
      await supabase.from('intern_checklist_items').insert({
        intern_id: profile.id,
        item_text: text,
        is_completed: false,
      })
    }
    setShowPresets(false)
    setAdding(false)
    loadItems()
  }

  const completed = items.filter(i => i.is_completed).length
  const total = items.length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-text-muted mt-1">Your daily checklist and to-dos</p>
        </div>
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-medium hover:from-brand-600 hover:to-brand-700 shadow-sm shadow-brand-200 transition-all"
        >
          <Sparkles size={16} /> Load Template
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListChecks size={18} className="text-brand-500" />
              <span className="text-sm font-semibold">{completed} of {total} completed</span>
            </div>
            <span className={`text-2xl font-bold ${progress === 100 ? 'text-green-500' : 'text-brand-600'}`}>
              {progress}%
            </span>
          </div>
          <div className="h-3 bg-surface-alt rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                progress === 100
                  ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                  : 'bg-gradient-to-r from-brand-400 to-brand-600'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Preset templates */}
      {showPresets && (
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" /> Checklist Templates
            </h2>
            <button onClick={() => setShowPresets(false)} className="p-1 rounded-lg hover:bg-surface-hover">
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-text-muted mb-4">Pick a template to add pre-built checklist items.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(PRESET_CHECKLISTS).map(([name, items]) => (
              <button
                key={name}
                onClick={() => loadPreset(name)}
                disabled={adding}
                className="text-left p-4 rounded-xl border border-border hover:border-brand-300 hover:shadow-md transition-all group"
              >
                <h3 className="font-medium text-sm group-hover:text-brand-600 transition-colors">{name}</h3>
                <p className="text-xs text-text-muted mt-1">{items.length} items</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {items.slice(0, 3).map((item, i) => (
                    <span key={i} className="text-[10px] bg-surface-alt px-1.5 py-0.5 rounded text-text-muted truncate max-w-[140px]">
                      {item}
                    </span>
                  ))}
                  {items.length > 3 && (
                    <span className="text-[10px] text-text-light">+{items.length - 3} more</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add new item */}
      <div className="flex gap-2">
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem(newItem)}
          placeholder="Add a new task..."
          className="flex-1 px-4 py-3 rounded-xl border border-border bg-surface text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-400 shadow-sm"
        />
        <button
          onClick={() => addItem(newItem)}
          disabled={!newItem.trim() || adding}
          className="px-4 py-3 rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 transition-colors shadow-sm"
        >
          {adding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
        </button>
      </div>

      {/* Checklist items */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <CheckSquare size={40} className="mx-auto mb-3 text-text-light opacity-40" />
            <p className="text-text-muted font-medium">No tasks yet</p>
            <p className="text-sm text-text-light mt-1">Add items above or load a template to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-5 py-3.5 group hover:bg-surface-alt/50 transition-colors animate-slide-in`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <button
                  onClick={() => toggleItem(item)}
                  className="shrink-0 transition-transform hover:scale-110"
                >
                  {item.is_completed ? (
                    <CheckSquare size={20} className="text-brand-500" />
                  ) : (
                    <Square size={20} className="text-text-light group-hover:text-text-muted transition-colors" />
                  )}
                </button>
                <span className={`flex-1 text-sm transition-all ${
                  item.is_completed ? 'line-through text-text-light' : ''
                }`}>
                  {item.item_text}
                </span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-text-light hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-light">
            {items.filter(i => !i.is_completed).length} remaining
          </span>
          <div className="flex gap-2">
            <button onClick={resetAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:bg-surface-hover transition-colors">
              <RotateCcw size={12} /> Reset All
            </button>
            <button onClick={clearCompleted}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={12} /> Clear Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
