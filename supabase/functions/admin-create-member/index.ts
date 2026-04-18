// ============================================================================
// admin-create-member — Supabase Edge Function
//
// Called by the admin-side TeamManager UI to create a new team member
// account. Combines Supabase Auth's admin API (to create the auth user with
// an admin-chosen default password) and the team_members profile insert into
// a single atomic operation: if either half fails, the other is rolled back
// so we never leave a half-created account.
//
// ACCESS CONTROL
//   - verify_jwt: true (set on deploy) — the caller's JWT is required.
//   - The function re-runs an admin check against team_members so even a
//     leaked user JWT can't escalate privileges. Only team admins pass.
//
// SECRETS USED
//   - SUPABASE_URL            (auto-injected by Supabase)
//   - SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase — never leaves
//                                this function, never reaches the client)
//
// RESPONSE SHAPE
//   { ok: true, profile: TeamMember }     // on success
//   { ok: false, error: string }          // on failure (client surfaces as toast)
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

interface CreateMemberBody {
  email: string
  display_name: string
  default_password: string
  role?: "admin" | "member"
  position?: string | null
  phone?: string | null
  start_date?: string | null
  status?: "active" | "inactive"
  managed_by?: string | null
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: "Edge Function misconfigured (missing env)" }, 500)
  }

  // Caller's JWT — we use it to identify the admin and enforce RLS on the
  // profile lookup. Supabase Functions passes the raw auth header through.
  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Missing Authorization header" }, 401)
  }

  let body: CreateMemberBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400)
  }

  const email = normalizeEmail(body.email)
  const display_name = body.display_name?.trim() ?? ""
  const default_password = body.default_password ?? ""

  if (!email) return jsonResponse({ ok: false, error: "Email is required" }, 400)
  if (!display_name) return jsonResponse({ ok: false, error: "Display name is required" }, 400)
  if (default_password.length < 8) {
    return jsonResponse(
      { ok: false, error: "Default password must be at least 8 characters" },
      400,
    )
  }

  // Admin client with service role — bypasses RLS. NEVER leaves this function.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Caller client with the user JWT — hits RLS as the admin user.
  const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1) Identify the caller from their JWT, then verify they're a team admin.
  const { data: callerUser, error: callerUserErr } = await caller.auth.getUser()
  if (callerUserErr || !callerUser.user) {
    return jsonResponse({ ok: false, error: "Not authenticated" }, 401)
  }
  const { data: callerProfile, error: callerProfileErr } = await caller
    .from("team_members")
    .select("id, role, team_id")
    .eq("id", callerUser.user.id)
    .maybeSingle()
  if (callerProfileErr || !callerProfile) {
    return jsonResponse({ ok: false, error: "Caller profile not found" }, 403)
  }
  if (callerProfile.role !== "admin") {
    return jsonResponse({ ok: false, error: "Only team admins can create members" }, 403)
  }

  const teamId = callerProfile.team_id

  // 2) Create the auth user with the admin-supplied password.
  const { data: createdAuth, error: createAuthErr } = await admin.auth.admin.createUser({
    email,
    password: default_password,
    email_confirm: true, // skip the email-verification step; admin vouches for them
    user_metadata: {
      display_name,
      created_by_admin: callerUser.user.id,
      requires_password_change: true,
    },
  })
  if (createAuthErr || !createdAuth.user) {
    const msg = createAuthErr?.message ?? "Failed to create auth user"
    return jsonResponse({ ok: false, error: msg }, 400)
  }

  const newUserId = createdAuth.user.id

  // 3) Insert the team_members row with id = new auth uid.
  const profileRow = {
    id: newUserId,
    email,
    display_name,
    role: body.role ?? "member",
    position: body.position ?? null,
    phone: body.phone?.trim() || null,
    start_date: body.start_date || null,
    status: body.status ?? "active",
    managed_by: body.managed_by || null,
    team_id: teamId,
  }
  const { data: inserted, error: insertErr } = await admin
    .from("team_members")
    .insert(profileRow)
    .select("*")
    .maybeSingle()

  if (insertErr || !inserted) {
    // Roll back the auth user so we don't leave a half-created account.
    await admin.auth.admin.deleteUser(newUserId)
    const msg = insertErr?.message ?? "Failed to create profile"
    return jsonResponse({ ok: false, error: msg }, 400)
  }

  return jsonResponse({ ok: true, profile: inserted })
})
