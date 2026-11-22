import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectCover, projectInitials } from './projectCover.ts'

test('projectInitials uses the first two title words', () => {
  assert.equal(projectInitials('Echoes in Gold'), 'EG')
  assert.equal(projectInitials('Solo'), 'SO')
  assert.equal(projectInitials('The Long Way Home'), 'LW')
  assert.equal(projectInitials('After Hours EP'), 'AH')
  assert.equal(projectInitials('  '), 'P')
})

test('projectCover is stable and distinct for different projects', () => {
  const one = projectCover('sample-project-0', 'Echoes in Gold')
  const again = projectCover('sample-project-0', 'Echoes in Gold')
  const two = projectCover('sample-project-1', 'After Hours EP')
  assert.equal(one.initials, 'EG')
  assert.deepEqual(one, again)
  assert.notEqual(one.background, two.background)
  assert.match(one.background, /linear-gradient\(/)
})
