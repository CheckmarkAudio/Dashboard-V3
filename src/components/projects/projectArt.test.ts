import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectInitials, resolveProjectArt, scoreProjectArt, PROJECT_ART_CATALOG, artTransitionName } from './projectArt.ts'

test('custom cover_url wins over catalog art', () => {
  const art = resolveProjectArt({ id: 'x', title: 'Echoes in Gold', cover_url: 'https://example.test/cover.jpg' })
  assert.equal(art.custom, true)
  assert.equal(art.src, 'https://example.test/cover.jpg')
})

test('sample project titles pick distinct fitting catalog art', () => {
  const picks = {
    'Echoes in Gold': 'gold-mic',
    'After Hours EP': 'after-hours',
    'The Long Way Home': 'vinyl',
    'Northline Sessions': 'live-stage',
    'Holiday Special': 'piano',
    'Studio B Refresh': 'studio-room',
  }
  const used = new Set<string>()
  for (const [title, expected] of Object.entries(picks)) {
    const art = resolveProjectArt({ id: `id-${title}`, title, objective: '' })
    assert.equal(art.id, expected, `${title} should use ${expected}, got ${art.id}`)
    used.add(art.id)
  }
  assert.equal(used.size, Object.keys(picks).length)
})

test('unknown projects fall back to a stable hashed catalog image', () => {
  const one = resolveProjectArt({ id: 'abc-123', title: 'Untitled work' })
  const again = resolveProjectArt({ id: 'abc-123', title: 'Untitled work' })
  const other = resolveProjectArt({ id: 'xyz-9', title: 'Something else' })
  assert.equal(one.id, again.id)
  assert.equal(one.custom, false)
  assert.ok(PROJECT_ART_CATALOG.some((item) => item.src === one.src))
  assert.ok(one.id === other.id || one.src !== other.src)
})

test('artTransitionName is a valid CSS ident for uuid and sample ids', () => {
  assert.equal(artTransitionName('sample-project-0'), 'partsampleproject0')
  assert.match(artTransitionName('08246cc1-4bd1-4f11-8e65-87a1f0d0d959'), /^part[a-zA-Z0-9]+$/)
})

test('title phrases outrank generic description keywords', () => {
  const gold = PROJECT_ART_CATALOG.find((item) => item.id === 'gold-mic')!
  const mix = PROJECT_ART_CATALOG.find((item) => item.id === 'mix-desk')!
  const title = 'echoes in gold'
  const description = 'mix and master the record for release'
  assert.ok(scoreProjectArt(gold, title, description) > scoreProjectArt(mix, title, description))
})

test('projectInitials still uses significant title words', () => {
  assert.equal(projectInitials('Echoes in Gold'), 'EG')
  assert.equal(projectInitials('Solo'), 'SO')
})
