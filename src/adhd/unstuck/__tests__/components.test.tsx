import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../../store/useStore'
import { MovementSnack } from '../../MovementSnack'
import { TreatMenu } from '../../TreatMenu'
import { TreatPicker } from '../../TreatPicker'
import { DEFAULT_TREATS } from '../../types'

beforeEach(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never
  useStore.getState().setAdhd({ treats: [...DEFAULT_TREATS], sessions: [] })
})
afterEach(cleanup)

describe('TreatMenu', () => {
  it('adds a treat, then resets to defaults only after confirming', async () => {
    const user = userEvent.setup()
    render(<TreatMenu />)
    await user.type(screen.getByLabelText('New treat'), 'Walk the dog')
    await user.click(screen.getByRole('button', { name: /^Add$/ }))
    expect(useStore.getState().prefs.adhd.treats).toContain('Walk the dog')
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    expect(useStore.getState().prefs.adhd.treats).toContain('Walk the dog')
    await user.click(screen.getByRole('button', { name: 'Yes, reset' }))
    expect(useStore.getState().prefs.adhd.treats).toEqual([...DEFAULT_TREATS])
  })

  it('removes and reorders', async () => {
    const user = userEvent.setup()
    render(<TreatMenu />)
    await user.click(screen.getByRole('button', { name: `Move “${DEFAULT_TREATS[1]}” up` }))
    expect(useStore.getState().prefs.adhd.treats.slice(0, 2)).toEqual([DEFAULT_TREATS[1], DEFAULT_TREATS[0]])
    await user.click(screen.getByRole('button', { name: `Remove “${DEFAULT_TREATS[0]}”` }))
    expect(useStore.getState().prefs.adhd.treats).not.toContain(DEFAULT_TREATS[0])
  })
})

describe('TreatPicker', () => {
  it('offers three, confirms the pick, then calls onDone', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<TreatPicker onDone={onDone} />)
    expect(screen.getAllByRole('button').length).toBe(4) // three treats + Skip
    await user.click(screen.getByRole('button', { name: DEFAULT_TREATS[0]! }))
    expect(screen.getByText(/Back in 10 minutes/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('Skip calls onDone', async () => {
    const onDone = vi.fn()
    render(<TreatPicker onDone={onDone} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Skip' }))
    expect(onDone).toHaveBeenCalledOnce()
  })
})

describe('MovementSnack', () => {
  it('skips through every move to "Back to it"', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<MovementSnack onDone={onDone} />)
    for (let i = 0; i < 6; i++) await user.click(screen.getByRole('button', { name: /Skip move/ }))
    await user.click(screen.getByRole('button', { name: 'Back to it' }))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('shows the seated alternative', async () => {
    const user = userEvent.setup()
    render(<MovementSnack onDone={() => {}} />)
    await user.click(screen.getByLabelText('I’m sitting'))
    expect(screen.getByText('Same, sitting tall.')).toBeTruthy()
  })
})
