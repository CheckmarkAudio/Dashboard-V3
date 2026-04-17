// ============================================================================
// admin-reset-password — Supabase Edge Function
//
// Owner-only password reset for any non-owner team member. Replaces the
// earlier raw-SQL `owner_reset_member_password` RPC so every password
// write goes through Supabase's sanctioned auth admin API — keeps
// GoTrue's internal bookkeeping consistent and eliminates the
// "updateUser hangs forever" bug we hit when passwords were injected
// via direct SQL.
//
// ACCESS CONTROL
//   - verify_jwt: true — the caller's JWT is required.
//   - The function checks the JWT's `email` claim against the hardcoded
//     primary owner (checkmarkaudio@gmail.com). Any other caller gets
//     rejected with 403 even if their JWT is otherwise valid.
//   - The function refuses to reset the owner's own password through
//     this path.
//
// REQUEST BODY
//   {
//     "user_id": "<uuid>",
//     "new_password": "<at least 8 chars>"
//   }
//
// RESPONSE
//   { ok: true,  email: "<target's email>" }     // success
//   { ok: false, error: "<reason>" }              // failure (any status)
//
// The client also gets the `requires_password_change` flag re-armed in
// the target user's user_metadata, so on their next sign-in the
// ForcePasswordChangeModal prompts them to set their own password.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const OWNER_EMAIL = "checkmarkaudio@gmail.com"

interface ResetPasswordBody {
  user_id: string
  new_password: string
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

  let body: ResetPasswordBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400)
  }

  const userId = (body.user_id ?? "").trim()
  const newPassword = body.new_password ?? ""
  if (!userId) return jsonResponse({ ok: false, error: "user_id is required" }, 400)
  if (newPassword.length < 8) {
    return jsonResponse({ ok: false, error: "Password must be at least 8 characters" }, 400)
  }

  // Caller client — hits Supabase as the requesting user (via their JWT).
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: callerUser, error: callerUserErr } = await caller.auth.getUser()
  if (callerUserErr || !callerUser.user) {
    return jsonResponse({ ok: false, error: "Not authenticated" }, 401)
  }

  // Owner-only guard. Matches the OWNER_EMAIL constant pinned in
  // src/domain/permissions/index.ts. This is the security boundary.
  const callerEmail = normalizeEmail(callerUser.user.email)
  if (callerEmail !== OWNER_EMAIL) {
    return jsonResponse(
      { ok: false, error: `Only the primary owner (${OWNER_EMAIL}) can reset passwords.` },
      403,
    )
  }

  // Admin client — service role, bypasses RLS, can touch auth.users
  // via Supabase's sanctioned admin API. NEVER leaves this function.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Look up the target so we can (a) prevent resetting the owner's own
  // password through this path, and (b) return the target email in the
  // response for the UI to display.
  const { data: targetLookup, error: targetErr } = await admin.auth.admin.getUserById(userId)
  if (targetErr || !targetLookup.user) {
    return jsonResponse({ ok: false, error: "Target user not found" }, 404)
  }
  const targetEmail = normalizeEmail(targetLookup.user.email)
  if (targetEmail === OWNER_EMAIL) {
    return jsonResponse(
      { ok: false, error: "Use the standard password recovery flow to reset the owner account." },
      400,
    )
  }

  // Update the password AND re-arm the force-change flag in one admin
  // call. Preserves every other field of user_metadata so we don't
  // stomp on display_name, created_by_admin, etc.
  const mergedMetadata = {
    ...(targetLookup.user.user_metadata ?? {}),
    requires_password_change: true,
  }
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
    user_metadata: mergedMetadata,
  })
  if (updateErr) {
    return jsonResponse({ ok: false, error: updateErr.message }, 400)
  }

  return jsonResponse({ ok: true, email: targetEmail })
})
