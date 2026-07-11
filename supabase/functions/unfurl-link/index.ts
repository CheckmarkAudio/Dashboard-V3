// ============================================================================
// unfurl-link — Supabase Edge Function (2026-05-20)
//
// Server-side fetch of an arbitrary URL's metadata so the forum can
// render Instagram-style link previews (title + description + hero
// image + site name). Lives server-side because:
//   1. Most sites don't ship CORS headers for `fetch()` from the
//      browser, so a client-side fetch would be blocked.
//   2. We get to enforce timeouts + size limits + a User-Agent the
//      target site recognizes.
//   3. The function runs as the caller's JWT-verified user, so we
//      stay inside our auth model (no anonymous fetch service).
//
// FLOW
//   1. Client (MediaPicker) POSTs `{url: string}` when an admin adds
//      a link attachment.
//   2. We check the `chat_link_previews` cache (7-day TTL).
//   3. Cache miss → fetch the URL with 8s timeout + 1.5MB body cap.
//   4. Parse <head> for og:* / twitter:* / standard meta tags.
//   5. Persist to `chat_link_previews` for future requests.
//   6. Return `{ok: true, title, description, image, site_name, ...}`
//
// The metadata is also embedded into the message's `attachments`
// jsonb so render is read-only — no per-message fetch round trips.
//
// SECURITY
//   * verify_jwt: true (only authed members can hit this).
//   * URL must be http(s) — rejects file://, data://, javascript:.
//   * Private IP ranges (10.*, 192.168.*, etc) are rejected to
//     prevent SSRF.
//   * Body capped at 1.5MB; only the first chunk is parsed.
//   * 8s wall-clock timeout via AbortController.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const FETCH_TIMEOUT_MS = 8_000
const FETCH_MAX_BYTES = 1_500_000
// User-Agent string mimics a real browser. Some sites (LinkedIn,
// Medium, Twitter) return 403/HTML-less responses to obvious bots.
const USER_AGENT =
  "Mozilla/5.0 (compatible; CheckmarkLinkPreview/1.0; +https://checkmarkstudio.vercel.app/) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

interface UnfurledPreview {
  title: string | null
  description: string | null
  image: string | null
  site_name: string | null
  url: string
}

/** Reject obviously-internal addresses to mitigate SSRF. */
function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (lower === "localhost") return true
  if (lower.endsWith(".local")) return true
  if (lower.endsWith(".internal")) return true
  // IPv4 literals.
  const v4 = lower.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 0) return true
  }
  // IPv6 literals — coarse check for loopback / link-local.
  if (lower === "::1") return true
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true
  return false
}

/** Strip HTML entities the regex extractor sees in title/description. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .trim()
}

/** Resolve a possibly-relative image URL against the page URL. */
function absoluteUrl(maybeRelative: string | null, base: string): string | null {
  if (!maybeRelative) return null
  try {
    return new URL(maybeRelative, base).toString()
  } catch {
    return null
  }
}

/**
 * Hand-rolled <head> meta-tag extractor. We avoid a DOM lib
 * (Deno's deno_dom is heavy + slow to cold-start). The regex
 * approach is good enough for OG/Twitter tags which are typically
 * `<meta property="og:title" content="…">` and not nested anywhere
 * weird. Falls back to <title>…</title> for raw title.
 */
function extractMetadata(html: string, baseUrl: string): UnfurledPreview {
  // Truncate to the first 1.5MB worth of <head> we expect to see;
  // most sites have everything we need in the first 64KB.
  const head = html.slice(0, Math.min(html.length, 200_000))

  const getMeta = (...names: string[]): string | null => {
    for (const name of names) {
      // Try property="…" first (OG convention), then name="…" (Twitter, std).
      const reProp = new RegExp(
        `<meta[^>]+(?:property|name)\\s*=\\s*["']${escapeRegex(name)}["'][^>]*content\\s*=\\s*["']([^"']+)["']`,
        "i",
      )
      const m = head.match(reProp)
      if (m?.[1]) return decodeEntities(m[1])
      // content="…" first, then property/name (less common but valid)
      const reContent = new RegExp(
        `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*(?:property|name)\\s*=\\s*["']${escapeRegex(name)}["']`,
        "i",
      )
      const m2 = head.match(reContent)
      if (m2?.[1]) return decodeEntities(m2[1])
    }
    return null
  }

  const title =
    getMeta("og:title", "twitter:title") ??
    (head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decodeEntities(head.match(/<title[^>]*>([^<]*)<\/title>/i)![1]!) : null)

  const description = getMeta("og:description", "twitter:description", "description")

  const rawImage = getMeta("og:image", "og:image:secure_url", "twitter:image", "twitter:image:src")
  const image = absoluteUrl(rawImage, baseUrl)

  const siteName = getMeta("og:site_name", "application-name") ?? new URL(baseUrl).hostname.replace(/^www\./, "")

  return {
    title,
    description,
    image,
    site_name: siteName,
    url: baseUrl,
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Fetch with timeout + byte cap. Returns the HTML string. */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Upstream returned ${res.status}`)
    }
    const contentType = res.headers.get("Content-Type") ?? ""
    if (!contentType.toLowerCase().includes("html")) {
      throw new Error(`Upstream is not HTML (${contentType || "no type"})`)
    }
    // Stream + cap bytes.
    const reader = res.body?.getReader()
    if (!reader) throw new Error("No response body")
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        if (total > FETCH_MAX_BYTES) {
          // Stop reading; we already have plenty for the <head>.
          await reader.cancel()
          break
        }
        chunks.push(value)
      }
    }
    const merged = new Uint8Array(total)
    let cursor = 0
    for (const c of chunks) {
      merged.set(c.subarray(0, Math.min(c.byteLength, FETCH_MAX_BYTES - cursor)), cursor)
      cursor += c.byteLength
      if (cursor >= FETCH_MAX_BYTES) break
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(merged.slice(0, Math.min(merged.byteLength, FETCH_MAX_BYTES)))
  } finally {
    clearTimeout(timeout)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405)

  // Auth — same pattern as the other functions.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ ok: false, error: "Misconfigured" }, 500)
  }
  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Missing Authorization" }, 401)
  }
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: callerData, error: callerErr } = await caller.auth.getUser()
  if (callerErr || !callerData.user) {
    return jsonResponse({ ok: false, error: "Not authenticated" }, 401)
  }

  // Parse body.
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: "Body must be JSON {url}" }, 400)
  }
  const rawUrl = (body.url ?? "").trim()
  if (!rawUrl) return jsonResponse({ ok: false, error: "url required" }, 400)

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return jsonResponse({ ok: false, error: "Malformed URL" }, 400)
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return jsonResponse({ ok: false, error: "Only http(s) URLs supported" }, 400)
  }
  if (isPrivateHost(parsed.hostname)) {
    return jsonResponse({ ok: false, error: "Private hosts not allowed" }, 400)
  }

  const canonical = parsed.toString()
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Cache lookup (7-day TTL).
  const { data: cached } = await admin
    .from("chat_link_previews")
    .select("title, description, image_url, site_name, fetched_at")
    .eq("url", canonical)
    .gt("fetched_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle()

  if (cached) {
    return jsonResponse({
      ok: true,
      cached: true,
      preview: {
        url: canonical,
        title: cached.title,
        description: cached.description,
        image: cached.image_url,
        site_name: cached.site_name,
      },
    })
  }

  // Cache miss → fetch + parse.
  let preview: UnfurledPreview
  try {
    const html = await fetchHtml(canonical)
    preview = extractMetadata(html, canonical)
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: err instanceof Error ? err.message : "Fetch failed",
      // Still return enough for the client to render a degraded card.
      preview: {
        url: canonical,
        title: null,
        description: null,
        image: null,
        site_name: parsed.hostname.replace(/^www\./, ""),
      },
    }, 502)
  }

  // Persist (best-effort; cache miss isn't a hard failure if this errs).
  await admin
    .from("chat_link_previews")
    .upsert(
      {
        url: canonical,
        title: preview.title,
        description: preview.description,
        image_url: preview.image,
        site_name: preview.site_name,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "url" },
    )

  return jsonResponse({ ok: true, cached: false, preview })
})
