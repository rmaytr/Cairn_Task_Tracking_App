import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_AREAS } from '../../model/defaults'
import { sanitizePersisted } from '../schema'
import { useStore } from '../useStore'

const state = () => useStore.getState()

beforeEach(() => {
  useStore.setState({
    areas: DEFAULT_AREAS.map((a) => ({ ...a })),
    tasks: [],
    undoSnapshot: null,
    toast: null,
    selectedId: null,
  })
})

describe('tasks', () => {
  it('adds a task with defaults and marks the user onboarded', () => {
    const id = state().addTask({ title: 'Write essay' }, 'classes')
    const task = state().tasks.find((t) => t.id === id)
    expect(task).toMatchObject({ title: 'Write essay', areaId: 'classes', horizon: 'week', effort: 'm', done: false })
    expect(state().prefs.onboarded).toBe(true)
  })

  it('keeps a repeat parsed at capture', () => {
    const id = state().addTask({ title: 'Water plants', repeat: 'weekly' }, 'life')
    expect(state().tasks.find((t) => t.id === id)?.repeat).toBe('weekly')
    const plain = state().addTask({ title: 'Buy milk', repeat: 'none' }, 'life')
    expect(state().tasks.find((t) => t.id === plain)).not.toHaveProperty('repeat')
  })

  it('completes a task, records the ripple, and undoes it', () => {
    const id = state().addTask({ title: 'Ship it' }, 'projects')
    state().setDone(id, true)
    expect(state().tasks[0].done).toBe(true)
    expect(state().lastCompleted?.id).toBe(id)
    expect(state().toast?.undoable).toBe(true)
    state().undo()
    expect(state().tasks[0].done).toBe(false)
    expect(state().undoSnapshot).toBeNull()
  })

  it('moves a task across rings and areas with undo, ignoring no-op moves', () => {
    const id = state().addTask({ title: 'Plan event' }, 'orgs')
    state().moveTask(id, { horizon: 'week', areaId: 'orgs' })
    expect(state().toast).toBeNull()
    state().moveTask(id, { horizon: 'today', areaId: 'career' })
    expect(state().tasks[0]).toMatchObject({ horizon: 'today', areaId: 'career' })
    state().undo()
    expect(state().tasks[0]).toMatchObject({ horizon: 'week', areaId: 'orgs' })
  })

  it('deletes a task and clears the selection', () => {
    const id = state().addTask({ title: 'Temp' }, 'life')
    state().select(id)
    state().deleteTask(id)
    expect(state().tasks).toHaveLength(0)
    expect(state().selectedId).toBeNull()
  })

  it('adds, edits and removes steps, ignoring blank ones', () => {
    const id = state().addTask({ title: 'Apply' }, 'career')
    state().addStep(id, '  ')
    state().addStep(id, 'Get rec letter')
    const stepId = state().tasks[0].steps[0].id
    state().updateStep(id, stepId, { done: true })
    expect(state().tasks[0].steps).toEqual([{ id: stepId, title: 'Get rec letter', done: true }])
    state().deleteStep(id, stepId)
    expect(state().tasks[0].steps).toHaveLength(0)
  })
})

describe('v3 ADHD helpers', () => {
  it('counts snoozes and keeps the count through undo', () => {
    const id = state().addTask({ title: 'Stuck' }, 'life')
    state().snoozeTask(id)
    state().snoozeTask(id)
    expect(state().tasks[0].snoozes).toBe(2)
    state().undo()
    expect(state().tasks[0].snoozes).toBe(1)
  })

  it('patchTasks changes several tasks as one undoable step', () => {
    const a = state().addTask({ title: 'A' }, 'life')
    const b = state().addTask({ title: 'B' }, 'life')
    state().patchTasks([{ id: a, patch: { horizon: 'someday', due: null } }, { id: b, patch: { horizon: 'someday', due: null } }], 'Moved 2')
    expect(state().tasks.every((t) => t.horizon === 'someday')).toBe(true)
    state().undo()
    expect(state().tasks.every((t) => t.horizon === 'week')).toBe(true)
  })

  it('defaults feedback prefs when missing', () => {
    expect(sanitizePersisted({ prefs: { feedback: 'junk' } }).prefs.feedback).toEqual({ sound: false, haptics: true })
  })
})

describe('bulk import', () => {
  it('adds many tasks at once and undoes them together', () => {
    state().addTask({ title: 'Existing' }, 'life')
    const count = state().addTasks([
      { draft: { title: 'A' }, areaId: 'classes' },
      { draft: { title: 'B', horizon: 'today' }, areaId: 'orgs' },
    ])
    expect(count).toBe(2)
    expect(state().tasks.map((t) => t.title)).toEqual(['Existing', 'A', 'B'])
    expect(state().tasks[1].horizon).toBe('later')
    state().undo()
    expect(state().tasks.map((t) => t.title)).toEqual(['Existing'])
  })

  it('replaces current tasks but keeps areas the new tasks point at', () => {
    state().addTask({ title: 'Old' }, 'life')
    const gym = { id: 'gym', name: 'Gym', color: 'sky' as const }
    state().addTasks([{ draft: { title: 'Lift' }, areaId: 'gym' }], { replace: true, newAreas: [gym] })
    expect(state().tasks.map((t) => t.title)).toEqual(['Lift'])
    expect(state().areas.map((a) => a.id)).toContain('gym')
  })
})

describe('areas', () => {
  it('adds an area with an unused color and caps the count', () => {
    const id = state().addArea('Gym')
    const area = state().areas.find((a) => a.id === id)
    expect(area?.color).toBe('sky')
    state().addArea('Two')
    expect(state().addArea('Three')).toBeNull()
  })

  it('deleting an area moves its tasks to another area', () => {
    state().addTask({ title: 'Call home' }, 'life')
    state().deleteArea('life', 'orgs')
    expect(state().areas.some((a) => a.id === 'life')).toBe(false)
    expect(state().tasks[0].areaId).toBe('orgs')
  })
})

describe('sanitizePersisted', () => {
  it('falls back to defaults for garbage', () => {
    const result = sanitizePersisted('nonsense')
    expect(result.areas).toHaveLength(DEFAULT_AREAS.length)
    expect(result.tasks).toEqual([])
  })

  it('drops invalid tasks individually and re-homes orphans', () => {
    const good = {
      id: '1', title: 'Fine', notes: '', areaId: 'gone', horizon: 'week', due: null, high: false, effort: 'm',
      waiting: null, plan: null, steps: [], done: false, doneAt: null, createdAt: 1, updatedAt: 1, spentMinutes: 0,
    }
    const result = sanitizePersisted({
      areas: [{ id: 'a', name: 'A', color: 'indigo' }],
      tasks: [good, { id: 2 }, null, { ...good, id: '3', horizon: 'bogus', due: 'not-a-date' }],
    })
    expect(result.tasks.map((t) => t.id)).toEqual(['1', '3'])
    expect(result.tasks.every((t) => t.areaId === 'a')).toBe(true)
    expect(result.tasks[1]).toMatchObject({ horizon: 'later', due: null })
  })

  it('un-hides areas hidden by the old sidebar, which has no way to show them again', () => {
    const result = sanitizePersisted({ prefs: { hiddenAreas: ['classes', 'life'] } })
    expect(result.prefs.hiddenAreas).toEqual([])
  })
})

describe('dependencies', () => {
  const after = (id: string) => state().tasks.find((t) => t.id === id)?.after
  const assist = (taskId: string, extra: { after?: string[]; blocks?: string[] }) =>
    state().applyAssist({ taskId, patch: extra.after ? { after: extra.after } : {}, steps: [], blocks: extra.blocks ?? [], extras: [], message: 'Sorted' })

  it('never lets the assistant create a loop', () => {
    const a = state().addTask({ title: 'A' }, 'life')
    const b = state().addTask({ title: 'B' }, 'life')
    state().addDependencies([{ taskId: a, after: [b] }])
    const t = state().addTask({ title: 'New' }, 'life')
    // New after A, and B after New, would close B -> New -> A -> B.
    assist(t, { after: [a], blocks: [b] })
    expect(after(t)).toEqual([a])
    expect(after(b)).toBeUndefined()
  })

  it('keeps existing links and ignores ids that do not exist', () => {
    const a = state().addTask({ title: 'A' }, 'life')
    const t = state().addTask({ title: 'T' }, 'life')
    state().addDependencies([{ taskId: t, after: [a] }])
    assist(t, { after: ['ghost'] })
    expect(after(t)).toEqual([a])
  })

  it('caps how many existing tasks one capture can make wait', () => {
    const others = Array.from({ length: 8 }, (_, i) => state().addTask({ title: `O${i}` }, 'life'))
    const t = state().addTask({ title: 'T' }, 'life')
    assist(t, { blocks: others })
    expect(others.filter((id) => after(id)?.includes(t))).toHaveLength(5)
  })

  it('unlinks dependents when a task is deleted', () => {
    const a = state().addTask({ title: 'A' }, 'life')
    const b = state().addTask({ title: 'B' }, 'life')
    state().addDependencies([{ taskId: b, after: [a] }])
    state().deleteTask(a)
    expect(after(b)).toBeUndefined()
  })

  it('a link that changes nothing keeps the pending Undo', () => {
    const a = state().addTask({ title: 'A' }, 'life')
    const b = state().addTask({ title: 'B' }, 'life')
    state().addDependencies([{ taskId: b, after: [a] }])
    const toast = state().toast
    state().addDependencies([{ taskId: b, after: [a] }, { taskId: a, after: [b] }])
    expect(state().toast).toBe(toast)
  })
})

describe('moveArea', () => {
  it('moves an area up or down and stops at the ends', () => {
    const ids = () => state().areas.map((a) => a.id)
    const [first, second] = ids()
    state().moveArea(second!, -1)
    expect(ids().slice(0, 2)).toEqual([second, first])
    state().moveArea(second!, -1)
    expect(ids()[0]).toBe(second)
    const last = ids().at(-1)!
    state().moveArea(last, 1)
    expect(ids().at(-1)).toBe(last)
  })
})

describe('reorderTasks', () => {
  const add = (title: string, horizon: 'today' | 'week' = 'today') => state().addTask({ title, horizon }, 'classes')
  const rankOf = (id: string) => state().tasks.find((t) => t.id === id)?.rank

  it('stamps ranks in the given order as one undoable change', () => {
    const [a, b, c] = [add('A'), add('B'), add('C')]
    state().reorderTasks([c, a, b], c, undefined, 'Switched to My order')
    expect(rankOf(c)!).toBeLessThan(rankOf(a)!)
    expect(rankOf(a)!).toBeLessThan(rankOf(b)!)
    expect(state().toast).toMatchObject({ message: 'Switched to My order', undoable: true })
    state().undo()
    expect([a, b, c].map(rankOf)).toEqual([undefined, undefined, undefined])
  })

  it('later moves change only the moved task', () => {
    const [a, b, c] = [add('A'), add('B'), add('C')]
    state().reorderTasks([a, b, c], a)
    const before = state().tasks.map((t) => ({ ...t }))
    state().reorderTasks([a, c, b], c)
    const changed = state().tasks.filter((t, i) => t.rank !== before[i]?.rank).map((t) => t.id)
    expect(changed).toEqual([c])
  })

  it('moves the task to another horizon in the same undo step', () => {
    const [a, b] = [add('A'), add('B', 'week')]
    state().reorderTasks([b, a], b, { horizon: 'today' }, 'Moved to Today')
    expect(state().tasks.find((t) => t.id === b)).toMatchObject({ horizon: 'today' })
    state().undo()
    expect(state().tasks.find((t) => t.id === b)).toMatchObject({ horizon: 'week' })
    expect(rankOf(b)).toBeUndefined()
  })

  it('does nothing (and keeps a pending undo) when nothing would change', () => {
    const [a, b] = [add('A'), add('B')]
    state().reorderTasks([a, b], a)
    const toast = state().toast
    state().reorderTasks([a, b], a)
    expect(state().toast).toBe(toast)
  })
})

describe('moveStep', () => {
  it('moves a step within its task, clamped, with undo', () => {
    const id = state().addTask({ title: 'Essay', steps: [{ title: 'one' }, { title: 'two' }, { title: 'three' }] }, 'classes')
    const titles = () => state().tasks[0].steps.map((s) => s.title)
    const third = state().tasks[0].steps[2].id
    state().moveStep(id, third, 0)
    expect(titles()).toEqual(['three', 'one', 'two'])
    state().moveStep(id, third, 99)
    expect(titles()).toEqual(['one', 'two', 'three'])
    state().undo()
    expect(titles()).toEqual(['three', 'one', 'two'])
  })
})

describe('list sort prefs', () => {
  it('keeps a saved sort and falls back to smart order for junk', () => {
    expect(sanitizePersisted({ prefs: { listSort: { sort: 'manual', reverse: true } } }).prefs.listSort).toEqual({ sort: 'manual', reverse: true })
    expect(sanitizePersisted({ prefs: { listSort: { sort: 'nope' } } }).prefs.listSort).toEqual({ sort: 'smart', reverse: false })
  })

  it('keeps a task rank and drops a broken one', () => {
    const base = { id: 't', title: 'T', areaId: 'classes', createdAt: 1, updatedAt: 1 }
    const { tasks } = sanitizePersisted({ tasks: [{ ...base, rank: 2.5 }, { ...base, id: 'u', rank: 'x' }] })
    expect(tasks.map((t) => t.rank)).toEqual([2.5, undefined])
  })
})
