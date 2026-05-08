/**
 * Generate a strong, human-friendly temp password.
 *
 *  - 14 chars: mixes upper/lower/digits + a couple of symbols
 *  - Skips look-alike characters (0/O, 1/l/I) so the owner can read
 *    it out loud or paste it into a DM without confusion
 *  - `crypto.getRandomValues` for proper entropy (NEVER `Math.random`)
 *  - Always contains at least one of each character class so it
 *    satisfies common "mixed character" password rules
 *
 * Used by both the admin reset flow (`AccountAccessPanel`) and the
 * Add Member onboarding flow (`TeamManager`). Both surface the result
 * via `<TempPasswordReveal />` so the owner can hand it off.
 */
export function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ' // no I, L, O
  const lower = 'abcdefghjkmnpqrstuvwxyz' // no i, l, o
  const digits = '23456789' // no 0, 1
  const symbols = '!@#$%&*'
  const all = upper + lower + digits + symbols
  const len = 14
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  // Helpers — `noUncheckedIndexedAccess` types `arr[i]` and
  // `string[i]` as `T | undefined`, even though we just allocated
  // `len` slots and `s` is a non-empty literal. Coerce safely.
  const r = (i: number): number => arr[i] ?? 0
  const at = (s: string, n: number): string =>
    s.charAt(n % s.length) || s.charAt(0) || '?'
  // Guarantee at least one of each class so the password always
  // satisfies common "mixed character" rules.
  const required = [
    at(upper, r(0)),
    at(lower, r(1)),
    at(digits, r(2)),
    at(symbols, r(3)),
  ]
  const rest = Array.from(arr.slice(4)).map((n) => at(all, n))
  // Shuffle so the required chars aren't always at the front.
  const out = [...required, ...rest]
  for (let i = out.length - 1; i > 0; i--) {
    const j = r(i) % (i + 1)
    const a = out[i] ?? ''
    const b = out[j] ?? ''
    out[i] = b
    out[j] = a
  }
  return out.join('')
}
