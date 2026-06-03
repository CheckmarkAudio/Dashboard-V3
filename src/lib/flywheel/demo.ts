// Flywheel DEMO MODE — a zero-cost, no-DB-write preview of a populated
// dashboard so we can see "how it runs" busy without seeding fake rows into
// the shared production database.
//
// Turn on:  append ?flywheel-demo=1 to any URL (persists for the browser
//           session). Turn off: ?flywheel-demo=0 (or close the tab).
//
// When on, the flywheel read functions (fetchFlywheelStageSummary /
// fetchFlywheelActivity) return synthetic data instead of querying Supabase.
// A "DEMO DATA" badge is shown so it's never mistaken for real activity.
// Real users never trip this — it's off unless the param is present.

import { FLYWHEEL_STAGE_KEYS, type FlywheelStage } from './stages'
import type { FlywheelStageCount, FlywheelActivityRow } from '../queries/flywheelEvents'

const STORAGE_KEY = 'flywheel-demo'

/** Is the flywheel demo preview active for this session? */
export function isFlywheelDemo(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const param = new URLSearchParams(window.location.search).get('flywheel-demo')
    if (param === '1') { sessionStorage.setItem(STORAGE_KEY, '1'); return true }
    if (param === '0') { sessionStorage.removeItem(STORAGE_KEY); return false }
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// All-time per-stage totals for a busy, healthy studio (~a year of activity).
// Production + Workflow lead (tasks, bookings, deliverables), steady Discovery
// (leads/clients/content), with real-but-smaller Education + Retention.
const DEMO_BASE: Record<FlywheelStage, number> = {
  discovery: 210,
  workflow: 300,
  production: 380,
  education: 95,
  retention: 70,
}

/**
 * Synthetic per-stage counts scaled to the requested window. No `since`
 * (all-time) returns the full ~year totals; a date range scales by its span.
 * A per-member view (member set) shows a believable personal slice.
 */
export function demoStageSummary(opts?: {
  since?: string | null
  until?: string | null
  member?: string | null
}): FlywheelStageCount[] {
  const { since, until, member } = opts ?? {}
  let factor = 1
  if (since) {
    const end = until ? Date.parse(until) : Date.now()
    const spanDays = Math.max(1, (end - Date.parse(since)) / 86_400_000)
    factor = Math.min(1, spanDays / 365)
  }
  const memberScale = member ? 0.28 : 1
  return FLYWHEEL_STAGE_KEYS.map((stage) => ({
    stage,
    event_count: Math.max(0, Math.round(DEMO_BASE[stage] * factor * memberScale)),
  }))
}

type DemoEvent = {
  stage: FlywheelStage
  source_type: string
  metadata: Record<string, unknown>
  actor: string
  minsAgo: number
}

// A believable recent-activity stream. Sources + metadata match what
// describeFlywheelEvent() knows how to phrase, so each renders as a sentence.
const DEMO_FEED: DemoEvent[] = [
  { stage: 'production', source_type: 'task', metadata: { title: 'Mix & master — "Tiger Beatz" EP' }, actor: 'Gavin Hammond', minsAgo: 8 },
  { stage: 'discovery', source_type: 'lead', metadata: { contact: 'Sage Linden', company: 'Sage Linden' }, actor: 'Studio Intern', minsAgo: 22 },
  { stage: 'workflow', source_type: 'session', metadata: { milestone: 'booking_created', session_type: 'Recording', room: 'Studio A' }, actor: 'Checkmark Admin', minsAgo: 41 },
  { stage: 'retention', source_type: 'session', metadata: { milestone: 'repeat_booking', session_type: 'Mixing', prior_sessions: 4 }, actor: 'Gavin Hammond', minsAgo: 73 },
  { stage: 'workflow', source_type: 'checklist', metadata: { label: 'Control Room reset' }, actor: 'Studio Intern', minsAgo: 96 },
  { stage: 'production', source_type: 'deliverable', metadata: { submission_type: 'Master' }, actor: 'Gavin Hammond', minsAgo: 130 },
  { stage: 'discovery', source_type: 'client', metadata: { name: 'Marcus Rey' }, actor: 'Checkmark Admin', minsAgo: 168 },
  { stage: 'education', source_type: 'education_student', metadata: { student_name: 'Maya R.', instrument: 'Vocals' }, actor: 'Studio Intern', minsAgo: 205 },
  { stage: 'workflow', source_type: 'media_upload', metadata: { file_name: 'BTS_reel_final.mov' }, actor: 'Studio Intern', minsAgo: 260 },
  { stage: 'discovery', source_type: 'pipeline', metadata: { artist_name: 'Glitz Biarritz' }, actor: 'Gavin Hammond', minsAgo: 330 },
  { stage: 'production', source_type: 'task', metadata: { title: 'Vocal comp — "Midnight Stew"' }, actor: 'Studio Intern', minsAgo: 410 },
  { stage: 'discovery', source_type: 'task', metadata: { title: 'Post Craigslist + Nextdoor ads' }, actor: 'Checkmark Admin', minsAgo: 520 },
]

/** Synthetic recent activity feed (most recent first), capped to `limit`. */
export function demoActivityFeed(limit = 8): FlywheelActivityRow[] {
  return DEMO_FEED.slice(0, limit).map((e, i) => ({
    id: `demo-${i}`,
    stage: e.stage,
    source_type: e.source_type,
    metadata: e.metadata,
    occurred_at: new Date(Date.now() - e.minsAgo * 60_000).toISOString(),
    actor: e.actor,
  }))
}
