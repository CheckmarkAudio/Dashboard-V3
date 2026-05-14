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

  // Look up the auth.users row, if one exists. Some `team_members`
  // rows are profile-only — the member was added but never onboarded
  // with a login. For those we skip the auth.users update and only
  // mirror the new email into `team_members` so the typo can still
  // be corrected.
  const { data: targetLookup } = await admin.auth.admin.getUserById(userId)
  const targetAuthUser = targetLookup?.user ?? null
  const currentAuthEmail = normalizeEmail(targetAuthUser?.email ?? "")

  if (currentAuthEmail === OWNER_EMAIL) {
    return jsonResponse(
      { ok: false, error: "The primary owner email is locked." },
      400,
    )
  }

  // If there's no auth.users row, validate the team_members row
  // exists. Without this check, `user_id` could be anything and the
  // update below would silently write zero rows.
  let profileOnlyMode = false
  let currentProfileEmail = ""
  if (!targetAuthUser) {
    const { data: profileLookup, error: profileLookupErr } = await admin
      .from("team_members")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle()
    if (profileLookupErr || !profileLookup) {
      return jsonResponse({ ok: false, error: "Member not found" }, 404)
    }
    profileOnlyMode = true
    currentProfileEmail = normalizeEmail(profileLookup.email ?? "")
    // No-op short circuit.
    if (currentProfileEmail === newEmail) {
      return jsonResponse({ ok: true, email: newEmail })
    }
  } else if (currentAuthEmail === newEmail) {
    // No-op short circuit for the auth-user path.
    return jsonResponse({ ok: true, email: currentAuthEmail })
  }

  // Reject duplicates up front for a clearer error message than
  // GoTrue's generic "duplicate key" surface. Two paths because
  // different GoTrue admin APIs are unreliable on different stacks
  // (`listUsers` was returning "Database error finding users" on
  // this project — known issue with paginated auth admin reads on
  // some Postgres versions). We use a direct SQL probe against
  // `auth.users` via the service-role schema chain instead. If that
  // probe ever fails we soft-fall-through and let the actual
  // `updateUserById` call below surface the conflict — better to
  // attempt the write than to block on a flaky pre-check.
  try {
    const { data: dupAuth } = await admin
      .schema("auth")
      .from("users")
      .select("id")
      .eq("email", newEmail)
      .neq("id", userId)
      .maybeSingle()
    if (dupAuth) {
      return jsonResponse(
        { ok: false, error: "Another account already uses that email." },
        409,
      )
    }
  } catch (_) {
    // Probe failed — proceed and trust the GoTrue update to catch any
    // real conflict.
  }

  // Same probe against team_members so a typo onto another member's
  // profile mirror is also blocked.
  const { data: dupProfile } = await admin
    .from("team_members")
    .select("id")
    .eq("email", newEmail)
    .neq("id", userId)
    .maybeSingle()
  if (dupProfile) {
    return jsonResponse(
      { ok: false, error: "Another team member already uses that email." },
      409,
    )
  }

  // Update auth.users only when the member actually has a login.
  // `email_confirm: true` so GoTrue treats the new address as
  // verified — admins are correcting typos, not asking the member
  // to re-confirm.
  if (!profileOnlyMode) {
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    })
    if (updateErr) {
      return jsonResponse({ ok: false, error: updateErr.message }, 400)
    }
  }

  // Always mirror the change into team_members. For profile-only
  // members this IS the canonical write.
  const { error: profileErr } = await admin
    .from("team_members")
    .update({ email: newEmail })
    .eq("id", userId)
  if (profileErr) {
    if (profileOnlyMode) {
      // Nothing landed — surface the error as a hard failure.
      return jsonResponse({ ok: false, error: profileErr.message }, 400)
    }
    // Auth already landed — partial success so the admin sees the warning.
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
