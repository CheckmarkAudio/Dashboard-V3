import test from 'node:test'
import assert from 'node:assert/strict'
import { loginDestination } from './loginDestination.ts'

test('sign-in preserves a project deep link and installed launches use Projects', () => {
  assert.equal(loginDestination('/projects/studio?tab=workspace#notes'), '/projects/studio?tab=workspace#notes')
  assert.equal(loginDestination(undefined, true), '/projects')
  assert.equal(loginDestination(undefined), '/')
})
test('sign-in rejects external destinations and login loops', () => {
  for (const value of ['https://elsewhere.test', '//elsewhere.test', '/\\elsewhere.test', '/login', null, '/\n/elsewhere.test']) {
    assert.equal(loginDestination(value, true), '/projects')
  }
})
