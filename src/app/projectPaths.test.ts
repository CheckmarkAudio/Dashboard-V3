import assert from 'node:assert/strict'
import { test } from 'node:test'
import { legacyProjectSearchRedirect, projectDetailPath, projectsListPath } from './projectPaths.ts'

test('projectDetailPath encodes the id and keeps sample mode', () => {
  assert.equal(projectDetailPath('sample-project-0'), '/projects/sample-project-0')
  assert.equal(
    projectDetailPath('sample-project-0', 'sample=1'),
    '/projects/sample-project-0?sample=1',
  )
  assert.equal(
    projectDetailPath('a/b', new URLSearchParams('sample=1&project=old'), { task: 'task-1' }),
    '/projects/a%2Fb?sample=1&task=task-1',
  )
})

test('projectsListPath drops project and task params', () => {
  assert.equal(projectsListPath('sample=1&project=sample-project-0&task=t1'), '/projects?sample=1')
  assert.equal(projectsListPath(''), '/projects')
})

test('legacy ?project= links redirect into the workspace route', () => {
  assert.equal(
    legacyProjectSearchRedirect('?project=sample-project-0&sample=1&task=task-9'),
    '/projects/sample-project-0?sample=1&task=task-9',
  )
  assert.equal(legacyProjectSearchRedirect('?sample=1'), null)
})
