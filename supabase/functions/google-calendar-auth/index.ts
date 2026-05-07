import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import {
  encryptRefreshToken,
  exchangeCodeForTokens,
  fetchGoogleUserEmail,
} from "../_shared/googleCalendar.ts"

// NOTE:
// This function intentionally handles two different trust models:
// 1. GET callback requests from Google, which do not carry the app user's
//    Supabase Authorization header. Those requests are validated by the
//    one-time `state` row we stored during the POST `start` action.
// 2. POST admin actions from the app (`start`, `status`, `disconnect`), which
//    must include a logged-in Supabase JWT and are re-checked against the
//    caller's team_members role before doing anything sensitive.
//
// For the callback path to work in production, this function must be deployed
// with JWT verification disabled at the platform edge. We enforce that in
// `supabase/config.toml` and still verify POST caller auth manually below.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

function redirectResponse(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  })
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

function callbackUrl(supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/google-calendar-auth`
}

function appendRedirectParam(url: string, key: string, value: string): string {
  const next = new URL(url)
  next.searchParams.set(key, value)
  return next.toString()
}

async function getPostCallerContext(req: Request) {
  const supabaseUrl = requireEnv("SUPABASE_URL")
  const anonKey = requireEnv("SUPABASE_ANON_KEY")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    return { error: jsonResponse({ ok: false, error: "Missing Authorization header" }, 401) }
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData.user) {
    return { error: jsonResponse({ ok: false, error: "Not authenticated" }, 401) }
  }

  const { data: profile, error: profileErr } = await caller
    .from("team_members")
    .select("id, role, team_id")
    .eq("id", userData.user.id)
    .maybeSingle()

  if (profileErr || !profile?.team_id) {
    return { error: jsonResponse({ ok: false, error: "Caller profile not found" }, 403) }
  }

  return {
    supabaseUrl,
    caller,
    admin,
    userId: userData.user.id,
    role: profile.role,
    teamId: profile.team_id as string,
  }
}

type CallbackEnv = {
  supabaseUrl: string
  googleClientId: string
  googleClientSecret: string
  encryptionSecret: string
}

async function handleGoogleOauthCallback(req: Request, env: CallbackEnv): Promise<Response> {
  const url = new URL(req.url)
  const state = url.searchParams.get("state") ?? ""
  const code = url.searchParams.get("code") ?? ""
  const oauthError = url.searchParams.get("error") ?? ""

  const admin = createClient(env.supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: stateRow } = await admin
    .from("google_oauth_states")
    .select("state, team_id, created_by, redirect_to, expires_at")
    .eq("state", state)
    .maybeSingle()

  if (!stateRow?.redirect_to) {
    return jsonResponse({ ok: false, error: "OAuth state expired or invalid" }, 400)
  }
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    await admin.from("google_oauth_states").delete().eq("state", state)
    return redirectResponse(
      appendRedirectParam(stateRow.redirect_to, "google_calendar_error", "expired_state"),
    )
  }

  if (oauthError) {
    await admin.from("google_oauth_states").delete().eq("state", state)
    return redirectResponse(
      appendRedirectParam(stateRow.redirect_to, "google_calendar_error", oauthError),
    )
  }

  if (!code) {
    await admin.from("google_oauth_states").delete().eq("state", state)
    return redirectResponse(
      appendRedirectParam(stateRow.redirect_to, "google_calendar_error", "missing_code"),
    )
  }

  const tokenData = await exchangeCodeForTokens({
    code,
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    redirectUri: callbackUrl(env.supabaseUrl),
  })

  const refreshToken = tokenData.refresh_token
  if (!refreshToken) {
    await admin.from("google_oauth_states").delete().eq("state", state)
    return redirectResponse(
      appendRedirectParam(
        stateRow.redirect_to,
        "google_calendar_error",
        "missing_refresh_token",
      ),
    )
  }

  const encrypted = await encryptRefreshToken(refreshToken, env.encryptionSecret)
  const googleEmail = await fetchGoogleUserEmail(tokenData.access_token).catch(() => null)

  const { error: upsertErr } = await admin
    .from("google_calendar_connections")
    .upsert({
      team_id: stateRow.team_id,
      google_email: googleEmail ?? "checkmarkaudio@gmail.com",
      calendar_id: "primary",
      encrypted_refresh_token: encrypted.ciphertext,
      refresh_token_iv: encrypted.iv,
      token_scope: (tokenData.scope ?? "").split(" ").filter(Boolean),
      token_type: tokenData.token_type ?? "Bearer",
      connected_by: stateRow.created_by,
      updated_at: new Date().toISOString(),
      last_sync_error: null,
    }, { onConflict: "team_id" })

  await admin.from("google_oauth_states").delete().eq("state", state)

  if (upsertErr) {
    return redirectResponse(
      appendRedirectParam(
        stateRow.redirect_to,
        "google_calendar_error",
        "connection_save_failed",
      ),
    )
  }

  return redirectResponse(
    appendRedirectParam(stateRow.redirect_to, "google_calendar", "connected"),
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL")
    const googleClientId = requireEnv("GOOGLE_CLIENT_ID")
    const googleClientSecret = requireEnv("GOOGLE_CLIENT_SECRET")
    const encryptionSecret = requireEnv("GOOGLE_TOKEN_ENCRYPTION_KEY")

    if (req.method === "GET") {
      return await handleGoogleOauthCallback(req, {
        supabaseUrl,
        googleClientId,
        googleClientSecret,
        encryptionSecret,
      })
    }

    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, 405)
    }

    const ctx = await getPostCallerContext(req)
    if ("error" in ctx) return ctx.error

    let body: { action?: string; redirect_to?: string } = {}
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400)
    }

    if (body.action === "status") {
      const { data, error } = await ctx.admin
        .from("google_calendar_connections")
        .select("google_email, calendar_id, created_at, updated_at, last_sync_error")
        .eq("team_id", ctx.teamId)
        .maybeSingle()

      if (error) return jsonResponse({ ok: false, error: error.message }, 500)

      return jsonResponse({
        ok: true,
        connected: Boolean(data),
        connection: data ?? null,
      })
    }

    if (body.action === "disconnect") {
      if (ctx.role !== "admin") {
        return jsonResponse({ ok: false, error: "Only admins can disconnect Google Calendar" }, 403)
      }

      const { error } = await ctx.admin
        .from("google_calendar_connections")
        .delete()
        .eq("team_id", ctx.teamId)

      if (error) return jsonResponse({ ok: false, error: error.message }, 500)
      return jsonResponse({ ok: true })
    }

    if (body.action !== "start") {
      return jsonResponse({ ok: false, error: "Unknown action" }, 400)
    }

    if (ctx.role !== "admin") {
      return jsonResponse({ ok: false, error: "Only admins can connect Google Calendar" }, 403)
    }

    const origin = req.headers.get("Origin") ?? ""
    const requestedRedirect = body.redirect_to?.trim()
    const fallbackRedirect = origin ? `${origin}/admin/settings` : ""
    const redirectTo = requestedRedirect || fallbackRedirect

    if (!redirectTo) {
      return jsonResponse({ ok: false, error: "Missing redirect target" }, 400)
    }

    if (origin) {
      const redirectOrigin = new URL(redirectTo).origin
      if (redirectOrigin !== origin) {
        return jsonResponse({ ok: false, error: "Redirect origin mismatch" }, 400)
      }
    }

    const state = crypto.randomUUID()
    const { error: stateErr } = await ctx.admin
      .from("google_oauth_states")
      .insert({
        state,
        team_id: ctx.teamId,
        created_by: ctx.userId,
        redirect_to: redirectTo,
      })

    if (stateErr) {
      return jsonResponse({ ok: false, error: stateErr.message }, 500)
    }

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", googleClientId)
    authUrl.searchParams.set("redirect_uri", callbackUrl(supabaseUrl))
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set(
      "scope",
      [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
    )
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("include_granted_scopes", "true")
    authUrl.searchParams.set("prompt", "consent")
    authUrl.searchParams.set("state", state)

    return jsonResponse({ ok: true, auth_url: authUrl.toString() })
  } catch (error) {
    console.error("[google-calendar-auth]", error)
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    )
  }
})
