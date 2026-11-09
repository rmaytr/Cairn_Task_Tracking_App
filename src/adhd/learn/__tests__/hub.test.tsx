import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PREFS } from '../../../store/schema'
import { useStore } from '../../../store/useStore'
import { AdhdHub } from '../../AdhdHub'
import type { FocusSession } from '../../types'
import { WhatWorks } from '../../WhatWorks'

const state = () => useStore.getState()
const playbook = () => state().prefs.adhd.playbook

const session = (over: Partial<FocusSession> = {}): FocusSession => ({
  id: Math.random().toString(36), taskId: null, title: 'Essay', at: Date.now(), guessMin: null, actualMin: 25, sound: 'none', companion: false, rating: null,
  ...over,
})

beforeEach(() => {
  // jsdom has no matchMedia; the cards ask for prefers-reduced-motion.
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  useStore.setState({ tasks: [], toast: null, view: 'adhd', adhdTool: 'learn', prefs: DEFAULT_PREFS })
})
afterEach(cleanup)

describe('WhatWorks', () => {
  it('marks a card, shows it in My playbook, and clears it when pressed again', () => {
    render(<WhatWorks />)
    const library = screen.getByRole('region', { name: 'All cards' })
    const card = within(library).getByRole('article', { name: 'Fresh starts are real' })
    const helps = within(card).getByRole('button', { name: 'Helps me' })

    fireEvent.click(helps)
    expect(playbook()).toEqual({ 'fresh-start': 'helps' })
    expect(helps.getAttribute('aria-pressed')).toBe('true')
    const book = screen.getByRole('region', { name: 'My playbook' })
    expect(within(book).getByRole('article', { name: 'Fresh starts are real' })).toBeTruthy()

    fireEvent.click(helps)
    expect(playbook()).toEqual({})
    expect(within(book).queryByRole('article')).toBeNull()
  })

  it('switching marks keeps one mark per card', () => {
    render(<WhatWorks />)
    const card = within(screen.getByRole('region', { name: 'All cards' })).getByRole('article', { name: 'One thing at a time' })
    fireEvent.click(within(card).getByRole('button', { name: 'Want to try' }))
    fireEvent.click(within(card).getByRole('button', { name: 'Not for me' }))
    expect(playbook()).toEqual({ 'one-task': 'nope' })
  })

  it('filters by topic', () => {
    render(<WhatWorks />)
    const library = screen.getByRole('region', { name: 'All cards' })
    fireEvent.click(screen.getByRole('button', { name: 'Myths' }))
    expect(within(library).getAllByRole('article')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /^All/ }))
    expect(within(library).getAllByRole('article')).toHaveLength(17)
  })
})

describe('AdhdHub', () => {
  it('routes each "Right now" chip to its tool', () => {
    render(<AdhdHub />)
    const now = screen.getByRole('group', { name: 'Right now I need to…' })
    const cases: [string, string][] = [
      ['Get unstuck', 'unstuck'],
      ['Quiet my head', 'sounds'],
      ['Take a break', 'move'],
      ['Reward myself', 'treats'],
      ['Start something', 'room'],
    ]
    for (const [label, tool] of cases) {
      fireEvent.click(within(now).getByRole('button', { name: label }))
      expect(state().adhdTool).toBe(tool)
    }
    expect(state().roomTaskId).toBeNull()
  })

  it('hides Your patterns until there is data, then says what each is based on', () => {
    const { unmount } = render(<AdhdHub />)
    expect(screen.queryByRole('region', { name: 'Your patterns' })).toBeNull()
    unmount()

    useStore.setState({ prefs: { ...DEFAULT_PREFS, adhd: { ...DEFAULT_PREFS.adhd, sessions: [session(), session({ actualMin: 20 })] } } })
    render(<AdhdHub />)
    const patterns = screen.getByRole('region', { name: 'Your patterns' })
    expect(within(patterns).getByText('45 min')).toBeTruthy()
    expect(within(patterns).getByText('Early days')).toBeTruthy()
    expect(within(patterns).getByText(/Based on 2 blocks\. A pattern shows after 5\./)).toBeTruthy()
  })
})
