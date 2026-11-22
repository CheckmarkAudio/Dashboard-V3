import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchesProjectFilter } from './projectListFilter.ts'

test('active filter keeps in-progress statuses and hides completed work', () => {
  assert.equal(matchesProjectFilter('active', 'active'), true)
  assert.equal(matchesProjectFilter('planned', 'active'), true)
  assert.equal(matchesProjectFilter('paused', 'active'), true)
  assert.equal(matchesProjectFilter('completed', 'active'), false)
  assert.equal(matchesProjectFilter('completed', 'completed'), true)
  assert.equal(matchesProjectFilter('paused', 'all'), true)
})
