import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkPreviewEnvironment } from './check-preview-env.mjs'
const ref = 'abcdefghijklmnopqrst'
const jwt = claims => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`
const valid = { VERCEL_ENV: 'preview', PORTAL_TEST_SUPABASE_REF: ref, VITE_SUPABASE_URL: `https://${ref}.supabase.co`, VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon', ref }) }
test('preview fails closed without a separate backend', () => {
  assert.throws(() => checkPreviewEnvironment({VERCEL_ENV:'preview'}))
  assert.throws(() => checkPreviewEnvironment({...valid, PORTAL_TEST_SUPABASE_REF:'ncljfjdcyswoeitsooty'}))
  assert.throws(() => checkPreviewEnvironment({...valid, VITE_SUPABASE_URL:'https://production.example'}))
})
test('preview rejects privileged and mismatched JWT keys', () => {
  for (const claims of [{role:'service_role', ref}, {role:'anon', ref:'other-project'}]) {
    assert.throws(() => checkPreviewEnvironment({...valid, VITE_SUPABASE_ANON_KEY:jwt(claims)}))
  }
  assert.throws(() => checkPreviewEnvironment({...valid, VITE_SUPABASE_ANON_KEY:'sb_secret_example'}))
})
test('preview accepts a configured test project with a public key', () => {
  assert.doesNotThrow(() => checkPreviewEnvironment(valid))
  assert.doesNotThrow(() => checkPreviewEnvironment({...valid, VITE_SUPABASE_ANON_KEY:'sb_publishable_example'}))
})
test('local and production builds keep their existing configuration', () => {
  assert.doesNotThrow(() => checkPreviewEnvironment({}))
  assert.doesNotThrow(() => checkPreviewEnvironment({VERCEL_ENV:'production'}))
})
