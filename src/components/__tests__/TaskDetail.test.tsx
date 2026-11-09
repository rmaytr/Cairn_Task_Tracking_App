import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_AREAS } from '../../model/defaults'
import { useStore } from '../../store/useStore'
import { TaskDetail } from '../TaskDetail'

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})

beforeEach(() => {
  useStore.setState({ areas: DEFAULT_AREAS.map((a) => ({ ...a })), tasks: [], selectedId: null, undoSnapshot: null, toast: null })
})

afterEach(cleanup)

describe('TaskDetail if-then plan', () => {
  it('keeps the plan field while you clear it and type a new one', async () => {
    const user = userEvent.setup()
    const id = useStore.getState().addTask({ title: 'Essay', plan: 'after lunch' }, 'classes')
    useStore.setState({ selectedId: id })
    render(<TaskDetail />)

    const field = screen.getByRole('textbox', { name: 'If-then plan' })
    await user.clear(field)
    expect(useStore.getState().tasks[0]!.plan).toBeNull()
    await user.type(screen.getByRole('textbox', { name: 'If-then plan' }), 'at 9')
    expect(useStore.getState().tasks[0]!.plan).toBe('at 9')
  })
})
