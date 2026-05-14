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
const DEFAULT_REDIRECT_TO = "https://dashboard-v3-dusky.vercel.app/login"

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

    let targetEmail = requestedEmail
    let targetUserId = userId
    if (userId) {
      const { data: targetAuth, error: targetAuthErr } = await admin.auth.admin.getUserById(userId)
      if (targetAuthErr || !targetAuth.user) {
        return jsonResponse({ ok: false, error: "Target user not found" }, 404)
      }
      targetEmail = normalizeEmail(targetAuth.user.email)
    }

    if (!targetEmail) return jsonResponse({ ok: false, error: "Target email not found" }, 404)
    if (targetEmail === OWNER_EMAIL) {
      return jsonResponse(
        { ok: false, error: "Use the standard password recovery flow to reset the owner account." },
        400,
      )
    }

    const { data: targetProfile, error: targetProfileErr } = await admin
      .from("team_members")
      .select("id, team_id, email")
      .eq(userId ? "id" : "email", userId || targetEmail)
      .maybeSingle()
    if (targetProfileErr || !targetProfile) {
      return jsonResponse({ ok: false, error: "Target profile not found" }, 404)
    }
    if (targetProfile.team_id !== callerProfile.team_id) {
      return jsonResponse({ ok: false, error: "Target member is outside your team" }, 403)
    }
    targetUserId = targetProfile.id

    const { data: targetAuth, error: targetAuthErr } = await admin.auth.admin.getUserById(targetUserId)
    if (targetAuthErr || !targetAuth.user) {
      return jsonResponse({ ok: false, error: "Target auth user not found" }, 404)
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
