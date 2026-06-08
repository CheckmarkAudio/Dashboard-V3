// Feedback / support reports. The Feedback button (TroubleshootingButton)
// submits through submit_support_report() — the table has no direct INSERT
// policy, so all writes go through this RPC. Reads are team-scoped by RLS
// (team_id = get_my_team_id()), so admins can triage with a plain select.

import { supabase } from '../supabase'

export type SupportSeverity = 'Low' | 'Medium' | 'High' | 'Critical'

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
