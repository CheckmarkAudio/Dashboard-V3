import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import {
  decryptRefreshToken,
  deleteGoogleCalendarEvent,
  insertGoogleCalendarEvent,
  refreshAccessToken,
  updateGoogleCalendarEvent,
} from "../_shared/googleCalendar.ts"

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

function sessionTitle(sessionType: string, clientName: string | null): string {
  const prefix =
    sessionType === "recording" ? "Recording" :
    sessionType === "mixing" ? "Mixing" :
    sessionType === "lesson" ? "Lesson" :
    "Meeting"
  return clientName ? `${prefix} · ${clientName}` : prefix
}

function sessionPayload(session: {
  id: string
  client_name: string | null
  session_date: string
  start_time: string
  end_time: string
  session_type: string
  status: string
  room: string | null
  notes: string | null
  assigned_to_name?: string | null
}): Record<string, unknown> {
  const descriptionLines = [
    `Checkmark session: ${session.id}`,
    `Status: ${session.status}`,
    session.assigned_to_name ? `Assigned to: ${session.assigned_to_name}` : null,
    session.room ? `Room: ${session.room}` : null,
    session.notes ? `Notes: ${session.notes}` : null,
    "",
    "Managed by Checkmark Workspace.",
  ].filter(Boolean)

  return {
    summary: sessionTitle(session.session_type, session.client_name),
    description: descriptionLines.join("\n"),
    location: session.room ?? undefined,
    start: {
      dateTime: `${session.session_date}T${session.start_time}`,
      timeZone: "America/Denver",
    },
    end: {
      dateTime: `${session.session_date}T${session.end_time}`,
      timeZone: "America/Denver",
    },
    extendedProperties: {
      private: {
        checkmarkSessionId: session.id,
      },
    },
  }
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

async function getCallerContext(req: Request) {
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
    admin,
    userId: userData.user.id,
    role: profile.role,
    teamId: profile.team_id as string,
  }
}

async function setSessionSyncState(
  admin: ReturnType<typeof createClient>,
  sessionId: string,
  patch: Record<string, unknown>,
) {
  await admin.from("sessions").update(patch).eq("id", sessionId)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405)
  }

  let body:
    | {
        action?: string
        session_id?: string
        google_event_id?: string | null
      }
    | null = null

  try {
    const ctx = await getCallerContext(req)
    if ("error" in ctx) return ctx.error

    const googleClientId = requireEnv("GOOGLE_CLIENT_ID")
    const googleClientSecret = requireEnv("GOOGLE_CLIENT_SECRET")
    const encryptionSecret = requireEnv("GOOGLE_TOKEN_ENCRYPTION_KEY")

    body = await req.json().catch(() => null) as typeof body

    if (!body?.action) {
      return jsonResponse({ ok: false, error: "Missing action" }, 400)
    }

    const { data: connection, error: connectionErr } = await ctx.admin
      .from("google_calendar_connections")
      .select("calendar_id, encrypted_refresh_token, refresh_token_iv, google_email")
      .eq("team_id", ctx.teamId)
      .maybeSingle()

    if (connectionErr) {
      return jsonResponse({ ok: false, error: connectionErr.message }, 500)
    }
    if (!connection) {
      if (body.session_id) {
        await setSessionSyncState(ctx.admin, body.session_id, {
          google_sync_status: "error",
          google_sync_error: "Google Calendar is not connected for this team.",
        })
      }
      return jsonResponse({ ok: false, error: "Google Calendar is not connected." }, 409)
    }

    const refreshToken = await decryptRefreshToken(
      connection.encrypted_refresh_token,
      connection.refresh_token_iv,
      encryptionSecret,
    )
    const tokens = await refreshAccessToken({
      refreshToken,
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
    const accessToken = tokens.access_token

    if (body.action === "delete_session_event") {
      if (ctx.role !== "admin") {
        return jsonResponse({ ok: false, error: "Only admins can delete synced events." }, 403)
      }
      if (!body.google_event_id) {
        return jsonResponse({ ok: true, deleted: false })
      }
      await deleteGoogleCalendarEvent(connection.calendar_id, body.google_event_id, accessToken)
      return jsonResponse({ ok: true, deleted: true })
    }

    if (body.action !== "upsert_session" || !body.session_id) {
      return jsonResponse({ ok: false, error: "Unknown action" }, 400)
    }

    const { data: session, error: sessionErr } = await ctx.admin
      .from("sessions")
      .select(`
        id,
        team_id,
        client_name,
        session_date,
        start_time,
        end_time,
        session_type,
        status,
        room,
        notes,
        google_event_id,
        assigned_to
      `)
      .eq("id", body.session_id)
      .eq("team_id", ctx.teamId)
      .maybeSingle()

    if (sessionErr) {
      return jsonResponse({ ok: false, error: sessionErr.message }, 500)
    }
    if (!session) {
      return jsonResponse({ ok: false, error: "Session not found" }, 404)
    }

    let assignedName: string | null = null
    if (session.assigned_to) {
      const { data: assignee } = await ctx.admin
        .from("team_members")
        .select("display_name")
        .eq("id", session.assigned_to)
        .maybeSingle()
      assignedName = assignee?.display_name ?? null
    }

    if (session.status === "cancelled") {
      if (session.google_event_id) {
        await deleteGoogleCalendarEvent(connection.calendar_id, session.google_event_id, accessToken)
      }
      await setSessionSyncState(ctx.admin, session.id, {
        google_event_id: null,
        google_sync_status: "synced",
        google_last_synced_at: new Date().toISOString(),
        google_sync_error: null,
      })
      return jsonResponse({ ok: true, action: "deleted" })
    }

    const payload = sessionPayload({
      ...session,
      assigned_to_name: assignedName,
    })

    let eventId = session.google_event_id

    try {
      if (eventId) {
        await updateGoogleCalendarEvent(connection.calendar_id, eventId, accessToken, payload)
      } else {
        const created = await insertGoogleCalendarEvent(connection.calendar_id, accessToken, payload)
        eventId = created.id
      }
    } catch (error) {
      const status = (error as Error & { status?: number }).status
      if (eventId && status === 404) {
        const created = await insertGoogleCalendarEvent(connection.calendar_id, accessToken, payload)
        eventId = created.id
      } else {
        throw error
      }
    }

    await setSessionSyncState(ctx.admin, session.id, {
      google_event_id: eventId,
      google_sync_status: "synced",
      google_last_synced_at: new Date().toISOString(),
      google_sync_error: null,
    })
    await ctx.admin
      .from("google_calendar_connections")
      .update({
        last_tested_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("team_id", ctx.teamId)

    return jsonResponse({
      ok: true,
      event_id: eventId,
      calendar_id: connection.calendar_id,
      google_email: connection.google_email,
    })
  } catch (error) {
    console.error("[google-calendar-sync]", error)
    if (body?.session_id) {
      try {
        const admin = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        await admin
          .from("sessions")
          .update({
            google_sync_status: "error",
            google_sync_error: error instanceof Error ? error.message : "Unexpected sync error",
          })
          .eq("id", body.session_id)
      } catch (persistError) {
        console.error("[google-calendar-sync] failed to persist sync error", persistError)
      }
    }
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    )
  }
})
