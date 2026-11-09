import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFocusTimer } from '../appEffects'
import { chime } from '../lib/feedback'
import { DEFAULT_PREFS } from '../store/schema'
import { useStore } from '../store/useStore'

vi.mock('../lib/feedback', () => ({ chime: vi.fn(), tock: vi.fn(), warmAudio: vi.fn() }))

const MIN = 60_000
const state = () => useStore.getState()

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(chime).mockClear()
  useStore.setState({ tasks: [], focusTimer: null, undoSnapshot: null, toast: null, prefs: { ...DEFAULT_PREFS, feedback: { sound: true, haptics: false } } })
})
afterEach(() => vi.useRealTimers())

describe('useFocusTimer', () => {
  it('chimes once when the timer ends, on any view', () => {
    renderHook(() => useFocusTimer())
    const id = state().addTask({ title: 'Read' }, 'classes')
    act(() => state().startFocusTimer(id, 5))
    vi.advanceTimersByTime(5 * MIN - 1)
    expect(chime).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(chime).toHaveBeenCalledTimes(1)
  })

  it('stays silent with sound off, and never fires for a stopped timer', () => {
    renderHook(() => useFocusTimer())
    const id = state().addTask({ title: 'Read' }, 'classes')
    act(() => state().startFocusTimer(id, 5))
    act(() => state().endFocusTimer())
    vi.advanceTimersByTime(10 * MIN)
    act(() => state().setPrefs({ feedback: { ...state().prefs.feedback, sound: false } }))
    act(() => state().startFocusTimer(id, 5))
    vi.advanceTimersByTime(10 * MIN)
    expect(chime).not.toHaveBeenCalled()
  })

  it('credits and clears the timer when its task is completed or deleted elsewhere', () => {
    renderHook(() => useFocusTimer())
    const id = state().addTask({ title: 'Essay' }, 'classes')
    act(() => state().startFocusTimer(id, 25))
    vi.advanceTimersByTime(7 * MIN)
    // Sync marks it done without going through setDone.
    act(() => state().applySynced({ areas: state().areas, tasks: state().tasks.map((t) => ({ ...t, done: true })), tombstones: [] }))
    expect(state().focusTimer).toBeNull()
    expect(state().tasks[0]?.spentMinutes).toBe(7)

    const other = state().addTask({ title: 'Other' }, 'classes')
    act(() => state().startFocusTimer(other, 25))
    act(() => state().deleteTask(other))
    expect(state().focusTimer).toBeNull()
  })
})
