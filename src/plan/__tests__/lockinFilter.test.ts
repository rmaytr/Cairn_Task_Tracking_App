import { describe, expect, it } from 'vitest'
import { filterByEffort } from '../lockin'
import { makeTask } from './fixtures'

const tasks = [makeTask('s', { effort: 's' }), makeTask('m'), makeTask('l', { effort: 'l' })]

describe('filterByEffort', () => {
  it('keeps everything for "any"', () => expect(filterByEffort(tasks, 'any')).toHaveLength(3))
  it('keeps quick wins (effort s)', () => expect(filterByEffort(tasks, 'quick').map((t) => t.id)).toEqual(['s']))
  it('keeps big pushes (effort l)', () => expect(filterByEffort(tasks, 'big').map((t) => t.id)).toEqual(['l']))
  it('ignores done tasks', () => {
    expect(filterByEffort([makeTask('d', { effort: 's', done: true })], 'quick')).toHaveLength(0)
  })
})
