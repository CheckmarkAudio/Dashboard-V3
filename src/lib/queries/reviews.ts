// Client reviews (Retention epic). Logging a review records to client_reviews
// AND emits a Retention flywheel event — both happen server-side in the
// log_client_review RPC, so the client just calls it. Reads are team-scoped
// by RLS, so a plain select is automatically isolated to the caller's team.

import { supabase } from '../supabase'

export type ReviewSource = 'manual' | 'google' | 'other'

export const reviewKeys = {
  all: ['client-reviews'] as const,
  stats: () => [...reviewKeys.all, 'stats'] as const,
}

export interface LogReviewInput {
  clientId: string | null
  rating: number
  source?: ReviewSource
  body?: string | null
}

/** Log a received review → inserts the row + emits a Retention event. */
export async function logClientReview(input: LogReviewInput): Promise<string> {
  const { data, error } = await supabase.rpc('log_client_review', {
    p_client_id: input.clientId,
    p_rating: input.rating,
    p_source: input.source ?? 'manual',
    p_body: input.body ?? null,
  })
  if (error) throw error
  return data as string
}

export interface ClientReviewStat {
  count: number
  avg: number
}

/**
 * Per-client review stats (count + average rating) for the caller's team,
 * keyed by client_id. Plus a `team` rollup under the '__team__' key. Computed
 * client-side from the (team-scoped) rows — fine at studio volumes.
 */
export async function fetchReviewStats(): Promise<{
  byClient: Map<string, ClientReviewStat>
  team: ClientReviewStat
}> {
  const { data, error } = await supabase
    .from('client_reviews')
    .select('client_id, rating')
  if (error) throw error
  const rows = (data ?? []) as { client_id: string | null; rating: number }[]
  const byClient = new Map<string, { sum: number; count: number }>()
  let teamSum = 0
  for (const r of rows) {
    teamSum += r.rating
    if (r.client_id) {
      const cur = byClient.get(r.client_id) ?? { sum: 0, count: 0 }
      cur.sum += r.rating
      cur.count += 1
      byClient.set(r.client_id, cur)
    }
  }
  const out = new Map<string, ClientReviewStat>()
  for (const [id, v] of byClient) {
    out.set(id, { count: v.count, avg: Math.round((v.sum / v.count) * 10) / 10 })
  }
  return {
    byClient: out,
    team: { count: rows.length, avg: rows.length ? Math.round((teamSum / rows.length) * 10) / 10 : 0 },
  }
}
