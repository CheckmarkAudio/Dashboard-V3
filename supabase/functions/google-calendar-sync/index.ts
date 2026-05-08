import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import {
  decryptRefreshToken,
  deleteGoogleCalendarEvent,
  insertGoogleCalendarEvent,
  listGoogleCalendarEvents,
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

const DENVER_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Denver",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const DENVER_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Denver",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

function parseSummaryClientName(summary: string | undefined, sessionType: string): string | null | undefined {
  if (!summary) return undefined
  const prefix =
    sessionType === "recording" ? "Recording" :
    sessionType === "mixing" ? "Mixing" :
    sessionType === "lesson" ? "Lesson" :
    "Meeting"

  if (summary === prefix) return null
  const prefixed = `${prefix} · `
  if (summary.startsWith(prefixed)) {
    const clientName = summary.slice(prefixed.length).trim()
    return clientName || null
  }
  return undefined
}

function stripManagedDescription(description: string | undefined): string | null | undefined {
  if (typeof description !== "string") return undefined
  const cleaned = description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      line &&
      !line.startsWith("Checkmark session:") &&
      !line.startsWith("Status:") &&
      !line.startsWith("Assigned to:") &&
      !line.startsWith("Room:") &&
      line !== "Managed by Checkmark Workspace."
    )
    .map((line) => line.startsWith("Notes: ") ? line.slice("Notes: ".length).trim() : line)
    .join("\n")
    .trim()

  return cleaned || null
}

function denverDateAndTime(iso: string): { date: string; time: string } {
  const date = new Date(iso)
  return {
    date: DENVER_DATE_FORMATTER.format(date),
    time: DENVER_TIME_FORMATTER.format(date),
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

type InboundSummary = {
  processed_count: number
  updated_count: number
  cancelled_count: number
  unchanged_count: number
  skipped_count: number
}

async function setInboundConnectionState(
  admin: ReturnType<typeof createClient>,
  teamId: string,
  patch: Record<string, unknown>,
) {
  await admin
    .from("google_calendar_connections")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("team_id", teamId)
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
      .select(`
        calendar_id,
        encrypted_refresh_token,
        refresh_token_iv,
        google_email,
        google_sync_token,
        inbound_last_synced_at,
        inbound_last_sync_error,
        inbound_last_sync_summary
      `)
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

    if (body.action === "pull_inbound_changes") {
      if (ctx.role !== "admin") {
        return jsonResponse({ ok: false, error: "Only admins can pull inbound calendar changes." }, 403)
      }

      const summary: InboundSummary = {
        processed_count: 0,
        updated_count: 0,
        cancelled_count: 0,
        unchanged_count: 0,
        skipped_count: 0,
      }

      const applyInboundChanges = async (syncToken?: string | null) => {
        let nextPageToken: string | undefined
        let nextSyncToken: string | undefined

        do {
          const page = await listGoogleCalendarEvents(connection.calendar_id, accessToken, {
            pageToken: nextPageToken,
            syncToken: syncToken ?? undefined,
          })
          nextPageToken = page.nextPageToken
          nextSyncToken = page.nextSyncToken ?? nextSyncToken

          const eventIds = (page.items ?? [])
            .map((event) => event.id)
            .filter(Boolean)

          const linkedSessions = new Map<string, {
            id: string
            status: string
            session_date: string
            start_time: string
            end_time: string
            client_name: string | null
            room: string | null
            notes: string | null
            session_type: string
          }>()

          if (eventIds.length) {
            const { data: sessions } = await ctx.admin
              .from("sessions")
              .select(`
                id,
                status,
                session_date,
                start_time,
                end_time,
                client_name,
                room,
                notes,
                session_type,
                google_event_id
              `)
              .eq("team_id", ctx.teamId)
              .in("google_event_id", eventIds)

            for (const session of sessions ?? []) {
              if (session.google_event_id) linkedSessions.set(session.google_event_id, session)
            }
          }

          for (const event of page.items ?? []) {
            summary.processed_count += 1
            const session = linkedSessions.get(event.id)
            if (!session) {
              summary.skipped_count += 1
              continue
            }

            if (event.status === "cancelled") {
              if (session.status === "cancelled") {
                summary.unchanged_count += 1
                continue
              }
              await setSessionSyncState(ctx.admin, session.id, {
                status: "cancelled",
                google_sync_status: "synced",
                google_last_synced_at: new Date().toISOString(),
                google_sync_error: null,
                calendar_last_changed_source: "google",
                calendar_last_changed_at: new Date().toISOString(),
              })
              summary.cancelled_count += 1
              continue
            }

            const startDateTime = event.start?.dateTime
            const endDateTime = event.end?.dateTime
            if (!startDateTime || !endDateTime) {
              summary.skipped_count += 1
              continue
            }

            const nextStart = denverDateAndTime(startDateTime)
            const nextEnd = denverDateAndTime(endDateTime)
            const nextClientName = parseSummaryClientName(event.summary, session.session_type)
            const nextNotes = stripManagedDescription(event.description)

            const patch: Record<string, unknown> = {}
            if (session.session_date !== nextStart.date) patch.session_date = nextStart.date
            if (session.start_time !== nextStart.time) patch.start_time = nextStart.time
            if (session.end_time !== nextEnd.time) patch.end_time = nextEnd.time
            if (session.room !== (event.location ?? null)) patch.room = event.location ?? null
            if (nextClientName !== undefined && session.client_name !== nextClientName) patch.client_name = nextClientName
            if (nextNotes !== undefined && session.notes !== nextNotes) patch.notes = nextNotes

            if (Object.keys(patch).length === 0) {
              summary.unchanged_count += 1
              continue
            }

            await setSessionSyncState(ctx.admin, session.id, {
              ...patch,
              google_sync_status: "synced",
              google_last_synced_at: new Date().toISOString(),
              google_sync_error: null,
              calendar_last_changed_source: "google",
              calendar_last_changed_at: new Date().toISOString(),
            })
            summary.updated_count += 1
          }

          if (!nextPageToken && nextSyncToken) {
            await setInboundConnectionState(ctx.admin, ctx.teamId, {
              google_sync_token: nextSyncToken,
              inbound_last_synced_at: new Date().toISOString(),
              inbound_last_sync_error: null,
              inbound_last_sync_summary: summary,
              last_sync_error: null,
              last_tested_at: new Date().toISOString(),
            })
          }
        } while (nextPageToken)
      }

      try {
        await applyInboundChanges(connection.google_sync_token)
      } catch (error) {
        const status = (error as Error & { status?: number }).status
        if (status === 410) {
          await setInboundConnectionState(ctx.admin, ctx.teamId, {
            google_sync_token: null,
          })
          await applyInboundChanges(null)
        } else {
          throw error
        }
      }

      return jsonResponse({
        ok: true,
        summary,
        calendar_id: connection.calendar_id,
        google_email: connection.google_email,
      })
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
        calendar_last_changed_source: "checkmark",
        calendar_last_changed_at: new Date().toISOString(),
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
      calendar_last_changed_source: "checkmark",
      calendar_last_changed_at: new Date().toISOString(),
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
