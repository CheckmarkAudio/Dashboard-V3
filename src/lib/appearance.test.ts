import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePortalStyle } from './appearance.ts'

test('unknown and absent saved preferences preserve the Classic default', () => {
  for (const value of [undefined, null, '', 'gold', 'dark', {}, true]) assert.equal(resolvePortalStyle(value), 'classic')
})
test('all three explicit portal styles are accepted independently of light/dark', () => {
  for (const value of ['classic','soft-gold','studio']) assert.equal(resolvePortalStyle(value), value)
})
