/** Explicit, browser-session-only fixture mode; production cannot enable it. */
export function isSampleMode(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    const choice = new URLSearchParams(window.location.search).get('sample')
    if (choice === '1') sessionStorage.setItem('checkmark-sample', '1')
    if (choice === '0') sessionStorage.removeItem('checkmark-sample')
    return sessionStorage.getItem('checkmark-sample') === '1'
  } catch { return false }
}
