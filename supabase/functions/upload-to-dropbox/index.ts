// ============================================================================
// upload-to-dropbox — Supabase Edge Function
//
// 2026-05-20 — REBUILT for chunked uploads up to 10GB.
//
// Per user direction: support large file uploads (10GB ceiling — see
// MAX_FINALIZE_BYTES below). The previous single-shot
// `/2/files/upload` path was hard-capped at 150MB (Dropbox's endpoint
// limit) and would have OOMed our edge function on bigger files anyway.
// The new flow uses Dropbox's `upload_session/*` API: the BROWSER
// uploads chunks directly to Dropbox using a short-lived access token,
// so multi-GB files never pass through our edge function.
//
// AUTH MODEL (two-stage, both JWT-verified)
//   1. action='token'    → mint a short-lived Dropbox access token
//                          (4hr expiry) + return to caller. The browser
//                          uses it for the chunked upload directly
//                          against Dropbox's content endpoints.
//   2. action='finalize' → caller passes the session_id + total bytes
//                          + filename + content_type. Edge function
//                          (a) computes the secure member-scoped path
//                          (browser can't tamper), (b) calls Dropbox
//                          upload_session/finish to commit, (c)
//                          creates the share link, (d) inserts the
//                          media_submissions row, (e) returns the row.
//
// Security trade-off: the access token briefly lives in the browser
// (4hr max). Worst case if leaked: the holder can write to our team's
// Dropbox App Folder for the remainder of the token's life. Refresh
// token + app secret stay server-side. App Folder mode scopes writes
// to our sandbox only — they can't touch personal files.
//
// ENV (unchanged)
//   SUPABASE_URL                        (always present)
//   SUPABASE_SERVICE_ROLE_KEY           (always present)
//   SUPABASE_ANON_KEY                   (always present)
//   DROPBOX_APP_KEY                     (from the Dropbox app settings)
//   DROPBOX_APP_SECRET                  (from the Dropbox app settings)
//   DROPBOX_REFRESH_TOKEN               (one-time OAuth grant)
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"

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

// ─── Dropbox OAuth ────────────────────────────────────────────────

interface RefreshedToken {
  access_token: string
  expires_in: number
}

async function dropboxAccessToken(
  appKey: string,
  appSecret: string,
  refreshToken: string,
): Promise<RefreshedToken> {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${appKey}:${appSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Dropbox token refresh failed (${res.status}): ${txt}`)
  }
  return (await res.json()) as RefreshedToken
}

// ─── Dropbox upload-session commit + share link ──────────────────

interface FinishedFile {
  path_lower: string
  id: string
  size: number
}

async function dropboxFinishSession(
  accessToken: string,
  sessionId: string,
  totalBytes: number,
  targetPath: string,
): Promise<FinishedFile> {
  const res = await fetch(
    "https://content.dropboxapi.com/2/files/upload_session/finish",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          cursor: { session_id: sessionId, offset: totalBytes },
          commit: {
            path: targetPath,
            mode: "add",
            autorename: true,
            mute: true,
          },
        }),
      },
      // No body — all data was already appended; finish just commits.
      body: new Uint8Array(0),
    },
  )
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Dropbox session finish failed (${res.status}): ${txt}`)
  }
  return (await res.json()) as FinishedFile
}

async function dropboxGetOrCreateShareLink(
  accessToken: string,
  pathOrId: string,
): Promise<string | null> {
  const createRes = await fetch(
    "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: pathOrId,
        settings: { requested_visibility: "public" },
      }),
    },
  )
  if (createRes.ok) {
    const data = await createRes.json()
    return (data.url as string | undefined) ?? null
  }
  // 409 — link already exists. Fetch it.
  if (createRes.status === 409) {
    const listRes = await fetch(
      "https://api.dropboxapi.com/2/sharing/list_shared_links",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: pathOrId, direct_only: true }),
      },
    )
    if (listRes.ok) {
      const data = await listRes.json()
      const link = data.links?.[0]?.url as string | undefined
      return link ?? null
    }
  }
  return null
}

// ─── Shared: caller authentication ───────────────────────────────

interface CallerContext {
  callerId: string
  displayName: string
  admin: SupabaseClient
}

async function authenticateCaller(req: Request): Promise<
  | { ok: true; ctx: CallerContext }
  | { ok: false; response: Response }
> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return {
      ok: false,
      response: jsonResponse({ ok: false, error: "Edge Function misconfigured (missing env)" }, 500),
    }
  }
  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: jsonResponse({ ok: false, error: "Missing Authorization header" }, 401),
    }
  }
  const caller: SupabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: callerData, error: callerErr } = await caller.auth.getUser()
  if (callerErr || !callerData.user) {
    return {
      ok: false,
      response: jsonResponse({ ok: false, error: "Not authenticated" }, 401),
    }
  }
  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: profile, error: profileErr } = await admin
    .from("team_members")
    .select("id, display_name")
    .eq("id", callerData.user.id)
    .maybeSingle()
  if (profileErr || !profile) {
    return {
      ok: false,
      response: jsonResponse({ ok: false, error: "Team member profile not found" }, 404),
    }
  }
  return {
    ok: true,
    ctx: {
      callerId: callerData.user.id,
      displayName: (profile.display_name ?? "Member").trim(),
      admin,
    },
  }
}

// ─── Action handlers ─────────────────────────────────────────────

/**
 * action='token' — mint a short-lived Dropbox access token + return
 * to the caller. Browser uses it for the chunked upload (start +
 * append_v2 calls) against content.dropboxapi.com directly.
 */
async function handleToken(): Promise<Response> {
  const appKey = Deno.env.get("DROPBOX_APP_KEY")
  const appSecret = Deno.env.get("DROPBOX_APP_SECRET")
  const refreshToken = Deno.env.get("DROPBOX_REFRESH_TOKEN")
  if (!appKey || !appSecret || !refreshToken) {
    return jsonResponse({ ok: false, error: "Dropbox credentials not configured" }, 500)
  }
  try {
    const token = await dropboxAccessToken(appKey, appSecret, refreshToken)
    return jsonResponse({
      ok: true,
      access_token: token.access_token,
      expires_in: token.expires_in,
    })
  } catch (err) {
    return jsonResponse({ ok: false, error: (err as Error).message }, 502)
  }
}

interface FinalizeBody {
  session_id: string
  total_bytes: number
  original_filename: string
  content_type?: string | null
}

// 2026-05-20 — server-side defense-in-depth cap. The client gate in
// `AddMedia.tsx` already prevents files > 10GB from starting an
// upload session, but a malicious caller could skip that and craft a
// finalize request claiming any size. Reject finalize calls above
// this number so the `media_submissions.size_bytes` column stays
// trustworthy.
const MAX_FINALIZE_BYTES = 10 * 1024 * 1024 * 1024

/**
 * action='finalize' — browser has finished appending all chunks to
 * the Dropbox upload session. Edge function commits the session,
 * creates the share link, and inserts the media_submissions row. The
 * Dropbox target path is built HERE (not by the client) so a
 * tampered client can't redirect uploads to another member's folder.
 */
async function handleFinalize(req: Request, ctx: CallerContext): Promise<Response> {
  let body: FinalizeBody
  try {
    body = await req.json() as FinalizeBody
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400)
  }
  if (!body.session_id || !body.original_filename || typeof body.total_bytes !== "number") {
    return jsonResponse({ ok: false, error: "Missing required fields" }, 400)
  }
  if (body.total_bytes <= 0) {
    return jsonResponse({ ok: false, error: "total_bytes must be > 0" }, 400)
  }
  if (body.total_bytes > MAX_FINALIZE_BYTES) {
    return jsonResponse(
      { ok: false, error: `total_bytes ${body.total_bytes} exceeds 10GB cap` },
      413,
    )
  }

  const appKey = Deno.env.get("DROPBOX_APP_KEY")
  const appSecret = Deno.env.get("DROPBOX_APP_SECRET")
  const refreshToken = Deno.env.get("DROPBOX_REFRESH_TOKEN")
  if (!appKey || !appSecret || !refreshToken) {
    return jsonResponse({ ok: false, error: "Dropbox credentials not configured" }, 500)
  }

  // Fresh server-side token for the finish call. We don't trust the
  // token the browser used for chunks — the commit goes through our
  // own credentials.
  let accessToken: string
  try {
    const token = await dropboxAccessToken(appKey, appSecret, refreshToken)
    accessToken = token.access_token
  } catch (err) {
    return jsonResponse({ ok: false, error: (err as Error).message }, 502)
  }

  // Compute the canonical, member-scoped Dropbox path. Browser
  // supplies only the filename — the folder + timestamp prefix are
  // ours.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const slug = ctx.displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const safeOriginal = body.original_filename.replace(/[\/\\]/g, "_")
  const storedFilename = `${stamp}_${slug}_${safeOriginal}`
  const dropboxPath = `/${ctx.displayName}/${storedFilename}`

  // Commit the upload session.
  let finished: FinishedFile
  try {
    finished = await dropboxFinishSession(accessToken, body.session_id, body.total_bytes, dropboxPath)
  } catch (err) {
    return jsonResponse({ ok: false, error: (err as Error).message }, 502)
  }

  // Best-effort share link.
  let shareUrl: string | null = null
  try {
    shareUrl = await dropboxGetOrCreateShareLink(accessToken, finished.path_lower)
  } catch {
    shareUrl = null
  }

  // Insert the metadata row. Column names are `drive_*` for legacy
  // reasons (we used to upload to Google Drive) but they hold the
  // Dropbox values now. Schema is vendor-neutral.
  const { data: row, error: insertErr } = await ctx.admin
    .from("media_submissions")
    .insert({
      member_id: ctx.callerId,
      drive_file_id: finished.id,
      drive_view_url: shareUrl,
      original_filename: body.original_filename,
      stored_filename: storedFilename,
      size_bytes: finished.size,
      content_type: body.content_type ?? null,
    })
    .select()
    .single()

  if (insertErr) {
    return jsonResponse({
      ok: true,
      submission: null,
      warning: `Uploaded to Dropbox, but history insert failed: ${insertErr.message}`,
      dropbox_file_id: finished.id,
      dropbox_view_url: shareUrl,
    })
  }
  return jsonResponse({ ok: true, submission: row })
}

// ─── Main handler ────────────────────────────────────────────────

interface ActionBody {
  action?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405)

  // All actions require an authenticated team member. Mint admin
  // client + look up display name once for use by every handler.
  const auth = await authenticateCaller(req)
  if (!auth.ok) return auth.response

  // For action routing we need to peek at the body. clone() so the
  // finalize handler can re-read it.
  let actionBody: ActionBody
  try {
    actionBody = await req.clone().json() as ActionBody
  } catch {
    return jsonResponse({ ok: false, error: "Body must be JSON with {action: 'token'|'finalize'}" }, 400)
  }

  switch (actionBody.action) {
    case "token":
      return await handleToken()
    case "finalize":
      return await handleFinalize(req, auth.ctx)
    default:
      return jsonResponse(
        { ok: false, error: `Unknown action: ${actionBody.action ?? "(missing)"}` },
        400,
      )
  }
})
