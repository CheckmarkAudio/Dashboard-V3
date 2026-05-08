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
  // Guarantee at least one of each class so the password always
  // satisfies common "mixed character" rules.
  const required = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
  ]
  const rest = Array.from(arr.slice(4)).map((n) => all[n % all.length])
  // Shuffle so the required chars aren't always at the front.
  const out = [...required, ...rest]
  for (let i = out.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.join('')
}
