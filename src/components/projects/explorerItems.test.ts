import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ProjectTool } from '../../domain/projectTools/model.ts'
import { collectExplorerItems, explorerStats } from './explorerItems.ts'

const tools: ProjectTool[] = [
  { id: 'm', type: 'measurements', title: 'Measurements', wide: false, entries: [
    { id: 'c', name: 'Closet opening', width: '34', depth: '18', height: '72', unit: 'in', notes: '' },
  ] },
  { id: 's', type: 'shopping', title: 'Shopping list', wide: false, items: [
    { id: 'shelf', name: 'Storage shelf', done: false, measurementId: 'c' },
    { id: 'lamp', name: 'Desk lamp', done: true, measurementId: null },
  ] },
  { id: 'n', type: 'note', title: 'Studio ideas', wide: false, text: 'Warm lighting.' },
  { id: 'k', type: 'sketch', title: 'Room sketch', wide: true, strokes: [], text: '' },
  { id: 't', type: 'tasks', title: 'Next steps', wide: false, objectiveId: null },
]

test('collectExplorerItems groups tools, tasks, and inspo as clickable tiles', () => {
  const items = collectExplorerItems({
    summary: 'Mix and master the record.',
    tasks: [{ id: 'task-1', title: 'Review the latest mix', is_completed: false }],
    tools,
    inspo: [{ id: 'mood', title: 'Gold tone', src: '/project-art/gold-mic.svg' }],
  })
  assert.equal(items.find((item) => item.section === 'summary')?.title, 'Project summary')
  assert.equal(items.filter((item) => item.section === 'tasks').length, 1)
  assert.equal(items.filter((item) => item.section === 'measurements').length, 1)
  assert.equal(items.filter((item) => item.section === 'shopping').length, 2)
  assert.equal(items.some((item) => item.section === 'notes' && item.title === 'Studio ideas'), true)
  assert.equal(items.some((item) => item.section === 'blueprints' && item.title === 'Room sketch'), true)
  assert.equal(items.some((item) => item.section === 'inspo' && item.title === 'Gold tone'), true)
  // Task tools themselves are not tiles; the real project tasks are.
  assert.equal(items.some((item) => item.toolId === 't'), false)
})

test('explorerStats counts open tasks, shopping, and total tiles', () => {
  const items = collectExplorerItems({
    summary: 'A plan',
    tasks: [
      { id: 'a', title: 'Open', is_completed: false },
      { id: 'b', title: 'Done', is_completed: true },
    ],
    tools,
    inspo: [],
  })
  const stats = explorerStats(items, 0, 3)
  assert.equal(stats.objectivesDone, 0)
  assert.equal(stats.objectivesTotal, 3)
  assert.equal(stats.tasksOpen, 1)
  assert.equal(stats.tasksTotal, 2)
  assert.equal(stats.shoppingDone, 1)
  assert.equal(stats.shoppingTotal, 2)
  assert.ok(stats.itemCount >= 7)
})
