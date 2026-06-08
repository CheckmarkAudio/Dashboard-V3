// Feedback / support reports. The Feedback button (TroubleshootingButton)
// submits through submit_support_report() — the table has no direct INSERT
// policy, so all writes go through this RPC. Reads are team-scoped by RLS
// (team_id = get_my_team_id()), so admins can triage with a plain select.

import { supabase } from '../supabase'

export type SupportSeverity = 'Low' | 'Medium' | 'High' | 'Critical'
export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed'

export const supportReportKeys = {
  all: ['support-reports'] as const,
  list: () => [...supportReportKeys.all, 'list'] as const,
}

export interface SubmitSupportReportInput {
  description: string
  whatTried?: string | null
  severity?: SupportSeverity
  /** Page the user was on when they hit Feedback — helps triage. */
  pageUrl?: string | null
  userAgent?: string | null
}

/** Submit a feedback / bug report. Returns the new report id. */
export async function submitSupportReport(input: SubmitSupportReportInput): Promise<string> {
  const { data, error } = await supabase.rpc('submit_support_report', {
    p_description: input.description,
    p_what_tried: input.whatTried ?? null,
    p_severity: input.severity ?? 'Medium',
    p_page_url: input.pageUrl ?? null,
    p_user_agent: input.userAgent ?? null,
  })
  if (error) throw error
  return data as string
}

export interface SupportReport {
  id: string
  description: string
  what_tried: string | null
  severity: SupportSeverity
  page_url: string | null
  user_agent: string | null
  status: SupportStatus
  created_at: string
  reported_by: string | null
  /** Reporter display name, joined from team_members (null if no longer on team). */
  reporter: string | null
}

type RawReportRow = {
  id: string
  description: string
  what_tried: string | null
  severity: SupportSeverity
  page_url: string | null
  user_agent: string | null
  status: SupportStatus
  created_at: string
  reported_by: string | null
  member: { display_name: string | null } | { display_name: string | null }[] | null
}

/**
 * All feedback reports for the caller's team (RLS-scoped), newest first.
 * Reporter name embedded via the support_reports → team_members FK.
 */
export async function fetchSupportReports(): Promise<SupportReport[]> {
  const { data, error } = await supabase
    .from('support_reports')
    .select('id, description, what_tried, severity, page_url, user_agent, status, created_at, reported_by, member:team_members!support_reports_reported_by_fkey(display_name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as RawReportRow[]).map((r) => ({
    id: r.id,
    description: r.description,
    what_tried: r.what_tried,
    severity: r.severity,
    page_url: r.page_url,
    user_agent: r.user_agent,
    status: r.status,
    created_at: r.created_at,
    reported_by: r.reported_by,
    reporter: Array.isArray(r.member) ? (r.member[0]?.display_name ?? null) : (r.member?.display_name ?? null),
  }))
}

/** Admin-only: change a report's triage status (via SECURITY DEFINER RPC). */
export async function setSupportReportStatus(id: string, status: SupportStatus): Promise<void> {
  const { error } = await supabase.rpc('set_support_report_status', { p_id: id, p_status: status })
  if (error) throw error
}
