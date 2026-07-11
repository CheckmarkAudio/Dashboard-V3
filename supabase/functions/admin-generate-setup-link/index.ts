// ============================================================================
// admin-generate-setup-link — Supabase Edge Function
//
// Admin-only helper for onboarding / password recovery when SMTP delivery is
// unreliable. It creates a Supabase recovery link with the service-role Admin
// API and returns the link to the signed-in admin so they can send it directly
// to the employee.
//
// This does NOT send email. It gives the owner/admin a usable link immediately.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

interface SetupLinkBody {
  user_id?: string
  email?: string
  redirect_to?: string
}

const OWNER_EMAIL = "checkmarkaudio@gmail.com"
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

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

function generateRandomPassword(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZ" +
    "abcdefghjkmnpqrstuvwxyz" +
    "23456789" +
    "!@#$%^&*-_=+"
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<string> {
  try {
    const { data: existingAuth } = await admin
      .schema("auth")
      .from("users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle()
    if (existingAuth?.id) return existingAuth.id
  } catch (_) {
    // Some Supabase projects do not expose the auth schema through
    // PostgREST. Fall back to the Auth Admin API below.
  }

  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) break
      const match = data.users.find((user) => normalizeEmail(user.email) === email)
      if (match?.id) return match.id
      if (data.users.length < 1000) break
    }
  } catch (_) {
    // createUser below will still return a clear duplicate-email error
    // if lookup fails but the auth user already exists.
  }

  return ""
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405)
  }

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL")
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    const anonKey = requireEnv("SUPABASE_ANON_KEY")
    const authHeader = req.headers.get("Authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ ok: false, error: "Missing Authorization header" }, 401)
    }

    let body: SetupLinkBody
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400)
    }

    const userId = (body.user_id ?? "").trim()
    const requestedEmail = normalizeEmail(body.email)
    // The request URL belongs to the Supabase function host, not the app.
    // Prefer the client-provided app origin and fall back to production.
    const redirectTo = body.redirect_to?.trim() || DEFAULT_REDIRECT_TO
    if (!userId && !requestedEmail) {
      return jsonResponse({ ok: false, error: "user_id or email is required" }, 400)
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
    if (callerProfileErr || !callerProfile?.team_id) {
      return jsonResponse({ ok: false, error: "Caller profile not found" }, 403)
    }
    if (callerProfile.role !== "admin") {
      return jsonResponse({ ok: false, error: "Only team admins can generate setup links" }, 403)
    }

    const profileLookupColumn = userId ? "id" : "email"
    const profileLookupValue = userId || requestedEmail
    const { data: targetProfile, error: targetProfileErr } = await admin
      .from("team_members")
      .select("id, team_id, email, display_name")
      .eq(profileLookupColumn, profileLookupValue)
      .maybeSingle()
    if (targetProfileErr || !targetProfile) {
      return jsonResponse({ ok: false, error: "Target profile not found" }, 404)
    }
    if (targetProfile.team_id !== callerProfile.team_id) {
      return jsonResponse({ ok: false, error: "Target member is outside your team" }, 403)
    }

    let targetEmail = normalizeEmail(targetProfile.email ?? requestedEmail)
    let targetUserId = targetProfile.id
    if (!targetEmail) return jsonResponse({ ok: false, error: "Target email not found" }, 404)
    if (targetEmail === OWNER_EMAIL) {
      return jsonResponse(
        { ok: false, error: "Use the standard password recovery flow to reset the owner account." },
        400,
      )
    }

    let { data: targetAuth } = await admin.auth.admin.getUserById(targetUserId)
    if (!targetAuth?.user) {
      const authUserIdForEmail = await findAuthUserIdByEmail(admin, targetEmail)

      let createdAuthUserId = ""
      if (authUserIdForEmail) {
        targetUserId = authUserIdForEmail
      } else {
        const { data: createdAuth, error: createErr } = await admin.auth.admin.createUser({
          email: targetEmail,
          password: generateRandomPassword(),
          email_confirm: true,
          user_metadata: {
            display_name: targetProfile.display_name ?? "",
            created_by_admin: callerUser.user.id,
            requires_password_change: true,
          },
        })
        if (createErr || !createdAuth.user) {
          const message = createErr?.message ?? "Failed to create auth user for member"
          return jsonResponse(
            {
              ok: false,
              error: message.includes("already")
                ? "An Auth user already exists for this email, but the member profile could not be linked automatically. Try again in a moment or ask Codex to relink the profile."
                : message,
            },
            400,
          )
        }
        targetUserId = createdAuth.user.id
        createdAuthUserId = createdAuth.user.id
      }

      if (targetUserId !== targetProfile.id) {
        const { error: relinkErr } = await admin
          .from("team_members")
          .update({ id: targetUserId, email: targetEmail })
          .eq("id", targetProfile.id)
        if (relinkErr) {
          if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId)
          return jsonResponse(
            { ok: false, error: `Created login, but could not link member profile: ${relinkErr.message}` },
            400,
          )
        }
      }

      const refreshed = await admin.auth.admin.getUserById(targetUserId)
      targetAuth = refreshed.data
      if (!targetAuth?.user) {
        return jsonResponse({ ok: false, error: "Target auth user not found after provisioning" }, 404)
      }
      targetEmail = normalizeEmail(targetAuth.user.email)
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: targetEmail,
      options: { redirectTo },
    })
    if (linkErr) {
      return jsonResponse({ ok: false, error: linkErr.message }, 400)
    }

    await admin.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        ...(targetAuth.user.user_metadata ?? {}),
        requires_password_change: true,
      },
    })

    const properties = linkData.properties as { action_link?: string } | undefined
    const setupLink = properties?.action_link
    if (!setupLink) {
      return jsonResponse({ ok: false, error: "Supabase did not return a setup link" }, 500)
    }

    return jsonResponse({
      ok: true,
      email: targetEmail,
      setup_link: setupLink,
    })
  } catch (error) {
    console.error("[admin-generate-setup-link]", error)
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    )
  }
})
