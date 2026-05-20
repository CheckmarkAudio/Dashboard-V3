// ============================================================================
// upload-to-dropbox — Supabase Edge Function
//
// Receives a single file from a logged-in team member and uploads it to a
// per-member subfolder inside the Dropbox App folder. Records the upload
// in `media_submissions` so the member (and admins) can browse history.
//
// Why Dropbox instead of Google Drive: Google deprecated service-account
// uploads to personal Drive accounts in late 2024 ("Service Accounts do
// not have storage quota"). The two replacements (Shared Drives, OAuth
// domain-wide delegation) both require Google Workspace, which the user
// doesn't have. Dropbox has none of this restriction.
//
// AUTH MODEL
//   Caller-side: verify_jwt: true. Each upload is on behalf of the
//   logged-in member; their JWT is verified against Supabase auth.
//
//   Dropbox-side: OAuth refresh-token flow. We hold the App Key + Secret
//   + Refresh Token in Supabase secrets. On each request we POST the
//   refresh token to the Dropbox token endpoint to get a short-lived
//   access token (4 hours), then use that token for upload + share-link
//   creation. Refresh tokens don't expire unless the owner revokes the
//   app, so this Just Works forever after setup.
//
// ENV
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

// 2026-05-20 — bumped 50MB → 150MB to match Dropbox's single-shot
// `/2/files/upload` endpoint hard limit. Going higher would require
// implementing the chunked `upload_session/start|append|finish`
// pattern (separate work). At 150MB the edge function buffers the
// whole file in memory (~256MB Deno Deploy budget — comfortably
// fits) and the browser holds the file in FormData during transit.
// Files never touch the repo or Vercel; only metadata lands in
// `media_submissions` after upload.
const MAX_FILE_BYTES = 150 * 1024 * 1024

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

// ─── Dropbox OAuth + helpers ────────────────────────────────────

interface RefreshedToken {
  access_token: string
  expires_in: number
}

async function dropboxAccessToken(
  appKey: string,
  appSecret: string,
  refreshToken: string,
): Promise<string> {
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
  const data = (await res.json()) as RefreshedToken
  return data.access_token
}

interface UploadResult {
  path_lower: string
  id: string
  size: number
}

async function dropboxUpload(
  accessToken: string,
  path: string,
  bytes: Uint8Array,
): Promise<UploadResult> {
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path,
        mode: "add",
        autorename: true, // never collide if two uploads pick the same name
        mute: true,
      }),
    },
    body: bytes,
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Dropbox upload failed (${res.status}): ${txt}`)
  }
  return (await res.json()) as UploadResult
}

/**
 * Get a public-ish view link for the uploaded file. Dropbox requires
 * either creating a shared link (returns the URL) or fetching the
 * existing one if it already exists. We try create first; on 409
 * "shared_link_already_exists" we fetch the existing one.
 */
async function dropboxGetOrCreateShareLink(
  accessToken: string,
  pathOrId: string,
): Promise<string | null> {
  // Try create.
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
        settings: {
          requested_visibility: "public",
        },
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

  // Anything else — best-effort, return null. Upload itself succeeded.
  return null
}

// ─── Main handler ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const appKey = Deno.env.get("DROPBOX_APP_KEY")
  const appSecret = Deno.env.get("DROPBOX_APP_SECRET")
  const refreshToken = Deno.env.get("DROPBOX_REFRESH_TOKEN")
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !appKey || !appSecret || !refreshToken) {
    return jsonResponse({ ok: false, error: "Edge Function misconfigured (missing env)" }, 500)
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Missing Authorization header" }, 401)
  }

  const caller: SupabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: callerData, error: callerErr } = await caller.auth.getUser()
  if (callerErr || !callerData.user) {
    return jsonResponse({ ok: false, error: "Not authenticated" }, 401)
  }
  const callerId = callerData.user.id

  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profile, error: profileErr } = await admin
    .from("team_members")
    .select("id, display_name")
    .eq("id", callerId)
    .maybeSingle()
  if (profileErr || !profile) {
    return jsonResponse({ ok: false, error: "Team member profile not found" }, 404)
  }
  const displayName = (profile.display_name ?? "Member").trim()

  // Parse multipart body.
  let form: FormData
  try {
    form = await req.formData()
  } catch (err) {
    return jsonResponse({ ok: false, error: `Could not read upload: ${(err as Error).message}` }, 400)
  }
  const file = form.get("file")
  if (!(file instanceof File)) {
    return jsonResponse({ ok: false, error: "No file in upload" }, 400)
  }
  if (file.size === 0) {
    return jsonResponse({ ok: false, error: "File is empty" }, 400)
  }
  if (file.size > MAX_FILE_BYTES) {
    return jsonResponse(
      { ok: false, error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Cap is ${MAX_FILE_BYTES / 1024 / 1024}MB.` },
      413,
    )
  }

  // Mint a Dropbox access token.
  let accessToken: string
  try {
    accessToken = await dropboxAccessToken(appKey, appSecret, refreshToken)
  } catch (err) {
    return jsonResponse({ ok: false, error: (err as Error).message }, 502)
  }

  // Build the Dropbox path. App-folder mode means everything is rooted
  // at the app's sandbox folder automatically; we just give a path
  // relative to that root. Per-member subfolder + timestamped filename.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const safeOriginal = file.name.replace(/[\/\\]/g, "_")
  const storedFilename = `${stamp}_${slug}_${safeOriginal}`
  const dropboxPath = `/${displayName}/${storedFilename}`

  // Upload.
  const bytes = new Uint8Array(await file.arrayBuffer())
  let uploadResult: UploadResult
  try {
    uploadResult = await dropboxUpload(accessToken, dropboxPath, bytes)
  } catch (err) {
    return jsonResponse({ ok: false, error: (err as Error).message }, 502)
  }

  // Best-effort share link. Failures here don't block — the file is
  // already uploaded; we just won't have a click-through link in the
  // history table.
  let shareUrl: string | null = null
  try {
    shareUrl = await dropboxGetOrCreateShareLink(accessToken, uploadResult.path_lower)
  } catch (_) {
    shareUrl = null
  }

  // Record the submission. Same `media_submissions` table the Drive
  // flow used — `drive_file_id` column reused for the Dropbox file ID,
  // `drive_view_url` reused for the share URL. The schema is vendor-
  // neutral despite the column names; renaming the columns is a
  // separate cleanup task.
  const { data: row, error: insertErr } = await admin
    .from("media_submissions")
    .insert({
      member_id: callerId,
      drive_file_id: uploadResult.id,
      drive_view_url: shareUrl,
      original_filename: file.name,
      stored_filename: storedFilename,
      size_bytes: file.size,
      content_type: file.type || null,
    })
    .select()
    .single()

  if (insertErr) {
    return jsonResponse(
      {
        ok: true,
        submission: null,
        warning: `Uploaded to Dropbox, but history insert failed: ${insertErr.message}`,
        dropbox_file_id: uploadResult.id,
        dropbox_view_url: shareUrl,
      },
      200,
    )
  }

  return jsonResponse({ ok: true, submission: row })
})
