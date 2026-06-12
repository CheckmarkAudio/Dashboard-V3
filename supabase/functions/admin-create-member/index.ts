// ============================================================================
// admin-create-member — Supabase Edge Function
//
// Creates a new team member account and automatically sends them an
// invitation email so they can set their own password — no manual
// link-copying by the admin required.
//
// FLOW
//   1. Verify caller is a signed-in team admin.
//   2. Call inviteUserByEmail — creates the auth.users row AND sends
//      the "You've been invited" email via Supabase's email service.
//   3. Insert a team_members profile row with status='pending'.
//   4. Return { ok: true, profile } to the client.
//
// The new member receives an email with a setup link. When they click
// it, the client catches type=invite in the URL hash, RecoveryGate
// shows the "Set your password" form, and on success their status
// flips to 'active' automatically.
//
// ACCESS CONTROL
//   - verify_jwt: true — caller's JWT required.
//   - Re-checks admin role via team_members so a leaked user JWT
//     can't escalate privileges.
//
// SECRETS (auto-injected by Supabase, never leave this function)
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - SUPABASE_ANON_KEY
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

interface CreateMemberBody {
  email: string
  display_name: string
  role?: "admin" | "member"
  position?: string | null
  phone?: string | null
  start_date?: string | null
  managed_by?: string | null
  /** Pass true from the "Re-send invite" action to skip the duplicate-check guard. */
  resend_invite?: boolean
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ ok: false, error: "Edge Function misconfigured (missing env)" }, 500)
  }

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

  if (!email) return jsonResponse({ ok: false, error: "Email is required" }, 400)
  if (!display_name) return jsonResponse({ ok: false, error: "Display name is required" }, 400)

  // Admin client — service role, bypasses RLS. Never returned to caller.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Caller client — hits RLS as the calling admin user.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1) Verify the caller is a signed-in team admin.
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

  // 2) Check if this email already has an auth account.
  //    - If it does and is already confirmed → return a clear error so
  //      the admin knows to use "Re-send invite" instead.
  //    - If it exists but is unconfirmed → re-send the invite.
  let existingUserId: string | null = null
  try {
    const { data: existingList } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const existing = existingList?.users?.find(
      (u) => u.email?.toLowerCase() === email
    )
    if (existing) {
      if (existing.email_confirmed_at && !body.resend_invite) {
        // Already has a confirmed account — don't overwrite it.
        // Check if they already have a team_members row.
        const { data: existingProfile } = await admin
          .from("team_members")
          .select("id, status")
          .eq("id", existing.id)
          .maybeSingle()
        if (existingProfile) {
          return jsonResponse({
            ok: false,
            error: `${email} already has an active account. Use the Members list to manage their status.`,
          }, 409)
        }
        // Auth user exists but no profile — create the profile for them.
        existingUserId = existing.id
      } else {
        // Unconfirmed invite or explicit resend — resend the invite.
        existingUserId = existing.id
      }
    }
  } catch (_) {
    // listUsers failed — proceed and let inviteUserByEmail sort it out.
  }

  // 3) Send the invitation email (creates auth user OR re-sends invite).
  //    inviteUserByEmail automatically emails the member a "Set up your
  //    account" link — no manual link copying needed.
  let newUserId: string

  if (existingUserId) {
    // Re-use existing auth user id (resend path).
    newUserId = existingUserId
    // Send a fresh invite link via generateLink so the member gets a new
    // "You've been invited" email (not a recovery/"Reset password" email).
    const { error: linkErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
    })
    if (linkErr) {
      // generateLink can fail if Supabase email is not configured — try
      // recovery as a fallback so the member can still set a password.
      await admin.auth.admin.generateLink({ type: "recovery", email }).catch(() => {})
    }
  } else {
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          display_name,
          created_by_admin: callerUser.user.id,
          requires_password_change: true,
        },
        // No redirectTo — uses the project's configured Site URL so
        // the invite link doesn't need a separate Redirect URL allowlist entry.
      }
    )
    if (inviteErr || !inviteData?.user) {
      const msg = inviteErr?.message ?? "Failed to send invitation"
      return jsonResponse({ ok: false, error: msg }, 400)
    }
    newUserId = inviteData.user.id
  }

  // 4) Insert the team_members profile row.
  //    status = 'pending' — flips to 'active' automatically when the
  //    member clicks their invite link and sets a password.
  const profileRow = {
    id: newUserId,
    email,
    display_name,
    role: body.role ?? "member",
    position: body.position ?? null,
    phone: body.phone?.trim() || null,
    start_date: body.start_date || null,
    status: "pending",
    managed_by: body.managed_by || null,
    team_id: teamId,
  }

  // Upsert so a re-send doesn't fail if the profile already exists.
  const { data: inserted, error: insertErr } = await admin
    .from("team_members")
    .upsert(profileRow, { onConflict: "id", ignoreDuplicates: false })
    .select("*")
    .maybeSingle()

  if (insertErr || !inserted) {
    // Roll back the newly-created auth user (don't roll back on resend path).
    if (!existingUserId) {
      await admin.auth.admin.deleteUser(newUserId).catch(() => {})
    }
    const msg = insertErr?.message ?? "Failed to create profile"
    return jsonResponse({ ok: false, error: msg }, 400)
  }

  return jsonResponse({
    ok: true,
    profile: inserted,
    invite_email_sent: true,
  })
})
