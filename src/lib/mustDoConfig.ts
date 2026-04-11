export const MUST_DO_CONFIG: Record<string, { label: string; submissionType: string }> = {
  owner: { label: 'Review team progress and approve submitted work', submissionType: 'team_review' },
  marketing_admin: { label: 'Submit content to Dropbox and update team schedule', submissionType: 'content_and_schedule' },
  artist_development: { label: 'Complete client/artist follow-ups and log communications', submissionType: 'client_followup_log' },
  intern: { label: 'Submit 1 social media piece to Dropbox', submissionType: 'social_media_content' },
  engineer: { label: 'Update session notes and project status', submissionType: 'session_notes' },
  producer: { label: 'Review active projects and update timelines', submissionType: 'project_review' },
}

export function getMustDoConfig(position: string) {
  return MUST_DO_CONFIG[position] ?? MUST_DO_CONFIG.intern
}
