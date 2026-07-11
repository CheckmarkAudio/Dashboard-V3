// ============================================================================
// admin-create-member — Supabase Edge Function
//
// Creates (or repairs, or reactivates) a team member account and returns a
// guaranteed SETUP LINK the admin can hand to the member directly. Email
// delivery on this project has proven unreliable (no custom SMTP), so the
// link — not the email — is the canonical onboarding artifact. The client
// shows it with a copy button right after creation.
//
// WHY NOT inviteUserByEmail
//   inviteUserByEmail leaves the auth user unconfirmed until they click the
//   emailed link, and recovery-link generation fails for unconfirmed users.
//   If the email never arrives (the common case here), the account is
//   stranded. createUser(email_confirm: true) + generateLink(recovery) is
//   the pattern admin-generate-setup-link has used successfully since
//   2026-05-14 — one consistent mechanism the RecoveryGate already handles.
//
// SELF-HEALING (the "already been registered" fix)
//   The email is looked up in auth.users first and every state is handled:
//     - no auth user            → create it fresh
//     - auth user, no profile   → ADOPT the orphan (deleting a member used
//                                 to leave the auth account behind; this
//                                 makes re-adding that email just work)
//     - profile, archived       → REACTIVATE: unban login, refresh details,
//                                 back to 'pending' with a fresh setup link
//     - profile, active/pending → clear 409 telling the admin the person is
//                                 already on the roster (resend_invite: true
//                                 skips this guard and issues a fresh link)
//
// RESPONSE SHAPE
//   { ok: true, profile, setup_link, action, link_warning? }
//     action: "created" | "adopted" | "reactivated" | "resent"
//   { ok: false, error }   // client surfaces as toast
//
// ACCESS CONTROL
//   - verify_jwt: true — caller's JWT required.
//   - Re-checks admin role via team_members so a leaked user JWT can't
//     escalate privileges. Any team admin may call this (not owner-only).
//
// SECRETS (auto-injected by Supabase, never leave this function)
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

interface CreateMemberBody {
  email: string
  display_name: string
  role?: "admin" | "intern" | "member"
  position?: string | null
  phone?: string | null
  start_date?: string | null
  managed_by?: string | null
  /** Where the setup link should land after the password is set. */
  redirect_to?: string
  /** Pass true from the "New setup link" action to skip the duplicate guard. */
  resend_invite?: boolean
}

const DEFAULT_REDIRECT_TO = "https://cm-audio.vercel.app/login"

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

// 32-char cryptographically-random throwaway password. The member never
// sees or types it — they set their own via the recovery-style setup link.
function generateRandomPassword(): string {
  const ALPHABET =
    "ABCDEFGHJKLMNPQRSTUVWXYZ" +
    "abcdefghjkmnpqrstuvwxyz" +
    "23456789" +
    "!@#$%^&*-_=+"
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<{ id: string; email_confirmed: boolean } | null> {
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) break
      const match = data.users.find((u) => normalizeEmail(u.email) === email)
      if (match?.id) {
        return { id: match.id, email_confirmed: Boolean(match.email_confirmed_at) }
      }
      if (data.users.length < 1000) break
    }
  } catch (_) {
    // createUser below still returns a clear duplicate error if lookup fails.
  }
  return null
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
  const redirectTo = body.redirect_to?.trim() || DEFAULT_REDIRECT_TO
  // The DB check constraint allows 'admin' | 'intern' (intern = member tier).
  const role = body.role === "admin" ? "admin" : "intern"

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

  // 2) Look up any existing auth account + profile for this email so every
  //    prior state (orphan, archived, active) resolves instead of erroring.
  const existingAuth = await findAuthUserByEmail(admin, email)
  let existingProfile: { id: string; status: string | null; email: string | null } | null = null
  if (existingAuth) {
    const { data } = await admin
      .from("team_members")
      .select("id, status, email")
      .eq("id", existingAuth.id)
      .maybeSingle()
    existingProfile = data ?? null
  }

  let userId: string
  let action: "created" | "adopted" | "reactivated" | "resent"

  if (!existingAuth) {
    // ── Fresh create ──
    const { data: createdAuth, error: createAuthErr } = await admin.auth.admin.createUser({
      email,
      password: generateRandomPassword(),
      email_confirm: true, // admin vouches; also required for recovery links
      user_metadata: {
        display_name,
        created_by_admin: callerUser.user.id,
        requires_password_change: true,
      },
    })
    if (createAuthErr || !createdAuth.user) {
      return jsonResponse(
        { ok: false, error: createAuthErr?.message ?? "Failed to create auth user" },
        400,
      )
    }
    userId = createdAuth.user.id
    action = "created"
  } else if (!existingProfile) {
    // ── Orphaned auth account (deleted member's leftover login) — adopt it ──
    userId = existingAuth.id
    action = "adopted"
    const { error: repairErr } = await admin.auth.admin.updateUserById(userId, {
      password: generateRandomPassword(), // invalidate any old password
      email_confirm: true,
      ban_duration: "none",
      user_metadata: {
        display_name,
        created_by_admin: callerUser.user.id,
        requires_password_change: true,
      },
    })
    if (repairErr) {
      return jsonResponse(
        { ok: false, error: `Found an old login for ${email} but could not repair it: ${repairErr.message}` },
        400,
      )
    }
  } else if (
    existingProfile.status === "inactive" ||
    (body.resend_invite && existingProfile.status === "pending")
  ) {
    // ── Archived member being re-added, or a fresh link for a pending
    //    member who never set a password. Never taken for ACTIVE members —
    //    resetting their password here would lock them out; active members
    //    get reset links via admin-generate-setup-link instead.
    userId = existingAuth.id
    action = existingProfile.status === "inactive" ? "reactivated" : "resent"
    const { error: unbanErr } = await admin.auth.admin.updateUserById(userId, {
      password: generateRandomPassword(),
      email_confirm: true,
      ban_duration: "none", // archive bans login; lift it
      user_metadata: {
        display_name,
        created_by_admin: callerUser.user.id,
        requires_password_change: true,
      },
    })
    if (unbanErr) {
      return jsonResponse(
        { ok: false, error: `Could not re-enable login for ${email}: ${unbanErr.message}` },
        400,
      )
    }
  } else {
    // ── Genuinely already on the roster ──
    return jsonResponse({
      ok: false,
      error: `${email} is already on the roster (status: ${existingProfile.status ?? "active"}). Edit them from the Members list, or use "New setup link" if they need to set a password.`,
    }, 409)
  }

  // 3) Upsert the team_members profile. status='pending' flips to 'active'
  //    automatically when the member sets a password (RecoveryGate) or
  //    signs in (AuthContext).
  const profileRow = {
    id: userId,
    email,
    display_name,
    role,
    position: body.position ?? null,
    phone: body.phone?.trim() || null,
    start_date: body.start_date || null,
    status: "pending",
    managed_by: body.managed_by || null,
    team_id: teamId,
  }
  const { data: upserted, error: upsertErr } = await admin
    .from("team_members")
    .upsert(profileRow, { onConflict: "id", ignoreDuplicates: false })
    .select("*")
    .maybeSingle()

  if (upsertErr || !upserted) {
    // Roll back only a freshly-created auth user; never delete a pre-existing one.
    if (action === "created") {
      await admin.auth.admin.deleteUser(userId).catch(() => {})
    }
    return jsonResponse(
      { ok: false, error: upsertErr?.message ?? "Failed to create profile" },
      400,
    )
  }

  // 4) Generate the setup link (recovery-style — RecoveryGate shows the
  //    "Set your password" form and flips pending → active on success).
  //    If this fails the member still exists; the admin can retry from
  //    Settings → Account Access, so it degrades to a warning, not an error.
  let setupLink: string | null = null
  let linkWarning: string | null = null
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  })
  if (linkErr) {
    linkWarning = linkErr.message
  } else {
    const properties = linkData?.properties as { action_link?: string } | undefined
    setupLink = properties?.action_link ?? null
    if (!setupLink) linkWarning = "Supabase did not return a setup link"
  }

  return jsonResponse({
    ok: true,
    profile: upserted,
    action,
    setup_link: setupLink,
    ...(linkWarning ? { link_warning: linkWarning } : {}),
  })
})
