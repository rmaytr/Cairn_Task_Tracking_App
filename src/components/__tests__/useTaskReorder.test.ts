import { beforeEach, describe, expect, it } from 'vitest'
import { todayISO } from '../../lib/dates'
import { DEFAULT_AREAS } from '../../model/defaults'
import type { Task } from '../../model/types'
import { DEFAULT_PREFS } from '../../store/schema'
import { useStore } from '../../store/useStore'
import { commitTaskOrder, sortItems } from '../useTaskReorder'

const state = () => useStore.getState()
const now = new Date(2026, 10, 9, 10)
const task = (id: string) => state().tasks.find((t) => t.id === id)!
const add = (title: string, horizon: 'today' | 'week' = 'today', due?: string) =>
  state().addTask({ title, horizon, ...(due && { due }) }, 'classes')
const TODAY = { key: 'today', title: 'Today', horizon: 'today' as const }
const WEEK = { key: 'week', title: 'This week', horizon: 'week' as const }

beforeEach(() => {
  useStore.setState({ areas: DEFAULT_AREAS.map((a) => ({ ...a })), tasks: [], undoSnapshot: null, toast: null, prefs: DEFAULT_PREFS })
})

describe('commitTaskOrder', () => {
  it('in another sort, reordering switches to My order and says so', () => {
    const [a, b] = [add('A'), add('B')]
    const said = commitTaskOrder([b, a], b, TODAY, false, { sort: 'smart', reverse: false }, now)
    expect(task(b).rank!).toBeLessThan(task(a).rank!)
    expect(state().toast).toMatchObject({ message: 'Switched to My order', undoable: true })
    expect(state().prefs.listSort).toEqual({ sort: 'manual', reverse: false })
    expect(said).toBe('Moved ‘B’ to position 1 of 2')
  })

  it('in another sort, a move to another horizon keeps the sort and notes a due date that holds it closer', () => {
    const a = add('A', 'today', todayISO(now))
    const said = commitTaskOrder([a], a, WEEK, true, { sort: 'smart', reverse: false }, now)
    expect(task(a)).toMatchObject({ horizon: 'week' })
    expect(task(a).rank).toBeUndefined()
    expect(state().toast?.message).toBe('Moved to This week (due date keeps it closer)')
    expect(state().prefs.listSort.sort).toBe('smart')
    expect(said).toBe('Moved ‘A’ to This week')
  })

  it('in My order, a move to another horizon sets the horizon and the rank in one undo', () => {
    const [a, b] = [add('A'), add('B', 'week')]
    commitTaskOrder([b, a], b, TODAY, true, { sort: 'manual', reverse: false }, now)
    expect(task(b)).toMatchObject({ horizon: 'today' })
    expect(task(b).rank!).toBeLessThan(task(a).rank!)
    expect(state().toast?.message).toBe('Moved to Today')
    state().undo()
    expect(task(b)).toMatchObject({ horizon: 'week' })
    expect(task(b).rank).toBeUndefined()
  })

  it('in reversed My order, stamps ranks so the reversed list shows what the user made', () => {
    const [a, b] = [add('A'), add('B')]
    commitTaskOrder([a, b], a, TODAY, false, { sort: 'manual', reverse: true }, now)
    expect(task(b).rank!).toBeLessThan(task(a).rank!)
  })
})

describe('sortItems', () => {
  const item = (id: string, rank?: number) => ({ task: { id, rank } as unknown as Task })
  it('in My order puts ranked tasks first, then the rest in planner order; reverse flips it', () => {
    const items = [item('p'), item('r2', 2), item('q'), item('r1', 1)]
    expect(sortItems(items, 'manual', false).map((i) => i.task.id)).toEqual(['r1', 'r2', 'p', 'q'])
    expect(sortItems(items, 'manual', true).map((i) => i.task.id)).toEqual(['q', 'p', 'r2', 'r1'])
    expect(sortItems(items, 'smart', false)).toEqual(items)
  })
})
