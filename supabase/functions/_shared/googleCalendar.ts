const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const GOOGLE_CALENDAR_BASE_URL = 'https://www.googleapis.com/calendar/v3'

function utf8Encode(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function utf8Decode(value: ArrayBuffer): string {
  return new TextDecoder().decode(value)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', utf8Encode(secret))
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptRefreshToken(token: string, secret: string): Promise<{
  ciphertext: string
  iv: string
}> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await encryptionKey(secret)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    utf8Encode(token),
  )
  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  }
}

export async function decryptRefreshToken(
  ciphertext: string,
  iv: string,
  secret: string,
): Promise<string> {
  const key = await encryptionKey(secret)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext),
  )
  return utf8Decode(decrypted)
}

export interface GoogleTokenResponse {
  access_token: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
}

export async function exchangeCodeForTokens(input: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  })
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error_description ?? data.error ?? 'Google token exchange failed')
  }
  return data as GoogleTokenResponse
}

export async function refreshAccessToken(input: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: 'refresh_token',
  })
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error_description ?? data.error ?? 'Google token refresh failed')
  }
  return data as GoogleTokenResponse
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error_description ?? data.error ?? 'Failed to fetch Google user info')
  }
  return typeof data.email === 'string' ? data.email : null
}

async function googleCalendarRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${GOOGLE_CALENDAR_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (response.status === 204) return null as T

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      data?.error?.message ??
      data?.error_description ??
      data?.message ??
      `Google Calendar request failed (${response.status})`
    const error = new Error(message)
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }
  return data as T
}

export async function insertGoogleCalendarEvent(
  calendarId: string,
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  return googleCalendarRequest<{ id: string }>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    accessToken,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export async function updateGoogleCalendarEvent(
  calendarId: string,
  eventId: string,
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  return googleCalendarRequest<{ id: string }>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: 'PUT', body: JSON.stringify(payload) },
  )
}

export async function deleteGoogleCalendarEvent(
  calendarId: string,
  eventId: string,
  accessToken: string,
): Promise<void> {
  await googleCalendarRequest<void>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: 'DELETE' },
  )
}

export interface GoogleCalendarEvent {
  id: string
  status?: string
  summary?: string
  description?: string
  location?: string | null
  updated?: string
  start?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  extendedProperties?: {
    private?: Record<string, string>
  }
}

export interface GoogleCalendarEventListResponse {
  items: GoogleCalendarEvent[]
  nextPageToken?: string
  nextSyncToken?: string
}

export async function listGoogleCalendarEvents(
  calendarId: string,
  accessToken: string,
  input: {
    pageToken?: string
    syncToken?: string
    timeMin?: string
    timeMax?: string
    maxResults?: number
  } = {},
): Promise<GoogleCalendarEventListResponse> {
  const params = new URLSearchParams()
  params.set('maxResults', String(input.maxResults ?? 250))
  params.set('showDeleted', 'true')
  params.set('singleEvents', 'true')
  // Do not filter by privateExtendedProperty here. Google requires
  // `propertyName=value` constraints, and this worker needs to find any
  // already-linked Checkmark event by its Google event id. The caller
  // filters the returned page against `sessions.google_event_id`.
  if (input.pageToken) params.set('pageToken', input.pageToken)
  if (input.syncToken) {
    params.set('syncToken', input.syncToken)
  } else {
    if (input.timeMin) params.set('timeMin', input.timeMin)
    if (input.timeMax) params.set('timeMax', input.timeMax)
    params.set('orderBy', input.timeMin || input.timeMax ? 'startTime' : 'updated')
  }

  return googleCalendarRequest<GoogleCalendarEventListResponse>(
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    accessToken,
  )
}
