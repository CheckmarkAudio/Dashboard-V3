import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
function worker({ offline = false } = {}) {
  const events = {}, added = [], deleted = [], fetched = []
  const cache = { add: async request => added.push(request.url), match: async () => new Response('public reconnect page') }
  vm.runInNewContext(source, {
    self: { addEventListener: (name, fn) => { events[name] = fn }, location: { origin: 'https://app.test' }, clients: { claim: async () => {} } },
    caches: { open: async () => cache, keys: async () => ['checkmark-reconnect-v0', 'unrelated-cache'], delete: async key => deleted.push(key) },
    Request: class extends Request { constructor(url, options) { super(new URL(url, 'https://app.test'), options) } },
    Response, URL,
    fetch: async request => { fetched.push(request.url); if (offline) throw new Error('offline'); return new Response('network content') },
  })
  return { events, added, deleted, fetched }
}
test('worker caches only the public reconnect page and cleans only its own old cache', async () => {
  const w = worker()
  let pending
  w.events.install({ waitUntil: promise => { pending = promise } }); await pending
  w.events.activate({ waitUntil: promise => { pending = promise } }); await pending
  assert.deepEqual(w.added, ['https://app.test/offline.html'])
  assert.deepEqual(w.deleted, ['checkmark-reconnect-v0'])
})
test('worker leaves APIs, writes, external URLs and private images entirely to the browser', () => {
  const w = worker()
  for (const request of [
    { url: 'https://backend.test/rest/v1/projects', method: 'GET', mode: 'cors' },
    { url: 'https://app.test/api/private', method: 'GET', mode: 'navigate' },
    { url: 'https://app.test/projects', method: 'POST', mode: 'navigate' },
    { url: 'https://app.test/private-image.png', method: 'GET', mode: 'no-cors' },
  ]) w.events.fetch({ request, respondWith: () => assert.fail('must not intercept private data') })
  assert.equal(w.fetched.length, 0)
})
test('navigation uses live network and failed navigation gets only public reconnect HTML', async () => {
  for (const offline of [false, true]) {
    const w = worker({ offline }); let response
    w.events.fetch({ request: { url: 'https://app.test/projects/one', method: 'GET', mode: 'navigate' }, respondWith: promise => { response = promise } })
    assert.equal(await (await response).text(), offline ? 'public reconnect page' : 'network content')
    assert.equal(w.added.length, 0)
  }
})
test('installed identity stays stable, opens Projects, and ships its declared icons', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
  assert.equal(manifest.id, '/')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/projects?source=app')
  for (const icon of manifest.icons) assert.ok(existsSync(new URL(`../public${icon.src}`, import.meta.url)))
})
