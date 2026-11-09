import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_AREAS } from '../../../model/defaults'
import { DEFAULT_PREFS } from '../../../store/schema'
import { useStore } from '../../../store/useStore'
import { beginBlock, ensureBlock, finishBlock, parkThought, useRoom } from '../block'

const MIN = 60_000
const state = () => useStore.getState()
const T0 = 1_800_000_000_000

beforeEach(() => {
  useStore.setState({ areas: DEFAULT_AREAS.map((a) => ({ ...a })), tasks: [], focusTimer: null, undoSnapshot: null, toast: null, prefs: DEFAULT_PREFS })
  useRoom.setState({ block: null, ended: null })
})

describe('Focus room block', () => {
  it('logs the block with the guess and worked minutes, and credits the task once', () => {
    const id = state().addTask({ title: 'Essay', steps: [] }, 'classes')
    state().addStep(id, 'Outline')
    state().addStep(id, 'Intro')
    beginBlock(id, 10, 10, T0)
    state().updateStep(id, state().tasks[0]!.steps[0]!.id, { done: true })

    finishBlock({}, T0 + 18 * MIN)

    const [session] = state().prefs.adhd.sessions
    expect(session).toMatchObject({ taskId: id, title: 'Essay', at: T0, guessMin: 10, actualMin: 10, sound: 'none', rating: null })
    expect(state().focusTimer).toBeNull()
    expect(state().tasks[0]!.spentMinutes).toBe(10)
    expect(useRoom.getState()).toMatchObject({ block: null, ended: { minutes: 10, stepsDone: 1, sessionId: session!.id } })
  })

  it('does not log a block under a minute, but still ends the timer', () => {
    const id = state().addTask({ title: 'Essay' }, 'classes')
    beginBlock(id, 5, null, T0)
    finishBlock({}, T0 + 10_000)
    expect(state().prefs.adhd.sessions).toHaveLength(0)
    expect(state().focusTimer).toBeNull()
    expect(useRoom.getState().ended).toMatchObject({ minutes: 0, sessionId: null })
  })

  it('picks up a timer started elsewhere, using its length as the first length', () => {
    const id = state().addTask({ title: 'Essay' }, 'classes')
    state().startFocusTimer(id, 25, T0)
    expect(ensureBlock(T0 + 5 * MIN)).toMatchObject({ taskId: id, guessMin: null, startMin: 25, at: T0 })
  })

  it('parks a thought as a Later task and lists it for this block', () => {
    const id = state().addTask({ title: 'Essay' }, 'classes')
    beginBlock(id, 15, null)
    const parked = parkThought('email the professor')
    const task = state().tasks.find((t) => t.id === parked)
    expect(task).toMatchObject({ title: 'email the professor', horizon: 'later' })
    expect(useRoom.getState().block?.parked).toEqual([{ id: parked, title: 'email the professor' }])
    expect(parkThought('   ')).toBeNull()
  })
})
