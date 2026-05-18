// PR #51 — Clients foundation (Tier 2 prep for Lean 2).
//
// Wraps the SECURITY DEFINER RPCs in
// `supabase/migrations/20260429100000_clients_table.sql`.

import { supabase } from '../supabase'
import { emitFlywheelEvent } from './flywheelEvents'

const LOG_PREFIX = '[queries/clients]'

export interface Client {
  id: string
  team_id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  google_review_link: string | null
  archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateClientInput {
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  google_review_link?: string | null
}

export interface UpdateClientInput {
  name?: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  google_review_link?: string | null
  archived?: boolean
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const { data, error } = await supabase.rpc('create_client', {
    p_name: input.name,
    p_email: input.email ?? null,
    p_phone: input.phone ?? null,
    p_notes: input.notes ?? null,
    p_google_review_link: input.google_review_link ?? null,
  })
  if (error) {
    console.error(`${LOG_PREFIX} createClient failed:`, error)
    throw new Error(error.message)
  }
  const client = data as Client

  // Flywheel — Phase 1: every new client = an Attract event.
  // Fire-and-forget so emit failures don't regress the client save.
  // Metadata captures whether contact details came along (email/phone)
  // so Phase 2 can split "warm lead" vs "name-only" if useful.
  void emitFlywheelEvent({
    stage: 'attract',
    source_type: 'client',
    source_id: client.id,
    metadata: {
      name: client.name,
      has_email: Boolean(client.email),
      has_phone: Boolean(client.phone),
    },
  })

  return client
}

export async function updateClient(id: string, patch: UpdateClientInput): Promise<Client> {
  const { data, error } = await supabase.rpc('update_client', {
    p_id: id,
    p_name: patch.name ?? null,
    p_email: patch.email ?? null,
    p_phone: patch.phone ?? null,
    p_notes: patch.notes ?? null,
    p_google_review_link: patch.google_review_link ?? null,
    p_archived: patch.archived ?? null,
  })
  if (error) {
    console.error(`${LOG_PREFIX} updateClient failed:`, error)
    throw new Error(error.message)
  }
  return data as Client
}

export async function archiveClient(id: string): Promise<Client> {
  const { data, error } = await supabase.rpc('archive_client', { p_id: id })
  if (error) {
    console.error(`${LOG_PREFIX} archiveClient failed:`, error)
    throw new Error(error.message)
  }
  return data as Client
}

export async function fetchClients(opts: { includeArchived?: boolean } = {}): Promise<Client[]> {
  const { data, error } = await supabase.rpc('get_clients', {
    p_include_archived: opts.includeArchived ?? false,
  })
  if (error) {
    console.error(`${LOG_PREFIX} fetchClients failed:`, error)
    throw new Error(error.message)
  }
  return (data as Client[] | null) ?? []
}

/** Typeahead search. Empty query returns the most-recently-touched 12. */
export async function searchClients(query: string): Promise<Client[]> {
  const { data, error } = await supabase.rpc('search_clients', { p_query: query })
  if (error) {
    console.error(`${LOG_PREFIX} searchClients failed:`, error)
    throw new Error(error.message)
  }
  return (data as Client[] | null) ?? []
}

export const clientKeys = {
  all: ['clients'] as const,
  list: (includeArchived: boolean) => ['clients', 'list', includeArchived] as const,
  search: (query: string) => ['clients', 'search', query] as const,
}
