// ============================================================================
// admin-update-email — Supabase Edge Function
//
// Owner-only email correction for any non-owner team member. Updates BOTH
// auth.users.email (the login identity) AND team_members.email (the
// profile row that the rest of the app reads). Mirrors the access-control
// shape of `admin-reset-password`.
//
// Why this exists: the Add Member form previously locked the email field
// after creation ("Email is immutable after a member is created"), so a
// typo in the original entry could only be fixed by deleting + recreating
// the account. User asked for an in-place edit.
//
// ACCESS CONTROL
//   - verify_jwt: true — caller's JWT is required.
//   - The function checks the JWT's `email` claim against the hardcoded
//     primary owner. Any other caller gets 403.
//   - The function refuses to change the owner's own email through this
//     path (use the standard Supabase auth flow for that — there's no
//     non-owner with permission to change the owner anyway).
//
// REQUEST BODY
//   {
//     "user_id":   "<uuid>",
//     "new_email": "<a valid email>"
//   }
//
// RESPONSE
//   { ok: true,  email: "<normalized new email>" }
//   { ok: false, error: "<reason>" }
//
// IMPLEMENTATION NOTES
//   - `email_confirm: true` so the new address is treated as already
//     verified — admins are correcting typos, not asking the member to
//     re-verify a brand new mailbox.
//   - team_members.email is mirrored in the same call so the profile row
//     stays in sync. If the auth.users update succeeds but the
//     team_members update fails, we return the error so the admin sees a
//     warning — but the auth.users change has already landed (it's the
//     source of truth for login).
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const OWNER_EMAIL = "checkmarkaudio@gmail.com"

interface UpdateEmailBody {
  user_id: string
  new_email: string
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

// Loose RFC-5322ish check — Supabase will reject anything truly malformed
// during the admin update call, but rejecting obvious nonsense up front
// gives a better error message than "invalid email format" from GoTrue.
function looksLikeEmail(raw: string): boolean {
  if (!raw) return false
  if (raw.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
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

  let body: UpdateEmailBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400)
  }

  const userId = (body.user_id ?? "").trim()
  const newEmail = normalizeEmail(body.new_email)
  if (!userId) return jsonResponse({ ok: false, error: "user_id is required" }, 400)
  if (!looksLikeEmail(newEmail)) {
    return jsonResponse({ ok: false, error: "Please enter a valid email address." }, 400)
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

  // Owner-only guard.
  const callerEmail = normalizeEmail(callerUser.user.email)
  if (callerEmail !== OWNER_EMAIL) {
    return jsonResponse(
      { ok: false, error: `Only the primary owner (${OWNER_EMAIL}) can change emails.` },
      403,
    )
  }

  // Admin client — service role, bypasses RLS, can touch auth.users.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Look up the target so we can (a) prevent changing the owner's own
  // email through this path, and (b) detect a no-op (current === new).
  const { data: targetLookup, error: targetErr } = await admin.auth.admin.getUserById(userId)
  if (targetErr || !targetLookup.user) {
    return jsonResponse({ ok: false, error: "Target user not found" }, 404)
  }
  const currentEmail = normalizeEmail(targetLookup.user.email)
  if (currentEmail === OWNER_EMAIL) {
    return jsonResponse(
      { ok: false, error: "The primary owner email is locked." },
      400,
    )
  }
  if (currentEmail === newEmail) {
    // No-op — return success so the UI clears its edit state cleanly.
    return jsonResponse({ ok: true, email: currentEmail })
  }

  // Reject duplicates against any other auth user. GoTrue will also
  // refuse the underlying update, but checking up front gives a clearer
  // error message than the generic "duplicate key" surface.
  //
  // Pagination: listUsers returns at most 1000 users per page in the
  // current SDK. Loop in case a workspace ever grows past that. We bail
  // out as soon as we find a conflict, so the typical case scans only
  // the first page.
  let page = 1
  let conflict = false
  while (true) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (listErr) {
      return jsonResponse({ ok: false, error: `Failed to validate uniqueness: ${listErr.message}` }, 500)
    }
    for (const u of list.users) {
      if (u.id === userId) continue
      if (normalizeEmail(u.email) === newEmail) {
        conflict = true
        break
      }
    }
    if (conflict) break
    if (list.users.length < 200) break
    page += 1
  }
  if (conflict) {
    return jsonResponse(
      { ok: false, error: "Another account already uses that email." },
      409,
    )
  }

  // Update the auth user. `email_confirm: true` so GoTrue treats the new
  // address as verified — admins are correcting typos, not asking the
  // member to re-confirm.
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true,
  })
  if (updateErr) {
    return jsonResponse({ ok: false, error: updateErr.message }, 400)
  }

  // Mirror the change into team_members so the rest of the app
  // (Members page, Account Access, mailto: links) sees it.
  const { error: profileErr } = await admin
    .from("team_members")
    .update({ email: newEmail })
    .eq("id", userId)
  if (profileErr) {
    // The auth update already landed — return a partial success so the
    // admin sees the warning and can re-sync manually if needed.
    return jsonResponse(
      {
        ok: true,
        email: newEmail,
        warning: `Login email updated, but profile mirror failed: ${profileErr.message}`,
      },
      200,
    )
  }

  return jsonResponse({ ok: true, email: newEmail })
})
