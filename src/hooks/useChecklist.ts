import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export interface ChecklistItemRow {
  id: string
  instance_id: string
  category: string
  item_text: string
  is_completed: boolean
  completed_at: string | null
  sort_order: number
}

export type GroupedItems = Record<string, ChecklistItemRow[]>

export function useChecklist(frequency: 'daily' | 'weekly', date: Date) {
  const { profile } = useAuth()
  const [items, setItems] = useState<ChecklistItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [instanceId, setInstanceId] = useState<string | null>(null)

  const dateKey = date.toISOString().split('T')[0]

  const reload = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    setLoading(true)
    try {
      const { data: instId } = await supabase.rpc('intern_generate_checklist', {
        p_intern_id: profile.id,
        p_frequency: frequency,
        p_date: dateKey,
      })

      if (instId) {
        setInstanceId(instId)
        const { data } = await supabase
          .from('intern_checklist_items')
          .select('*')
          .eq('instance_id', instId)
          .order('sort_order')
        setItems((data as ChecklistItemRow[]) ?? [])
      }
    } catch (err) {
      console.error('Checklist load error:', err)
    }
    setLoading(false)
  }, [profile, frequency, dateKey])

  useEffect(() => { reload() }, [reload])

  const toggleItem = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newCompleted = !item.is_completed

    setItems(prev =>
      prev.map(i =>
        i.id === id
          ? { ...i, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
          : i
      )
    )

    await supabase
      .from('intern_checklist_items')
      .update({
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq('id', id)
  }

  const grouped: GroupedItems = items.reduce<GroupedItems>((acc, item) => {
    const cat = item.category
    if (!acc[cat]) acc[cat] = []
    acc[cat]!.push(item)
    return acc
  }, {})

  const completedCount = items.filter(i => i.is_completed).length
  const totalCount = items.length
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return { items, grouped, loading, instanceId, toggleItem, completedCount, totalCount, percentage, reload }
}
