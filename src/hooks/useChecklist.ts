import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { localDateKey } from '../lib/dates'

export interface ChecklistItemRow {
  id: string
  instance_id: string
  category: string
  item_text: string
  is_completed: boolean
  completed_at: string | null
  sort_order: number
  is_critical?: boolean
}

export type GroupedItems = Record<string, ChecklistItemRow[]>

export function useChecklist(frequency: 'daily' | 'weekly', date: Date) {
  const { profile } = useAuth()
  const [items, setItems] = useState<ChecklistItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [instanceId, setInstanceId] = useState<string | null>(null)

  const dateKey = localDateKey(date)

  const reload = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    setLoading(true)
    try {
      // Try the existing RPC first (works if the DB function exists)
      const { data: instId, error: rpcError } = await supabase.rpc('intern_generate_checklist', {
        p_intern_id: profile.id,
        p_frequency: frequency,
        p_date: dateKey,
      })

      if (!rpcError && instId) {
        setInstanceId(instId)
        const { data } = await supabase
          .from('intern_checklist_items')
          .select('*')
          .eq('instance_id', instId)
          .order('sort_order')
        setItems((data as ChecklistItemRow[]) ?? [])
        setLoading(false)
        return
      }

      // Fallback: load from task_assignments + report_templates
      const position = profile.position ?? 'intern'

      // Check for existing instance first
      const { data: existing } = await supabase
        .from('intern_checklist_instances')
        .select('id')
        .eq('intern_id', profile.id)
        .eq('frequency', frequency)
        .eq('period_date', dateKey)
        .maybeSingle()

      if (existing) {
        setInstanceId(existing.id)
        const { data } = await supabase
          .from('intern_checklist_items')
          .select('*')
          .eq('instance_id', existing.id)
          .order('sort_order')
        setItems((data as ChecklistItemRow[]) ?? [])
        setLoading(false)
        return
      }

      // No existing instance: find templates via assignments or position default
      const { data: assignments } = await supabase
        .from('task_assignments')
        .select('template_id')
        .or(`intern_id.eq.${profile.id},position.eq.${position}`)
        .eq('is_active', true)

      let templateIds = (assignments ?? []).map((a: { template_id: string }) => a.template_id)

      if (templateIds.length === 0) {
        // Fall back to default templates for this position
        const typeMatch = frequency === 'daily' ? 'checklist' : 'weekly'
        const { data: defaults } = await supabase
          .from('report_templates')
          .select('id')
          .eq('is_default', true)
          .eq('type', typeMatch)
          .or(`position.eq.${position},position.is.null`)

        templateIds = (defaults ?? []).map((t: { id: string }) => t.id)
      }

      if (templateIds.length === 0) {
        setItems([])
        setLoading(false)
        return
      }

      // Load templates
      const { data: templates } = await supabase
        .from('report_templates')
        .select('*')
        .in('id', templateIds)

      if (!templates || templates.length === 0) {
        setItems([])
        setLoading(false)
        return
      }

      // Create instance
      const { data: newInst } = await supabase
        .from('intern_checklist_instances')
        .insert({
          intern_id: profile.id,
          frequency,
          period_date: dateKey,
        })
        .select('id')
        .single()

      if (!newInst) {
        setItems([])
        setLoading(false)
        return
      }

      setInstanceId(newInst.id)
      setItems([])

      const newItems: Array<{
        instance_id: string
        category: string
        item_text: string
        is_completed: boolean
        sort_order: number
      }> = []

      let sortOrder = 0
      for (const template of templates) {
        const fields = template.fields as Array<{ label: string; type: string; is_critical?: boolean }>
        const category = template.name
        for (const field of fields) {
          if (field.type === 'checkbox' || template.type === 'checklist') {
            newItems.push({
              instance_id: newInst.id,
              category,
              item_text: field.label,
              is_completed: false,
              sort_order: sortOrder++,
            })
          }
        }
      }

      if (newItems.length > 0) {
        const { data: inserted } = await supabase
          .from('intern_checklist_items')
          .insert(newItems)
          .select('*')
        setItems((inserted as ChecklistItemRow[]) ?? [])
      } else {
        setItems([])
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
