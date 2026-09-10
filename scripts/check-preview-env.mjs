import { pathToFileURL } from 'node:url'

// Preview deployments must use a separate backend. Local development and
// production retain their existing configuration.
export function checkPreviewEnvironment(env) {
  if (env.VERCEL_ENV !== 'preview') return
  const ref = env.PORTAL_TEST_SUPABASE_REF?.trim()
  if (!ref || !/^[a-z0-9]{20}$/.test(ref)) {
    throw new Error('Preview blocked: set PORTAL_TEST_SUPABASE_REF to a separate test project in Vercel Preview settings.')
  }
  if (ref === 'ncljfjdcyswoeitsooty') {
    throw new Error('Preview blocked: the production Supabase project cannot be used for testing.')
  }
  if (env.VITE_SUPABASE_URL !== `https://${ref}.supabase.co`) {
    throw new Error('Preview blocked: VITE_SUPABASE_URL must match the approved test project.')
  }
  const key = env.VITE_SUPABASE_ANON_KEY ?? ''
  let validPublicKey = key.startsWith('sb_publishable_')
  if (!validPublicKey) {
    try {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
      validPublicKey = claims.role === 'anon' && claims.ref === ref
    } catch { /* Missing or malformed key is rejected below. */ }
  }
  if (!validPublicKey) throw new Error('Preview blocked: supply the test project public anon/publishable key, never a service-role key.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkPreviewEnvironment(process.env)
}
