import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { localDateKey } from '../../lib/dates'
import { useToast } from '../Toast'
import type { TeamMember } from '../../types'
import type { ChecklistItemRow } from '../../hooks/useChecklist'
import {
  Check, Edit2, Loader2, Plus, Save, Trash2, X,
} from 'lucide-react'

interface Props {
  member: TeamMember
  onClose: () => void
}

export default function AdminChecklistEditor({ member, onClose }: Props) {
  const { toast } = useToast()
  const [items, setItems] = useState<ChecklistItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [newItemText, setNewItemText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  const dateKey = localDateKey()

  const loadItems = useCallback(async () => {
    setLoading(true)
    const { data: inst } = await supabase
      .from('team_checklist_instances')
      .select('id')
      .eq('intern_id', member.id)
      .eq('frequency', 'daily')
      .eq('period_date', dateKey)
      .maybeSingle()

    if (inst) {
      setInstanceId(inst.id)
      const { data } = await supabase
        .from('team_checklist_items')
        .select('*')
        .eq('instance_id', inst.id)
        .order('sort_order')
      setItems((data as ChecklistItemRow[]) ?? [])
    } else {
      setInstanceId(null)
      setItems([])
    }
    setLoading(false)
  }, [member.id, dateKey])

  useEffect(() => { loadItems() }, [loadItems])

  const toggleItem = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const next = !item.is_completed
    const nextCompletedAt = next ? new Date().toISOString() : null
    const previous = item
    // Optimistic update
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_completed: next, completed_at: nextCompletedAt } : i))
    const { error } = await supabase
      .from('team_checklist_items')
      .update({ is_completed: next, completed_at: nextCompletedAt })
      .eq('id', id)
    if (error) {
      // Roll back on failure so UI matches server
      setItems(prev => prev.map(i => i.id === id ? previous : i))
      toast('Failed to update task', 'error')
    }
  }

  const addItem = async () => {
    if (!newItemText.trim() || !instanceId) return
    setSaving(true)
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0
    const { data, error } = await supabase.from('team_checklist_items').insert({
      instance_id: instanceId,
      category: 'Manager added',
      item_text: newItemText.trim(),
      is_completed: false,
      sort_order: maxOrder,
    }).select('*').single()
    if (error) toast('Failed to add item', 'error')
    else if (data) {
      setItems(prev => [...prev, data as ChecklistItemRow])
      setNewItemText('')
      toast('Item added')
    }
    setSaving(false)
  }

  const updateItemText = async (id: string) => {
    if (!editText.trim()) return
    setSaving(true)
    const { error } = await supabase.from('team_checklist_items').update({ item_text: editText.trim() }).eq('id', id)
    if (error) toast('Failed to update', 'error')
    else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, item_text: editText.trim() } : i))
      setEditingId(null)
      toast('Item updated')
    }
    setSaving(false)
  }

  const removeItem = async (id: string) => {
    const { error } = await supabase.from('team_checklist_items').delete().eq('id', id)
    if (error) toast('Failed to remove', 'error')
    else {
      setItems(prev => prev.filter(i => i.id !== id))
      toast('Item removed')
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-text-muted" />
      </div>
    )
  }

  const done = items.filter(i => i.is_completed).length

  return (
    <div className="border-t border-border bg-surface-alt/30">
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2">
          <Edit2 size={13} className="text-gold" />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            {member.display_name}'s tasks
          </span>
          {items.length > 0 && (
            <span className="text-xs text-text-light">{done}/{items.length}</span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover text-text-muted" aria-label="Close editor">
          <X size={14} />
        </button>
      </div>

      {items.length === 0 && !instanceId ? (
        <p className="px-5 py-4 text-sm text-text-muted italic">No tasks generated yet for today.</p>
      ) : items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-text-muted italic">Task list is empty. Add items below.</p>
      ) : (
        <div className="divide-y divide-border/30">
          {items.map(item => (
            <div key={item.id} className="px-5 py-2.5 flex items-center gap-3 group">
              <button onClick={() => toggleItem(item.id)} className="shrink-0">
                <div className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all ${
                  item.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-border-light hover:border-gold/50'
                }`}>
                  {item.is_completed && <Check size={11} className="text-white" />}
                </div>
              </button>
              {editingId === item.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && updateItemText(item.id)}
                    className="flex-1 text-sm px-2 py-1 rounded border border-border bg-surface"
                    autoFocus
                  />
                  <button onClick={() => updateItemText(item.id)} disabled={saving} className="text-gold hover:text-gold-muted">
                    <Save size={14} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-text-muted hover:text-text">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${item.is_completed ? 'text-text-light line-through' : 'text-text'}`}>
                    {item.item_text}
                  </span>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={() => { setEditingId(item.id); setEditText(item.item_text) }}
                      className="p-1 rounded hover:bg-surface-hover text-text-muted"
                      aria-label="Edit item"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400"
                      aria-label="Remove item"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {instanceId && (
        <div className="px-5 py-3 border-t border-border/50 flex items-center gap-2">
          <input
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Add a task..."
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-surface placeholder:text-text-light"
          />
          <button
            onClick={addItem}
            disabled={saving || !newItemText.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold hover:bg-gold-muted text-black text-sm font-semibold disabled:opacity-50"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      )}
    </div>
  )
}
