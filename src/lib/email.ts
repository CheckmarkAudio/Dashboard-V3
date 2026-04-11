/**
 * Normalize an email for storage and comparison.
 *
 * Every write to a table whose `email` column has a
 * `CHECK (email = lower(email))` constraint must go through this helper
 * (currently `intern_users` — `intern_leads` follows after its migration).
 * Reads should also normalize before `.eq('email', …)` lookups so they
 * match regardless of how the value was originally typed.
 */
export const normalizeEmail = (raw: string | null | undefined): string =>
  (raw ?? '').trim().toLowerCase()
