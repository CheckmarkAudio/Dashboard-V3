import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { time as perfTime } from '../lib/perfTrace'
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

/**
 * Shape of a row in `task_edit_requests`. Exported so UI components can
 * read it when rendering pending-approval badges. Matches the subset of
 * fields the member-side UI actually consumes — not the full DB row.
 */
export interface PendingTaskEdit {
  id: string
  instance_id: string
  item_id: string | null
  change_type: 'add' | 'rename' | 'delete'
  proposed_text: string | null
  previous_text: string | null
  proposed_category: string | null
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  requested_by: string
}

export function useChecklist(frequency: 'daily' | 'weekly', date: Date, targetUserId?: string) {
  const { profile } = useAuth()
  const userId = targetUserId ?? profile?.id
  const isOwn = !targetUserId || targetUserId === profile?.id
  const [items, setItems] = useState<ChecklistItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [pendingRequests, setPendingRequests] = useState<PendingTaskEdit[]>([])
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
        // Try the existing RPC first (works if the DB function exists).
        // `checklist:rpc` is the suspected primary cost of first-load-
        // of-the-day — this is the call that generates today's
        // checklist instance on-the-fly when the user arrives. Moving
        // generation to a scheduled backend job is Phase 1 Step 2.
        const { data: instId, error: rpcError } = await perfTime('checklist:rpc', () =>
          supabase.rpc('intern_generate_checklist', {
            p_intern_id: profile.id,
            p_frequency: frequency,
            p_date: dateKey,
          }),
        )
        if (!mountedRef.current) return

        if (!rpcError && instId) {
          setInstanceId(instId)
          const { data } = await perfTime('checklist:items', () => supabase
            .from('team_checklist_items')
            .select('*')
            .eq('instance_id', instId)
            .order('sort_order'),
          )
          if (!mountedRef.current) return
          setItems((data as ChecklistItemRow[]) ?? [])
          setLoading(false)
          return
        }
      }

      // Load existing instance for this user
      const position = isOwn ? (profile?.position ?? 'intern') : 'intern'

      const { data: existing } = await supabase
        .from('team_checklist_instances')
        .select('id')
        .eq('intern_id', userId)
        .eq('frequency', frequency)
        .eq('period_date', dateKey)
        .maybeSingle()
      if (!mountedRef.current) return

      if (existing) {
        setInstanceId(existing.id)
        const { data } = await supabase
          .from('team_checklist_items')
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
        .from('team_checklist_instances')
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
          .from('team_checklist_items')
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

  // ─── Pending task_edit_requests for this instance ────────────────────
  // Loaded in a separate effect keyed on instanceId so the badges update
  // as soon as the member proposes a new edit. Scoped to the current user
  // (only their own proposals) because admin approvals are handled on a
  // different surface (ApprovalsPanel, Phase 5.3).
  const reloadPendingRequests = useCallback(async () => {
    if (!instanceId || !profile?.id) {
      if (mountedRef.current) setPendingRequests([])
      return
    }
    const { data, error } = await supabase
      .from('task_edit_requests')
      .select('id, instance_id, item_id, change_type, proposed_text, previous_text, proposed_category, status, requested_at, requested_by')
      .eq('instance_id', instanceId)
      .eq('requested_by', profile.id)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
    if (!mountedRef.current) return
    if (error) {
      console.error('[useChecklist] pending requests load failed:', error)
      return
    }
    setPendingRequests((data ?? []) as PendingTaskEdit[])
  }, [instanceId, profile?.id])

  useEffect(() => { reloadPendingRequests() }, [reloadPendingRequests])

  // ─── Instant toggle (works for members and admins) ───────────────────
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
      .from('team_checklist_items')
      .update({
        is_completed: newCompleted,
        completed_at: nextCompletedAt,
      })
      .eq('id', id)

    if (!mountedRef.current) return
    if (error) {
      console.error('[useChecklist] toggleItem failed:', error)
      setItems(prev => prev.map(i => (i.id === id ? previous : i)))
    }
  }

  // ─── Member-side propose helpers (approval queue) ────────────────────
  // All three insert a row into task_edit_requests with status='pending'.
  // RLS enforces requested_by = auth.uid() and status='pending' at insert
  // time. On success we reload the pending requests so badges update.

  const proposeAddItem = async (category: string, item_text: string) => {
    if (!instanceId || !profile?.id) return { error: 'Not ready' }
    const trimmed = item_text.trim()
    if (!trimmed) return { error: 'Empty task text' }
    const { error } = await supabase.from('task_edit_requests').insert({
      instance_id: instanceId,
      item_id: null,
      change_type: 'add',
      proposed_text: trimmed,
      previous_text: null,
      proposed_category: category,
      status: 'pending',
      requested_by: profile.id,
      apply_to_template: true,
    })
    if (error) {
      console.error('[useChecklist] proposeAddItem failed:', error)
      return { error: error.message }
    }
    await reloadPendingRequests()
    return { error: null as string | null }
  }

  const proposeRenameItem = async (item_id: string, new_text: string) => {
    if (!instanceId || !profile?.id) return { error: 'Not ready' }
    const item = items.find(i => i.id === item_id)
    if (!item) return { error: 'Item not found' }
    const trimmed = new_text.trim()
    if (!trimmed || trimmed === item.item_text) return { error: null as string | null }
    const { error } = await supabase.from('task_edit_requests').insert({
      instance_id: instanceId,
      item_id,
      change_type: 'rename',
      proposed_text: trimmed,
      previous_text: item.item_text,
      proposed_category: item.category,
      status: 'pending',
      requested_by: profile.id,
      apply_to_template: true,
    })
    if (error) {
      console.error('[useChecklist] proposeRenameItem failed:', error)
      return { error: error.message }
    }
    await reloadPendingRequests()
    return { error: null as string | null }
  }

  const proposeDeleteItem = async (item_id: string) => {
    if (!instanceId || !profile?.id) return { error: 'Not ready' }
    const item = items.find(i => i.id === item_id)
    if (!item) return { error: 'Item not found' }
    const { error } = await supabase.from('task_edit_requests').insert({
      instance_id: instanceId,
      item_id,
      change_type: 'delete',
      proposed_text: null,
      previous_text: item.item_text,
      proposed_category: item.category,
      status: 'pending',
      requested_by: profile.id,
      apply_to_template: true,
    })
    if (error) {
      console.error('[useChecklist] proposeDeleteItem failed:', error)
      return { error: error.message }
    }
    await reloadPendingRequests()
    return { error: null as string | null }
  }

  // ─── Admin-only direct helpers (bypass queue) ────────────────────────
  // These are for admin users who want to edit their own or another
  // member's list without going through approval. The DailyChecklist UI
  // branches on isAdmin to decide which helpers to call. Not gated here
  // because the hook doesn't know what UI context it's in; the UI layer
  // is responsible for only wiring these up when isAdmin is true.

  const addItem = async (category: string, item_text: string) => {
    if (!instanceId) return { error: 'Not ready' }
    const trimmed = item_text.trim()
    if (!trimmed) return { error: 'Empty task text' }
    const nextOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0
    const { data, error } = await supabase
      .from('team_checklist_items')
      .insert({
        instance_id: instanceId,
        category,
        item_text: trimmed,
        is_completed: false,
        sort_order: nextOrder,
      })
      .select('*')
      .single()
    if (error) {
      console.error('[useChecklist] addItem failed:', error)
      return { error: error.message }
    }
    if (data && mountedRef.current) setItems(prev => [...prev, data as ChecklistItemRow])
    return { error: null as string | null }
  }

  const renameItem = async (item_id: string, new_text: string) => {
    const item = items.find(i => i.id === item_id)
    if (!item) return { error: 'Item not found' }
    const trimmed = new_text.trim()
    if (!trimmed || trimmed === item.item_text) return { error: null as string | null }
    const previous = item.item_text
    setItems(prev => prev.map(i => (i.id === item_id ? { ...i, item_text: trimmed } : i)))
    const { error } = await supabase
      .from('team_checklist_items')
      .update({ item_text: trimmed })
      .eq('id', item_id)
    if (error) {
      console.error('[useChecklist] renameItem failed:', error)
      if (mountedRef.current) setItems(prev => prev.map(i => (i.id === item_id ? { ...i, item_text: previous } : i)))
      return { error: error.message }
    }
    return { error: null as string | null }
  }

  const deleteItem = async (item_id: string) => {
    const item = items.find(i => i.id === item_id)
    if (!item) return { error: 'Item not found' }
    const previousItems = items
    setItems(prev => prev.filter(i => i.id !== item_id))
    const { error } = await supabase.from('team_checklist_items').delete().eq('id', item_id)
    if (error) {
      console.error('[useChecklist] deleteItem failed:', error)
      if (mountedRef.current) setItems(previousItems)
      return { error: error.message }
    }
    return { error: null as string | null }
  }

  // ─── Derived state ───────────────────────────────────────────────────
  const grouped: GroupedItems = items.reduce<GroupedItems>((acc, item) => {
    const cat = item.category
    if (!acc[cat]) acc[cat] = []
    acc[cat]!.push(item)
    return acc
  }, {})

  const completedCount = items.filter(i => i.is_completed).length
  const totalCount = items.length
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Map item_id → pending request (rename/delete) so the UI can badge
  // individual items. Also split out pending adds, which have no item_id.
  const pendingByItemId = new Map<string, PendingTaskEdit>()
  const pendingAdds: PendingTaskEdit[] = []
  for (const req of pendingRequests) {
    if (req.change_type === 'add' || req.item_id === null) {
      pendingAdds.push(req)
    } else {
      pendingByItemId.set(req.item_id, req)
    }
  }

  return {
    items,
    grouped,
    loading,
    instanceId,
    toggleItem,
    completedCount,
    totalCount,
    percentage,
    reload,
    // Member-side (queued) actions
    proposeAddItem,
    proposeRenameItem,
    proposeDeleteItem,
    // Admin-side (direct) actions
    addItem,
    renameItem,
    deleteItem,
    // Pending approval surface
    pendingRequests,
    pendingByItemId,
    pendingAdds,
    reloadPendingRequests,
  }
}
