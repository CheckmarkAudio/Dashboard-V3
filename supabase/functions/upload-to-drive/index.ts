// ============================================================================
// upload-to-drive — Supabase Edge Function
//
// Receives a single file from a logged-in team member and uploads it to a
// per-member subfolder under the parent "Checkmark Media" folder in
// Google Drive. Records the upload in `media_submissions` so the member
// (and admins) can browse history.
//
// AUTH MODEL
//   Caller-side: verify_jwt: true. Each upload is on behalf of the
//   logged-in member; their JWT is verified against Supabase auth and
//   we look up their team_members row for display_name + folder cache.
//
//   Drive-side: service account JWT bearer flow. The
//   GOOGLE_SERVICE_ACCOUNT_JSON env var holds the entire service account
//   key file. We sign a short-lived JWT, exchange it for an OAuth access
//   token at https://oauth2.googleapis.com/token, then use that token
//   for Drive API calls. Tokens last 60 min; we mint a fresh one per
//   request (simpler than caching, ~200ms overhead).
//
// REQUEST
//   POST multipart/form-data with one form field "file".
//
// RESPONSE
//   { ok: true, submission: <media_submissions row> } on success
//   { ok: false, error: "..." } on failure
//
// ENV
//   SUPABASE_URL                       (always present)
//   SUPABASE_SERVICE_ROLE_KEY          (always present)
//   SUPABASE_ANON_KEY                  (always present)
//   GOOGLE_SERVICE_ACCOUNT_JSON        (the full JSON key file as a string)
//   GOOGLE_DRIVE_PARENT_FOLDER_ID      (the "Checkmark Media" folder ID)
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// 50MB cap per file. Edge Functions can stream bigger but for V1 we
// cap to keep memory predictable. Bump later if media uploads need it.
const MAX_FILE_BYTES = 50 * 1024 * 1024

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

interface ServiceAccount {
  client_email: string
  private_key: string
  token_uri: string
}

// ─── Google JWT-bearer access token ──────────────────────────────

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "")
  const bin = atob(body)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

async function googleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", typ: "JWT" }
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }
  const encHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const encClaims = base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims)))
  const toSign = `${encHeader}.${encClaims}`

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(toSign))
  const jwt = `${toSign}.${base64UrlEncode(new Uint8Array(sigBuf))}`

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Google token exchange failed (${res.status}): ${txt}`)
  }
  const tokenJson = await res.json()
  if (!tokenJson.access_token) throw new Error("Google token response missing access_token")
  return tokenJson.access_token as string
}

// ─── Drive helpers ───────────────────────────────────────────────

async function findFolder(
  accessToken: string,
  name: string,
  parentId: string,
): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents ` +
      `and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  )
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Drive folder lookup failed (${res.status}): ${txt}`)
  }
  const data = await res.json()
  return data.files?.[0]?.id ?? null
}

async function createFolder(
  accessToken: string,
  name: string,
  parentId: string,
): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Drive folder create failed (${res.status}): ${txt}`)
  }
  const data = await res.json()
  return data.id as string
}

interface DriveUploadResult {
  id: string
  webViewLink: string | null
}

/**
 * Multipart upload (one POST with metadata + body). Suitable for files
 * up to ~5MB cleanly; up to MAX_FILE_BYTES with current Deno runtime.
 * For >50MB use resumable upload — out of scope for V1.
 */
async function uploadFile(
  accessToken: string,
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  parentFolderId: string,
): Promise<DriveUploadResult> {
  const boundary = `boundary_${crypto.randomUUID()}`
  const metadata = JSON.stringify({
    name: filename,
    parents: [parentFolderId],
  })

  const enc = new TextEncoder()
  const head = enc.encode(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  )
  const tail = enc.encode(`\r\n--${boundary}--`)

  const body = new Uint8Array(head.length + bytes.length + tail.length)
  body.set(head, 0)
  body.set(bytes, head.length)
  body.set(tail, head.length + bytes.length)

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  )
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Drive upload failed (${res.status}): ${txt}`)
  }
  const data = await res.json()
  return { id: data.id as string, webViewLink: data.webViewLink ?? null }
}

// ─── Main handler ────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const saJsonRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")
  const parentFolderId = Deno.env.get("GOOGLE_DRIVE_PARENT_FOLDER_ID")
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !saJsonRaw || !parentFolderId) {
    return jsonResponse({ ok: false, error: "Edge Function misconfigured (missing env)" }, 500)
  }

  let serviceAccount: ServiceAccount
  try {
    serviceAccount = JSON.parse(saJsonRaw) as ServiceAccount
    if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.token_uri) {
      throw new Error("Service account JSON missing required fields")
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: `Bad service account JSON: ${(err as Error).message}` }, 500)
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Missing Authorization header" }, 401)
  }

  // Verify caller via their Supabase JWT.
  const caller: SupabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: callerData, error: callerErr } = await caller.auth.getUser()
  if (callerErr || !callerData.user) {
    return jsonResponse({ ok: false, error: "Not authenticated" }, 401)
  }
  const callerId = callerData.user.id

  // Service-role admin client — used to read team_members + write the
  // submission row + cache the per-member folder ID in preferences.
  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profile, error: profileErr } = await admin
    .from("team_members")
    .select("id, display_name, preferences")
    .eq("id", callerId)
    .maybeSingle()
  if (profileErr || !profile) {
    return jsonResponse({ ok: false, error: "Team member profile not found" }, 404)
  }

  const displayName = (profile.display_name ?? "Member").trim()

  // Parse the multipart body.
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

  // Mint a Google access token.
  let accessToken: string
  try {
    accessToken = await googleAccessToken(serviceAccount)
  } catch (err) {
    return jsonResponse({ ok: false, error: (err as Error).message }, 502)
  }

  // Resolve / create the per-member subfolder. Cached in
  // team_members.preferences.drive_folder_id for warm uploads.
  const prefs = (profile.preferences ?? {}) as Record<string, unknown>
  let memberFolderId = typeof prefs.drive_folder_id === "string" ? prefs.drive_folder_id : null

  if (!memberFolderId) {
    try {
      memberFolderId = await findFolder(accessToken, displayName, parentFolderId)
    } catch (err) {
      return jsonResponse({ ok: false, error: (err as Error).message }, 502)
    }
  }
  if (!memberFolderId) {
    try {
      memberFolderId = await createFolder(accessToken, displayName, parentFolderId)
    } catch (err) {
      return jsonResponse({ ok: false, error: (err as Error).message }, 502)
    }
  }

  // Cache the folder ID so subsequent uploads skip the lookup.
  if (prefs.drive_folder_id !== memberFolderId) {
    const nextPrefs = { ...prefs, drive_folder_id: memberFolderId }
    await admin.from("team_members").update({ preferences: nextPrefs }).eq("id", callerId)
  }

  // Filename: ISO timestamp + slugged member + original name. Sortable
  // by date when browsing the folder.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const safeOriginal = file.name.replace(/[\/\\]/g, "_")
  const storedFilename = `${stamp}_${slug}_${safeOriginal}`

  const bytes = new Uint8Array(await file.arrayBuffer())
  let uploadResult: DriveUploadResult
  try {
    uploadResult = await uploadFile(
      accessToken,
      bytes,
      storedFilename,
      file.type || "application/octet-stream",
      memberFolderId,
    )
  } catch (err) {
    return jsonResponse({ ok: false, error: (err as Error).message }, 502)
  }

  // Record the submission. Failure here means the file is in Drive but
  // not in our history table — surface as a warning so the admin sees
  // it; the file is safe.
  const { data: row, error: insertErr } = await admin
    .from("media_submissions")
    .insert({
      member_id: callerId,
      drive_file_id: uploadResult.id,
      drive_view_url: uploadResult.webViewLink,
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
        warning: `Uploaded to Drive, but history insert failed: ${insertErr.message}`,
        drive_file_id: uploadResult.id,
        drive_view_url: uploadResult.webViewLink,
      },
      200,
    )
  }

  return jsonResponse({ ok: true, submission: row })
})
