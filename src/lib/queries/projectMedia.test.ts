import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertProjectImageFile, buildProjectMediaPath, isMissingProjectMediaSchema, PROJECT_MEDIA_MAX_BYTES } from './projectMediaSupport.ts'
import { sampleDeleteInspo, sampleProjectMediaRpc } from '../../preview/projectMediaSample.ts'
import { sampleTables } from '../../preview/fixtures.ts'

test('isMissingProjectMediaSchema recognizes absent tables, functions, and buckets', () => {
  assert.equal(isMissingProjectMediaSchema({ code: '42P01', message: 'relation does not exist' }), true)
  assert.equal(isMissingProjectMediaSchema({ code: 'PGRST205', message: 'schema cache' }), true)
  assert.equal(isMissingProjectMediaSchema({ code: 'PGRST202', message: 'could not find the function' }), true)
  assert.equal(isMissingProjectMediaSchema({ code: '42883', message: 'function set_project_cover does not exist' }), true)
  assert.equal(isMissingProjectMediaSchema({ message: 'Bucket not found' }), true)
  assert.equal(isMissingProjectMediaSchema({ status: 404, message: 'not found' }), true)
  assert.equal(isMissingProjectMediaSchema({ code: '42501', message: 'Only the project owner or an admin can change the cover image' }), false)
  assert.equal(isMissingProjectMediaSchema(null), false)
})

test('assertProjectImageFile accepts allowed images and rejects others', () => {
  const ok = { type: 'image/png', size: 1200, name: 'mood.png' } as File
  assert.doesNotThrow(() => assertProjectImageFile(ok))
  assert.throws(() => assertProjectImageFile({ type: 'application/pdf', size: 100, name: 'x.pdf' } as File), /JPEG/)
  assert.throws(() => assertProjectImageFile({ type: 'image/png', size: PROJECT_MEDIA_MAX_BYTES + 1, name: 'big.png' } as File), /5 MB/)
})

test('buildProjectMediaPath is scoped to the team, project, kind, and uploader', () => {
  const path = buildProjectMediaPath({
    teamId: 'team-1',
    projectId: 'proj-1',
    kind: 'inspo',
    userId: 'user-1',
    file: { name: 'Gold Tone!!.PNG', type: 'image/png' } as File,
  })
  assert.match(path, /^team-1\/proj-1\/inspo\/user-1\/\d+-Gold-Tone\.png$/)
})

test('sample inspo and cover RPCs write only to sample tables', () => {
  const original = [...(sampleTables.project_inspo_images ?? [])]
  try {
    const added = sampleProjectMediaRpc('add_project_inspo_image', {
      p_project_id: 'sample-project-0',
      p_title: 'Window light',
      p_storage_path: 'sample-team/sample-project-0/inspo/dev-user/1-window.png',
      p_public_url: 'https://example.test/storage/v1/object/public/project-media/sample-team/sample-project-0/inspo/dev-user/1-window.png',
    })
    assert.equal(added?.status, 200)
    const row = added?.body as { id: string; title: string }
    assert.equal(row.title, 'Window light')
    assert.equal((sampleTables.project_inspo_images ?? []).some((item) => item.id === row.id), true)
    const removed = sampleProjectMediaRpc('delete_project_inspo_image', { p_image_id: row.id })
    assert.equal(removed?.status, 200)
    assert.equal((sampleTables.project_inspo_images ?? []).some((item) => item.id === row.id), false)
    const forbidden = sampleProjectMediaRpc('set_project_cover', { p_project_id: 'missing', p_cover_url: 'https://example.test/x' })
    assert.equal(forbidden?.status, 403)
    sampleDeleteInspo('not-there')
  } finally {
    sampleTables.project_inspo_images = original
  }
})
