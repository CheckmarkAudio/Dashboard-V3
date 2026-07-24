import { test } from 'node:test'
import assert from 'node:assert/strict'

import { resolveEffectiveWorkWindows } from './effective.ts'
import type { ExpandedSchedule, ScheduleBlockKind, ScheduleBlockStatus } from '../../types/index.ts'

const MEMBER = 'member-1'
const DAY = '2026-07-24'

function entry(
  id: string,
  startHour: number,
  endHour: number,
  kind: ScheduleBlockKind = 'work',
  status: ScheduleBlockStatus = 'approved',
  memberId = MEMBER,
): ExpandedSchedule {
  return {
    key: id,
    member_id: memberId,
    starts_at: `${DAY}T${String(startHour).padStart(2, '0')}:00:00.000Z`,
    ends_at: `${DAY}T${String(endHour).padStart(2, '0')}:00:00.000Z`,
    source: kind === 'work' ? 'recurring' : 'block',
    source_id: id,
    status,
    kind,
    note: null,
  }
}

function hours(result: ReturnType<typeof resolveEffectiveWorkWindows>) {
  return result.map(({ start, end }) => [
    new Date(start).getUTCHours(),
    new Date(end).getUTCHours(),
  ])
}

test('approved time off splits a recurring work window', () => {
  const result = resolveEffectiveWorkWindows([
    entry('work', 9, 17),
    entry('lunch-off', 12, 13, 'time_off'),
  ], MEMBER)

  assert.deepEqual(hours(result), [[9, 12], [13, 17]])
})

test('full-day approved time off removes the work window', () => {
  const result = resolveEffectiveWorkWindows([
    entry('work', 9, 17),
    entry('day-off', 8, 18, 'time_off'),
  ], MEMBER)

  assert.deepEqual(result, [])
})

test('pending and denied time off do not alter approved work', () => {
  const result = resolveEffectiveWorkWindows([
    entry('work', 9, 17),
    entry('pending-off', 10, 12, 'time_off', 'pending'),
    entry('denied-off', 13, 15, 'time_off', 'denied'),
  ], MEMBER)

  assert.deepEqual(hours(result), [[9, 17]])
})

test('overlapping work windows are merged before time off is subtracted', () => {
  const result = resolveEffectiveWorkWindows([
    entry('work-a', 9, 14),
    entry('work-b', 13, 17),
    entry('time-off', 11, 15, 'time_off'),
  ], MEMBER)

  assert.deepEqual(hours(result), [[9, 11], [15, 17]])
})

test('other members and malformed intervals are ignored', () => {
  const malformed = entry('bad', 9, 10)
  malformed.ends_at = 'not-a-date'

  const result = resolveEffectiveWorkWindows([
    entry('mine', 9, 17),
    entry('theirs', 9, 17, 'work', 'approved', 'member-2'),
    malformed,
  ], MEMBER)

  assert.deepEqual(hours(result), [[9, 17]])
})
