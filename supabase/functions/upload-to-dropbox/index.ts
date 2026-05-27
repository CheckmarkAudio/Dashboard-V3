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
import { encodeBase64 } from "jsr:@std/encoding/base64"

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

// 2026-05-26 — In-memory token cache.
//
// Each Supabase edge isolate that handles requests holds the
// short-lived (4 hr) Dropbox access token for reuse across requests.
// Before this, every action (token / finalize / finalize-forum /
// thumbnail) minted a fresh OAuth-refresh round-trip — adding
// ~300–600 ms per call. On the Media page that's 18 hits per page
// open; on a warm isolate, all 18 now skip the mint entirely.
//
// Scope: process-local. Edge isolates spin up + down independently;
// each holds its own cache. That's fine — the cache is purely a
// latency optimization. Worst case (cold start, or isolate recycled):
// the next request mints a fresh token, exactly like the old code.
//
// In-flight dedupe: when the cache is empty and N concurrent
// requests race for a token, only the first one actually mints;
// the rest await the same promise. Without this, a cold-start page
// load would still trigger N simultaneous mints.
//
// Safety margin: refresh 60 s before nominal expiry so a token can't
// expire mid-request.

let cachedToken: { access_token: string; expires_at_ms: number } | null = null
let inFlightRefresh: Promise<{ access_token: string; expires_at_ms: number }> | null = null
const TOKEN_SAFETY_MARGIN_MS = 60_000

async function getCachedDropboxAccessToken(): Promise<RefreshedToken> {
  const now = Date.now()

  // Cache hit + still fresh → return immediately.
  if (cachedToken && cachedToken.expires_at_ms - now > TOKEN_SAFETY_MARGIN_MS) {
    return {
      access_token: cachedToken.access_token,
      expires_in: Math.floor((cachedToken.expires_at_ms - now) / 1000),
    }
  }

  // A refresh is already in flight (someone else hit the cold cache
  // a few ms ago). Piggyback on its result instead of triggering a
  // duplicate OAuth round-trip.
  if (inFlightRefresh) {
    const tok = await inFlightRefresh
    return {
      access_token: tok.access_token,
      expires_in: Math.floor((tok.expires_at_ms - Date.now()) / 1000),
    }
  }

  // Cache is empty or expired and no refresh is in flight — kick one
  // off + store the promise so concurrent callers can dedupe on it.
  const appKey = Deno.env.get("DROPBOX_APP_KEY")
  const appSecret = Deno.env.get("DROPBOX_APP_SECRET")
  const refreshToken = Deno.env.get("DROPBOX_REFRESH_TOKEN")
  if (!appKey || !appSecret || !refreshToken) {
    throw new Error("Dropbox credentials not configured")
  }

  inFlightRefresh = (async () => {
    try {
      const fresh = await dropboxAccessToken(appKey, appSecret, refreshToken)
      const entry = {
        access_token: fresh.access_token,
        expires_at_ms: Date.now() + fresh.expires_in * 1000,
      }
      cachedToken = entry
      return entry
    } finally {
      // Clear AFTER the cache write so concurrent waiters above see
      // the populated cache; new requests after this fall through to
      // the fresh-cache fast path on the next call.
      inFlightRefresh = null
    }
  })()

  const entry = await inFlightRefresh
  return {
    access_token: entry.access_token,
    expires_in: Math.floor((entry.expires_at_ms - Date.now()) / 1000),
  }
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
  try {
    const token = await getCachedDropboxAccessToken()
    return jsonResponse({
      ok: true,
      access_token: token.access_token,
      // expires_in reflects REMAINING time on the cached token, not
      // the original 4hr lifetime — so the browser knows exactly how
      // much window it has for chunked uploads on this credential.
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

  // Server-side token for the finish call. We don't trust the token
  // the browser used for chunks — the commit goes through our own
  // credentials. Cached so a flurry of AddMedia finalizes don't each
  // pay the OAuth refresh round-trip.
  let accessToken: string
  try {
    accessToken = (await getCachedDropboxAccessToken()).access_token
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

// ─── action='finalize-forum' (chat-attachment commit) ────────────
//
// 2026-05-26 — Forum chat video + audio uploads route to Dropbox to
// preserve the Supabase free-tier storage budget. The browser-side
// chunked-upload flow is identical to the existing AddMedia path; only
// the finalize step differs:
//
//   - Path layout is `/forum/<channel_id>/<user_id>/<stamp>-<file>`
//     so chat attachments live in their own sandbox under the App
//     Folder, separate from per-member submission folders.
//   - No `media_submissions` row is inserted — the file's metadata
//     lives on `chat_messages.attachments` (jsonb) as a regular
//     ChatAttachment.
//   - The returned URL is the hot-linkable raw form so a plain
//     `<video src=...>` element can stream it.

interface FinalizeForumBody {
  session_id: string
  total_bytes: number
  original_filename: string
  content_type?: string | null
  channel_id: string
  kind: "video" | "audio"
}

// Forum uploads ride the existing 50 MB chat-attachment cap. We
// double-gate here (client cap + server cap) so a tampered client
// can't sneak a multi-GB video through into chat. AddMedia stays on
// the 10GB cap via the separate `finalize` action above.
const MAX_FORUM_FINALIZE_BYTES = 50 * 1024 * 1024

/**
 * Transform a Dropbox share link into a form that browsers can stream
 * directly from a `<video>` / `<audio>` `src=` attribute. The default
 * share link (`?dl=0`) returns Dropbox's HTML preview page; appending
 * `raw=1` tells Dropbox to serve the file bytes inline instead.
 *
 * Works for both legacy `/s/` and modern `/scl/fi/` share URLs.
 */
function toRawDropboxUrl(shareUrl: string): string {
  try {
    const u = new URL(shareUrl)
    u.searchParams.delete("dl")
    u.searchParams.set("raw", "1")
    return u.toString()
  } catch {
    // Fallback: if URL parsing fails for any reason, append the query
    // manually so we still return something playable.
    return shareUrl.includes("?")
      ? `${shareUrl.replace(/[?&]dl=\d/g, "")}&raw=1`
      : `${shareUrl}?raw=1`
  }
}

async function handleFinalizeForum(req: Request, ctx: CallerContext): Promise<Response> {
  let body: FinalizeForumBody
  try {
    body = await req.json() as FinalizeForumBody
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400)
  }
  if (
    !body.session_id ||
    !body.original_filename ||
    typeof body.total_bytes !== "number" ||
    !body.channel_id ||
    (body.kind !== "video" && body.kind !== "audio")
  ) {
    return jsonResponse({ ok: false, error: "Missing required fields" }, 400)
  }
  if (body.total_bytes <= 0) {
    return jsonResponse({ ok: false, error: "total_bytes must be > 0" }, 400)
  }
  if (body.total_bytes > MAX_FORUM_FINALIZE_BYTES) {
    return jsonResponse(
      { ok: false, error: `total_bytes ${body.total_bytes} exceeds 50MB forum cap` },
      413,
    )
  }
  // UUID-ish shape check on channel_id — defense in depth against
  // path traversal via a crafted channel id.
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(body.channel_id)) {
    return jsonResponse({ ok: false, error: "Malformed channel_id" }, 400)
  }

  let accessToken: string
  try {
    accessToken = (await getCachedDropboxAccessToken()).access_token
  } catch (err) {
    return jsonResponse({ ok: false, error: (err as Error).message }, 502)
  }

  // Browser supplies only the filename; the folder layout is enforced
  // server-side so a tampered client can't write into another
  // channel's folder or escape the App Folder sandbox.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const safeOriginal = body.original_filename.replace(/[^\w.-]/g, "_")
  const dropboxPath = `/forum/${body.channel_id}/${ctx.callerId}/${stamp}-${safeOriginal}`

  let finished: FinishedFile
  try {
    finished = await dropboxFinishSession(accessToken, body.session_id, body.total_bytes, dropboxPath)
  } catch (err) {
    return jsonResponse({ ok: false, error: (err as Error).message }, 502)
  }

  // Without a share link the file can't render in chat — treat the
  // share-link failure as fatal here (unlike AddMedia, which can
  // fall back to a deep-link in the submissions list).
  let shareUrl: string | null = null
  try {
    shareUrl = await dropboxGetOrCreateShareLink(accessToken, finished.path_lower)
  } catch {
    shareUrl = null
  }
  if (!shareUrl) {
    return jsonResponse(
      { ok: false, error: "Uploaded, but could not create share link" },
      502,
    )
  }

  return jsonResponse({
    ok: true,
    attachment: {
      kind: body.kind,
      url: toRawDropboxUrl(shareUrl),
      name: body.original_filename,
      mime: body.content_type ?? null,
      size: finished.size,
    },
  })
}

// ─── action='thumbnail' (Media page row previews) ────────────────
//
// 2026-05-26 — The Media page renders ~18 image rows at a 48px square
// each. Before this action, those <img> tags pulled the FULL Dropbox
// raw URL — meaning a single page-open downloaded ~36 MB just to
// downsize to 48×48 in CSS. Now each row fetches a real thumbnail
// from Dropbox's files/get_thumbnail_v2 endpoint (≈20 KB JPEG per
// image, ~100× smaller).
//
// The thumbnail bytes round-trip through this edge function because
// the API call needs the Dropbox access token, which never leaves the
// server. Returning base64-in-JSON instead of binary keeps the client
// code dead simple — the browser turns the b64 string into a data URL
// and feeds it directly into <img src=…>. The ~33 % base64 overhead
// is dwarfed by the bytes saved vs. the original full-size approach.

interface ThumbnailBody {
  /** Dropbox file id, e.g. "id:abc123". Stored on each row as
   *  media_submissions.drive_file_id. */
  file_id: string
  /** Optional w×h hint. Defaults to 256×256 which fits 4× DPI for a
   *  48px row thumbnail. */
  size?: "w64h64" | "w128h128" | "w256h256" | "w480h320" | "w640h480"
}

async function handleThumbnail(req: Request, _ctx: CallerContext): Promise<Response> {
  let body: ThumbnailBody
  try {
    body = await req.json() as ThumbnailBody
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400)
  }
  if (!body.file_id || typeof body.file_id !== "string" || !body.file_id.startsWith("id:")) {
    return jsonResponse({ ok: false, error: "Missing or malformed file_id" }, 400)
  }
  const size = body.size ?? "w256h256"

  let accessToken: string
  try {
    accessToken = (await getCachedDropboxAccessToken()).access_token
  } catch (err) {
    return jsonResponse({ ok: false, error: (err as Error).message }, 502)
  }

  const dbxRes = await fetch(
    "https://content.dropboxapi.com/2/files/get_thumbnail_v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({
          resource: { ".tag": "path", path: body.file_id },
          format: { ".tag": "jpeg" },
          size: { ".tag": size },
          mode: { ".tag": "strict" },
        }),
      },
    },
  )

  if (!dbxRes.ok) {
    // 409 = file has no thumbnail (e.g. non-image, video, or anything
    // outside Dropbox's supported set). Signal that explicitly so the
    // client can fall back to the file-icon glyph without retrying.
    if (dbxRes.status === 409) {
      return jsonResponse({ ok: false, error: "not_thumbnailable", status: 409 }, 200)
    }
    const txt = await dbxRes.text()
    return jsonResponse(
      { ok: false, error: `Dropbox thumbnail failed (${dbxRes.status}): ${txt}` },
      502,
    )
  }

  const buf = await dbxRes.arrayBuffer()
  const b64 = encodeBase64(buf)
  return jsonResponse({ ok: true, b64, mime: "image/jpeg", bytes: buf.byteLength })
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
    return jsonResponse({ ok: false, error: "Body must be JSON with {action: 'token'|'finalize'|'finalize-forum'|'thumbnail'}" }, 400)
  }

  switch (actionBody.action) {
    case "token":
      return await handleToken()
    case "finalize":
      return await handleFinalize(req, auth.ctx)
    case "finalize-forum":
      return await handleFinalizeForum(req, auth.ctx)
    case "thumbnail":
      return await handleThumbnail(req, auth.ctx)
    default:
      return jsonResponse(
        { ok: false, error: `Unknown action: ${actionBody.action ?? "(missing)"}` },
        400,
      )
  }
})
