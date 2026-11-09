import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_AREAS } from '../../../model/defaults'
import { DEFAULT_PREFS } from '../../../store/schema'
import { useStore } from '../../../store/useStore'
import { FocusRoom } from '../../FocusRoom'
import { TimeSense } from '../../TimeSense'
import type { FocusSession } from '../../types'
import { useRoom } from '../block'

const state = () => useStore.getState()

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})

beforeEach(() => {
  useStore.setState({
    areas: DEFAULT_AREAS.map((a) => ({ ...a })),
    tasks: [],
    focusTimer: null,
    roomTaskId: null,
    undoSnapshot: null,
    toast: null,
    prefs: DEFAULT_PREFS,
  })
  useRoom.setState({ block: null, ended: null })
})

afterEach(cleanup)

describe('FocusRoom', () => {
  it('opens on the task sent to it, then runs a guessed block with Park it and a rating', async () => {
    const user = userEvent.setup()
    state().addTask({ title: 'Laundry', horizon: 'today', high: true }, 'classes')
    const essay = state().addTask({ title: 'Essay', horizon: 'later' }, 'classes')
    useStore.setState({ roomTaskId: essay })
    render(<FocusRoom />)

    expect(screen.getByRole('heading', { name: 'Essay' })).toBeTruthy()
    expect(state().roomTaskId).toBeNull()

    await user.click(screen.getByRole('button', { name: '10 min' }))
    await user.click(screen.getByRole('button', { name: /Start 10 min/ }))
    expect(state().focusTimer?.taskId).toBe(essay)
    expect(screen.getByRole('timer').textContent).toContain('10:00')
    expect(screen.getByText(/I’ll sit with you while you work on Essay/)).toBeTruthy()

    await user.type(screen.getByRole('textbox', { name: 'Park it' }), 'call the dentist{Enter}')
    expect(state().tasks.find((t) => t.title === 'call the dentist')?.horizon).toBe('later')
    expect(within(screen.getByRole('list', { name: 'Parked this block' })).getByText('call the dentist')).toBeTruthy()

    // Pretend the block ran out two minutes ago, then wrap up: it counts the full 10.
    const timer = state().focusTimer!.timer
    state().updateFocusTimer({ ...timer, endsAt: Date.now() - 2 * 60_000 })
    await user.click(screen.getByRole('button', { name: /Stop and wrap up|Wrap up/ }))

    expect(state().focusTimer).toBeNull()
    expect(screen.getByRole('heading', { name: '10 min on Essay.' })).toBeTruthy()
    expect(screen.getByText('You guessed 10, it took 10. Right on.')).toBeTruthy()
    await user.click(screen.getByRole('radio', { name: /Focused/ }))
    expect(state().prefs.adhd.sessions[0]).toMatchObject({ title: 'Essay', guessMin: 10, actualMin: 10, rating: 4 })
    expect(state().tasks.find((t) => t.id === essay)?.spentMinutes).toBe(10)

    // Treat and break swap out the pressed button; focus lands on what replaced it.
    await user.click(screen.getAllByRole('button').find((b) => b.closest('.treatpick ul'))!)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: /A small treat/ }))
    await user.click(screen.getByRole('button', { name: 'Ninety seconds of moving' }))
    expect(screen.getByRole('heading', { level: 4 })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'End break' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ninety seconds of moving' }))
    await user.click(screen.getByRole('button', { name: /Mark “Essay” done/ }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Another block' }))

    await user.click(screen.getByRole('button', { name: 'Another block' }))
    expect(screen.getByRole('heading', { name: 'How long do you think this will take?' })).toBeTruthy()
  })

  it('says a block is running when another task is sent, and hands over to it after', async () => {
    const user = userEvent.setup()
    const a = state().addTask({ title: 'Essay' }, 'classes')
    const b = state().addTask({ title: 'Laundry' }, 'classes')
    state().startFocusTimer(a, 25, Date.now() - 5 * 60_000)
    render(<FocusRoom />)
    act(() => state().openRoom(b))

    expect(screen.getByText('A block on ‘Essay’ is running. Wrap it up to switch to ‘Laundry’.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Stop and wrap up|Wrap up/ }))
    await user.click(screen.getByRole('button', { name: 'Another block' }))
    expect(screen.getByRole('heading', { name: 'Laundry' })).toBeTruthy()
  })

  it('drops the wrap-up when you leave the room', async () => {
    const user = userEvent.setup()
    const id = state().addTask({ title: 'Essay' }, 'classes')
    state().startFocusTimer(id, 25, Date.now() - 5 * 60_000)
    const { unmount } = render(<FocusRoom />)
    await user.click(screen.getByRole('button', { name: /Stop and wrap up|Wrap up/ }))
    expect(useRoom.getState().ended).not.toBeNull()
    unmount()
    expect(useRoom.getState().ended).toBeNull()
  })

  it('resumes a running block when you come back', () => {
    const id = state().addTask({ title: 'Essay' }, 'classes')
    state().startFocusTimer(id, 25)
    render(<FocusRoom />)
    expect(screen.getByRole('timer')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Essay' })).toBeTruthy()
  })
})

const session = (over: Partial<FocusSession>): FocusSession => ({
  id: Math.random().toString(36),
  taskId: null,
  title: 'Essay',
  at: Date.now(),
  guessMin: 10,
  actualMin: 15,
  sound: 'none',
  companion: true,
  rating: null,
  ...over,
})

describe('TimeSense', () => {
  it('asks for three guesses first', () => {
    render(<TimeSense />)
    expect(screen.getByText('Make 3 guesses first')).toBeTruthy()
  })

  it('shows the ratio, pads a guess, and resets only after confirming', async () => {
    const user = userEvent.setup()
    useStore.setState({ prefs: { ...DEFAULT_PREFS, adhd: { ...DEFAULT_PREFS.adhd, sessions: [session({}), session({}), session({})] } } })
    render(<TimeSense />)
    expect(screen.getByText('You usually take 1.5× your guess')).toBeTruthy()
    expect(screen.getByText('last 15 min · best 15 min · 3 blocks')).toBeTruthy()

    await user.type(screen.getByRole('spinbutton', { name: 'My guess, in minutes' }), '20')
    expect(screen.getByText('Plan for about 30 min.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Reset my history' }))
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reset my history' }))
    await user.click(screen.getByRole('button', { name: 'Reset my history' }))
    expect(state().prefs.adhd.sessions).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Clear my history' }))
    expect(state().prefs.adhd.sessions).toHaveLength(0)
    expect(screen.getByText('Make 3 guesses first')).toBeTruthy()
  })
})
