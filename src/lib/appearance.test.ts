import { test } from 'node:test'
import assert from 'node:assert/strict'
import { APPEARANCE_KEY, resolvePortalStyle } from './appearance.ts'

test('unknown and absent saved preferences use the Soft Gold default', () => {
  for (const value of [undefined, null, '', 'gold', 'dark', {}, true]) assert.equal(resolvePortalStyle(value), 'soft-gold')
})
test('all three explicit portal styles are accepted independently of light/dark', () => {
  for (const value of ['classic','soft-gold','studio']) assert.equal(resolvePortalStyle(value), value)
})

 test('rollout ignores old browser choices but preserves choices made afterward', () => {
  const saved = new Map([['checkmark-portal-style', 'classic']])
  assert.equal(resolvePortalStyle(saved.get(APPEARANCE_KEY)), 'soft-gold')
  saved.set(APPEARANCE_KEY, 'classic')
  assert.equal(resolvePortalStyle(saved.get(APPEARANCE_KEY)), 'classic')
  assert.equal(saved.get('checkmark-portal-style'), 'classic')
})
