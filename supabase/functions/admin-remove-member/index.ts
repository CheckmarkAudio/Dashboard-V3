// ============================================================================
// admin-remove-member
//
// Safe member removal for Team Manager.
//
// Modes:
//   - inspect: return linked activity counts only
//   - archive: mark member inactive/end-dated and disable login when possible
//   - permanent_delete: only allowed when the member has zero linked activity
//
// Permanent deletion is intentionally narrow. Anything with history should stay
// as an inactive team_members row so old bookings, forum posts, tasks, and
// clock data keep their attribution.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const OWNER_EMAIL = "checkmarkaudio@gmail.com"

type RemoveMode = "inspect" | "archive" | "permanent_delete"

interface RemoveMemberBody {
  member_id: string
  mode?: RemoveMode
  confirm?: string
}

interface ActivityItem {
  key: string
  label: string
  count: number
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase()
}

function isUuid(raw: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
}

async function countRows(
  admin: ReturnType<typeof createClient>,
  table: string,
  column: string,
  memberId: string,
): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select(column, { count: "exact", head: true })
    .eq(column, memberId)
  if (error) {
    // Some historical tables/columns only exist in older/newer environments.
    // If the table or column itself is absent, it cannot contain rows linking
    // this member in the currently deployed schema.
    const msg = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase()
    if (
      error.code === "PGRST204" ||
      error.code === "PGRST205" ||
      msg.includes("could not find") ||
      msg.includes("does not exist")
    ) {
      return 0
    }
    throw new Error(`Could not inspect ${table}.${column}: ${error.message}`)
  }
  return count ?? 0
}

async function countAny(
  admin: ReturnType<typeof createClient>,
  label: string,
  checks: { table: string; column: string }[],
  memberId: string,
): Promise<ActivityItem> {
  let count = 0
  for (const check of checks) {
    count += await countRows(admin, check.table, check.column, memberId)
  }
  return {
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    label,
    count,
  }
}

async function getActivity(admin: ReturnType<typeof createClient>, memberId: string): Promise<ActivityItem[]> {
  return Promise.all([
    countAny(admin, "Bookings and sessions", [
      { table: "sessions", column: "assigned_to" },
      { table: "sessions", column: "created_by" },
    ], memberId),
    countAny(admin, "Assigned tasks", [
      { table: "assigned_tasks", column: "assigned_to" },
      { table: "task_assignments", column: "intern_id" },
      { table: "task_assignments", column: "assigned_by" },
      { table: "assignment_recipients", column: "recipient_id" },
      { table: "task_assignment_batches", column: "assigned_by" },
      { table: "task_templates", column: "created_by" },
    ], memberId),
    countAny(admin, "Task requests and transfers", [
      { table: "task_requests", column: "requester_id" },
      { table: "task_requests", column: "reviewer_id" },
      { table: "task_edit_requests", column: "requested_by" },
      { table: "task_edit_requests", column: "reviewer_id" },
      { table: "task_reassign_requests", column: "requester_id" },
      { table: "task_reassign_requests", column: "current_assignee_id" },
      { table: "task_reassign_requests", column: "resolver_id" },
    ], memberId),
    countAny(admin, "Notifications", [
      { table: "assignment_notifications", column: "recipient_id" },
    ], memberId),
    countAny(admin, "Forum activity", [
      { table: "chat_messages", column: "sender_id" },
      { table: "chat_channel_reads", column: "user_id" },
    ], memberId),
    countAny(admin, "Media uploads", [
      { table: "media_submissions", column: "member_id" },
    ], memberId),
    countAny(admin, "Clock entries", [
      { table: "time_clock_entries", column: "user_id" },
    ], memberId),
    countAny(admin, "Schedule records", [
      { table: "team_schedule_recurring", column: "member_id" },
      { table: "team_schedule_recurring", column: "created_by" },
      { table: "team_schedule_blocks", column: "member_id" },
      { table: "team_schedule_blocks", column: "created_by" },
      { table: "team_schedule_blocks", column: "requested_by" },
      { table: "team_schedule_blocks", column: "approved_by" },
      { table: "team_schedule_templates", column: "intern_id" },
    ], memberId),
    countAny(admin, "Checklist records", [
      { table: "team_checklist_instances", column: "intern_id" },
      { table: "team_daily_notes", column: "intern_id" },
      { table: "team_maintenance_items", column: "created_by" },
      { table: "team_maintenance_completions", column: "checked_by" },
    ], memberId),
    countAny(admin, "KPI records", [
      { table: "member_kpis", column: "intern_id" },
      { table: "member_kpis", column: "created_by" },
      { table: "member_kpi_entries", column: "entered_by" },
    ], memberId),
    countAny(admin, "Pipeline assignments", [
      { table: "artist_pipeline", column: "assigned_to" },
      { table: "education_students", column: "assigned_to" },
      { table: "projects", column: "assigned_to" },
      { table: "team_leads", column: "created_by" },
      { table: "team_leads", column: "intern_id" },
      { table: "team_lead_activities", column: "created_by" },
    ], memberId),
    countAny(admin, "Reviews and submissions", [
      { table: "team_performance_reviews", column: "intern_id" },
      { table: "team_performance_reviews", column: "reviewer_id" },
      { table: "weekly_admin_reviews", column: "intern_id" },
      { table: "weekly_admin_reviews", column: "reviewer_id" },
      { table: "deliverable_submissions", column: "intern_id" },
      { table: "deliverable_submissions", column: "reviewed_by" },
    ], memberId),
    countAny(admin, "Metrics and integrations", [
      { table: "platform_metrics", column: "entered_by" },
      { table: "google_calendar_connections", column: "connected_by" },
      { table: "google_oauth_states", column: "created_by" },
    ], memberId),
    countAny(admin, "Manager links", [
      { table: "team_members", column: "managed_by" },
    ], memberId),
  ])
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ ok: false, error: "Edge Function misconfigured (missing env)" }, 500)
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Missing Authorization header" }, 401)
  }

  let body: RemoveMemberBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400)
  }

  const memberId = (body.member_id ?? "").trim()
  const mode = body.mode ?? "inspect"
  if (!isUuid(memberId)) return jsonResponse({ ok: false, error: "member_id must be a valid UUID" }, 400)
  if (!["inspect", "archive", "permanent_delete"].includes(mode)) {
    return jsonResponse({ ok: false, error: "Invalid removal mode" }, 400)
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: callerUser, error: callerUserErr } = await caller.auth.getUser()
  if (callerUserErr || !callerUser.user) {
    return jsonResponse({ ok: false, error: "Not authenticated" }, 401)
  }

  const { data: callerProfile, error: callerProfileErr } = await caller
    .from("team_members")
    .select("id, role, team_id")
    .eq("id", callerUser.user.id)
    .maybeSingle()
  if (callerProfileErr || !callerProfile || callerProfile.role !== "admin") {
    return jsonResponse({ ok: false, error: "Only team admins can remove members" }, 403)
  }
  if (callerProfile.id === memberId) {
    return jsonResponse({ ok: false, error: "You cannot remove your own account from Team Manager." }, 400)
  }

  const { data: member, error: memberErr } = await admin
    .from("team_members")
    .select("id, display_name, email, role, position, status, team_id")
    .eq("id", memberId)
    .maybeSingle()
  if (memberErr || !member) return jsonResponse({ ok: false, error: "Member not found" }, 404)
  if (member.team_id && callerProfile.team_id && member.team_id !== callerProfile.team_id) {
    return jsonResponse({ ok: false, error: "Member is outside your team" }, 403)
  }
  if (normalizeEmail(member.email) === OWNER_EMAIL || member.position === "owner") {
    return jsonResponse({ ok: false, error: "The primary owner cannot be removed here." }, 400)
  }

  let activity: ActivityItem[]
  try {
    activity = await getActivity(admin, memberId)
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : "Could not inspect activity" }, 500)
  }

  const totalActivity = activity.reduce((sum, item) => sum + item.count, 0)
  const canPermanentlyDelete = totalActivity === 0

  if (mode === "inspect") {
    return jsonResponse({
      ok: true,
      action: "inspect",
      member,
      activity,
      total_activity: totalActivity,
      can_permanently_delete: canPermanentlyDelete,
    })
  }

  if (mode === "archive") {
    const today = new Date().toISOString().slice(0, 10)
    const { error: archiveErr } = await admin
      .from("team_members")
      .update({ status: "inactive", end_date: today })
      .eq("id", memberId)
    if (archiveErr) return jsonResponse({ ok: false, error: archiveErr.message }, 400)

    let auth_warning: string | null = null
    try {
      const { error: banErr } = await admin.auth.admin.updateUserById(memberId, {
        ban_duration: "876000h",
      })
      if (banErr && !/not found/i.test(banErr.message)) auth_warning = banErr.message
    } catch (err) {
      auth_warning = err instanceof Error ? err.message : "Could not disable login"
    }

    return jsonResponse({
      ok: true,
      action: "archived",
      member_id: memberId,
      activity,
      total_activity: totalActivity,
      can_permanently_delete: canPermanentlyDelete,
      auth_warning,
    })
  }

  if (body.confirm !== "PERMANENTLY DELETE") {
    return jsonResponse({ ok: false, error: "Permanent deletion requires confirmation text." }, 400)
  }
  if (!canPermanentlyDelete) {
    return jsonResponse({
      ok: false,
      error: "This member has linked activity. Archive them instead.",
      activity,
      total_activity: totalActivity,
      can_permanently_delete: false,
    }, 409)
  }

  const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(memberId)
  if (deleteAuthErr && !/not found/i.test(deleteAuthErr.message)) {
    return jsonResponse({ ok: false, error: deleteAuthErr.message }, 400)
  }

  const { error: deleteProfileErr } = await admin
    .from("team_members")
    .delete()
    .eq("id", memberId)
  if (deleteProfileErr) {
    return jsonResponse({ ok: false, error: deleteProfileErr.message }, 400)
  }

  return jsonResponse({
    ok: true,
    action: "permanently_deleted",
    member_id: memberId,
    activity,
    total_activity: totalActivity,
    can_permanently_delete: true,
  })
})
