import { localDateKey } from '../../lib/dates'
import { loadWeekEvents } from '../../lib/calendar'
import { supabase } from '../../lib/supabase'
import type { CalendarEvent, TeamMember } from '../../types'

export interface AdminOverviewTeamMember {
  id: string
  displayName: string
  position: string
  dailyDone: number
  dailyTotal: number
  submittedToday: boolean
}

export interface AdminOverviewSnapshot {
  activeMembers: number
  membersWithDailyTasks: number
  fullyCompleteMembers: number
  submittedTodayCount: number
  pendingEditRequests: number
  pendingSubmissionReviews: number
  members: AdminOverviewTeamMember[]
}

export async function loadAdminOverviewSnapshot(): Promise<AdminOverviewSnapshot> {
  const today = localDateKey()
  const [
    membersRes,
    pendingEditsRes,
    todaysSubmissionsRes,
    pendingReviewsRes,
    instancesRes,
  ] = await Promise.all([
    supabase
      .from('intern_users')
      .select('id, display_name, position, status')
      .neq('status', 'inactive')
      .order('display_name'),
    supabase
      .from('task_edit_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('deliverable_submissions')
      .select('intern_id')
      .eq('submission_date', today),
    supabase
      .from('deliverable_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('submission_date', today)
      .is('reviewed_at', null),
    supabase
      .from('intern_checklist_instances')
      .select('id, intern_id')
      .eq('frequency', 'daily')
      .eq('period_date', today),
  ])

  if (membersRes.error) throw membersRes.error
  if (pendingEditsRes.error) throw pendingEditsRes.error
  if (todaysSubmissionsRes.error) throw todaysSubmissionsRes.error
  if (pendingReviewsRes.error) throw pendingReviewsRes.error
  if (instancesRes.error) throw instancesRes.error

  const members = (membersRes.data ?? []) as Array<Pick<TeamMember, 'id' | 'display_name' | 'position' | 'status'>>
  const submissionsToday = new Set(
    ((todaysSubmissionsRes.data ?? []) as Array<{ intern_id: string }>).map((row) => row.intern_id),
  )

  const instances = (instancesRes.data ?? []) as Array<{ id: string; intern_id: string }>
  const instanceIds = instances.map((instance) => instance.id)
  const internIdByInstanceId = new Map(instances.map((instance) => [instance.id, instance.intern_id]))

  const itemsRes = instanceIds.length > 0
    ? await supabase
        .from('intern_checklist_items')
        .select('instance_id, is_completed')
        .in('instance_id', instanceIds)
    : { data: [], error: null }

  if (itemsRes.error) throw itemsRes.error

  const checklistByMember = new Map<string, { done: number; total: number }>()
  for (const row of (itemsRes.data ?? []) as Array<{ instance_id: string; is_completed: boolean }>) {
    const memberId = internIdByInstanceId.get(row.instance_id)
    if (!memberId) continue
    const current = checklistByMember.get(memberId) ?? { done: 0, total: 0 }
    current.total += 1
    if (row.is_completed) current.done += 1
    checklistByMember.set(memberId, current)
  }

  const teamMembers: AdminOverviewTeamMember[] = members.map((member) => {
    const progress = checklistByMember.get(member.id)
    return {
      id: member.id,
      displayName: member.display_name,
      position: member.position ?? 'member',
      dailyDone: progress?.done ?? 0,
      dailyTotal: progress?.total ?? 0,
      submittedToday: submissionsToday.has(member.id),
    }
  })

  return {
    activeMembers: teamMembers.length,
    membersWithDailyTasks: teamMembers.filter((member) => member.dailyTotal > 0).length,
    fullyCompleteMembers: teamMembers.filter(
      (member) => member.dailyTotal > 0 && member.dailyDone === member.dailyTotal,
    ).length,
    submittedTodayCount: teamMembers.filter((member) => member.submittedToday).length,
    pendingEditRequests: pendingEditsRes.count ?? 0,
    pendingSubmissionReviews: pendingReviewsRes.count ?? 0,
    members: teamMembers,
  }
}

export async function loadAdminTodaySchedule(): Promise<CalendarEvent[]> {
  const today = localDateKey()
  const { events } = await loadWeekEvents({ scope: 'team' })

  return events
    .filter((event) => event.date === today && event.kind !== 'schedule_focus')
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
}
