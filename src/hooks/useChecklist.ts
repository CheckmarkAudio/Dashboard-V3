import { useState, useEffect, useCallback, useRef } from 'react'
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

export function useChecklist(frequency: 'daily' | 'weekly', date: Date, targetUserId?: string) {
  const { profile } = useAuth()
  const userId = targetUserId ?? profile?.id
  const isOwn = !targetUserId || targetUserId === profile?.id
  const [items, setItems] = useState<ChecklistItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  // Tracks whether the hook is still mounted so async work doesn't
  // fire setState after unmount (classic React warning + memory leak
  // if rapid navigation cancels a long query sequence).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const dateKey = localDateKey(date)

  const reload = useCallback(async () => {
    if (!userId) {
      if (mountedRef.current) setLoading(false)
      return
    }
    if (mountedRef.current) setLoading(true)
    try {
      if (isOwn && profile) {
        // Try the existing RPC first (works if the DB function exists)
        const { data: instId, error: rpcError } = await supabase.rpc('intern_generate_checklist', {
          p_intern_id: profile.id,
          p_frequency: frequency,
          p_date: dateKey,
        })
        if (!mountedRef.current) return

        if (!rpcError && instId) {
          setInstanceId(instId)
          const { data } = await supabase
            .from('intern_checklist_items')
            .select('*')
            .eq('instance_id', instId)
            .order('sort_order')
          if (!mountedRef.current) return
          setItems((data as ChecklistItemRow[]) ?? [])
          setLoading(false)
          return
        }
      }

      // Load existing instance for this user
      const position = isOwn ? (profile?.position ?? 'intern') : 'intern'

      const { data: existing } = await supabase
        .from('intern_checklist_instances')
        .select('id')
        .eq('intern_id', userId)
        .eq('frequency', frequency)
        .eq('period_date', dateKey)
        .maybeSingle()
      if (!mountedRef.current) return

      if (existing) {
        setInstanceId(existing.id)
        const { data } = await supabase
          .from('intern_checklist_items')
          .select('*')
          .eq('instance_id', existing.id)
          .order('sort_order')
        if (!mountedRef.current) return
        setItems((data as ChecklistItemRow[]) ?? [])
        setLoading(false)
        return
      }

      // Only auto-create instances for the logged-in user's own checklist
      if (!isOwn || !profile) {
        setItems([])
        setLoading(false)
        return
      }

      // No existing instance: find templates via assignments or position default
      const { data: assignments } = await supabase
        .from('task_assignments')
        .select('template_id')
        .or(`intern_id.eq.${profile.id},position.eq.${position}`)
        .eq('is_active', true)
      if (!mountedRef.current) return

      let templateIds = (assignments ?? []).map((a: { template_id: string }) => a.template_id)

      if (templateIds.length === 0) {
        const typeMatch = frequency === 'daily' ? 'checklist' : 'weekly'
        const { data: defaults } = await supabase
          .from('report_templates')
          .select('id')
          .eq('is_default', true)
          .eq('type', typeMatch)
          .or(`position.eq.${position},position.is.null`)
        if (!mountedRef.current) return

        templateIds = (defaults ?? []).map((t: { id: string }) => t.id)
      }

      if (templateIds.length === 0) {
        setItems([])
        setLoading(false)
        return
      }

      const { data: templates } = await supabase
        .from('report_templates')
        .select('*')
        .in('id', templateIds)
      if (!mountedRef.current) return

      if (!templates || templates.length === 0) {
        setItems([])
        setLoading(false)
        return
      }

      const { data: newInst } = await supabase
        .from('intern_checklist_instances')
        .insert({
          intern_id: profile.id,
          frequency,
          period_date: dateKey,
        })
        .select('id')
        .single()
      if (!mountedRef.current) return

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
        if (!mountedRef.current) return
        setItems((inserted as ChecklistItemRow[]) ?? [])
      } else {
        setItems([])
      }
    } catch (err) {
      console.error('Checklist load error:', err)
    }
    if (mountedRef.current) setLoading(false)
  }, [userId, isOwn, profile, frequency, dateKey])

  useEffect(() => { reload() }, [reload])

  const toggleItem = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const previous = item
    const newCompleted = !item.is_completed
    const nextCompletedAt = newCompleted ? new Date().toISOString() : null

    // Optimistic
    setItems(prev =>
      prev.map(i =>
        i.id === id
          ? { ...i, is_completed: newCompleted, completed_at: nextCompletedAt }
          : i
      )
    )

    const { error } = await supabase
      .from('intern_checklist_items')
      .update({
        is_completed: newCompleted,
        completed_at: nextCompletedAt,
      })
      .eq('id', id)

    if (!mountedRef.current) return
    if (error) {
      // Roll back so UI matches server
      console.error('[useChecklist] toggleItem failed:', error)
      setItems(prev => prev.map(i => (i.id === id ? previous : i)))
    }
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
