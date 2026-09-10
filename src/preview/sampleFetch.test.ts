import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sampleFetch } from './sampleFetch.ts'

test('sample writes and unknown RPCs fail without touching the network', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('Network must not be used') }
  try {
    for (const [path, method] of [
      ['/rest/v1/chat_messages','POST'], ['/rest/v1/team_members','PATCH'], ['/rest/v1/sessions','DELETE'],
      ['/rest/v1/rpc/complete_assigned_task','POST'], ['/functions/v1/upload-to-dropbox','POST'], ['/auth/v1/user','PUT'],
    ]) {
      const response = await sampleFetch(`https://example.test${path}`, {method})
      assert.equal(response.status, 403)
      assert.equal((await response.json()).code, 'SAMPLE_READ_ONLY')
    }
    assert.equal(calls, 0)
  } finally { globalThis.fetch = originalFetch }
})
test('profile and date filters return only matching sample records', async () => {
  const profile = await sampleFetch('https://example.test/rest/v1/team_members?id=eq.dev-user', {headers:{Accept:'application/vnd.pgrst.object+json'}})
  assert.equal((await profile.json()).display_name, 'Dev Admin')
  const empty = await sampleFetch('https://example.test/rest/v1/sessions?session_date=gte.2099-01-01')
  assert.deepEqual(await empty.json(), [])
})
test('public channels exclude private messages', async () => {
  const response = await sampleFetch('https://example.test/rest/v1/chat_messages?channel_id=eq.sample-channel-0')
  const messages = await response.json()
  assert.equal(messages.length, 3)
  assert.ok(messages.every((row: {channel_id:string}) => row.channel_id === 'sample-channel-0'))
})
test('sample personal queues do not show another member’s assigned tasks', async () => {
  const response = await sampleFetch('https://example.test/rest/v1/rpc/get_member_assigned_tasks', {method:'POST',body:JSON.stringify({p_user_id:'another-member'})})
  assert.deepEqual(await response.json(), [])
})
