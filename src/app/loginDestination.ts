/** Only internal destinations may survive the sign-in round trip. */
export function loginDestination(value: unknown, installed = false): string {
  const fallback = installed ? '/projects' : '/'
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return fallback
  const url = new URL(value, 'https://checkmark.invalid')
  if (url.origin !== 'https://checkmark.invalid' || url.pathname === '/login') return fallback
  return `${url.pathname}${url.search}${url.hash}`
}
