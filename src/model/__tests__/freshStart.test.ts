import { describe, expect, it } from 'vitest'
import { makeTask, NOW } from '../../plan/__tests__/fixtures'
import { moveAllToToday, notNow, overdueTasks, spreadOverWeek } from '../freshStart'
import type { Task } from '../types'

// NOW is Wednesday 2026-10-21.
const late = (id: string, extra: Partial<Task> = {}): Task => makeTask(id, { due: '2026-10-10', ...extra })

describe('fresh start', () => {
  it('finds open tasks due before today only', () => {
    const tasks = [late('a'), late('done', { done: true }), makeTask('today', { due: '2026-10-21' }), makeTask('none')]
    expect(overdueTasks(tasks, NOW).map((t) => t.id)).toEqual(['a'])
  })

  it('moves everything to today', () => {
    expect(moveAllToToday([late('a'), late('b')], NOW)).toEqual([
      { id: 'a', patch: { due: '2026-10-21', horizon: 'today' } },
      { id: 'b', patch: { due: '2026-10-21', horizon: 'today' } },
    ])
  })

  it('spreads one per day from today when there are few, priority first', () => {
    const plan = spreadOverWeek([late('low', { low: true }), late('norm'), late('hi', { high: true })], NOW)
    expect(plan.map((p) => [p.id, p.patch.due])).toEqual([
      ['hi', '2026-10-21'],
      ['norm', '2026-10-22'],
      ['low', '2026-10-23'],
    ])
    expect(plan[0]?.patch.horizon).toBe('today')
    expect(plan[1]?.patch.horizon).toBe('week')
  })

  it('uses two per day for a bigger pile and stays within seven days', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => late(`t${i}`))
    const dates = spreadOverWeek(tasks, NOW).map((p) => p.patch.due ?? '')
    expect(dates.filter((d) => d === '2026-10-21')).toHaveLength(2)
    expect(new Set(dates).size).toBeLessThanOrEqual(7)
    expect(dates.every((d) => d >= '2026-10-21' && d <= '2026-10-27')).toBe(true)
  })

  it('breaks priority ties by oldest date', () => {
    const plan = spreadOverWeek([late('new', { due: '2026-10-15' }), late('old', { due: '2026-10-02' })], NOW)
    expect(plan.map((p) => p.id)).toEqual(['old', 'new'])
  })

  it('"not now" parks tasks in someday with no date', () => {
    expect(notNow([late('a')])).toEqual([{ id: 'a', patch: { horizon: 'someday', due: null } }])
  })
})
