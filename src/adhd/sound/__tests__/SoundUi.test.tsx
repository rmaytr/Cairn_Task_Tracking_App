import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFS } from '../../../store/schema'
import { useStore } from '../../../store/useStore'
import { SoundLab } from '../../SoundLab'
import type { FocusSession } from '../../types'
import { currentSound, stop } from '../noise'
import { SoundToggle } from '../SoundToggle'
import { FakeContext } from './fakeAudio'

const sound = () => useStore.getState().prefs.adhd.sound
const session = (s: FocusSession['sound'], rating: number): FocusSession => ({
  id: `${s}${rating}${Math.random()}`, taskId: null, title: 't', at: 0, guessMin: null, actualMin: 10, sound: s, companion: false, rating,
})

const matchMedia = (): Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'> => ({
  matches: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
})

beforeEach(() => {
  vi.stubGlobal('matchMedia', matchMedia)
  useStore.setState({ prefs: { ...DEFAULT_PREFS } })
})
afterEach(() => {
  act(() => stop())
  cleanup()
  vi.unstubAllGlobals()
})

describe('without Web Audio', () => {
  it('SoundToggle and SoundLab say sound is not available', () => {
    render(<SoundToggle />)
    expect(screen.getByText("Sound isn't available on this browser.")).toBeTruthy()
    cleanup()
    render(<SoundLab />)
    expect(screen.getByText("Sound isn't available on this browser.")).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Play pink noise' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('with Web Audio', () => {
  beforeEach(() => vi.stubGlobal('AudioContext', FakeContext))

  it('SoundToggle plays the saved kind, switches and saves kind and volume', () => {
    render(<SoundToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Play pink noise' }))
    expect(currentSound()).toBe('pink')
    expect(screen.getByRole('button', { name: 'Stop sound' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Sound'), { target: { value: 'rain' } })
    expect(currentSound()).toBe('rain')
    expect(sound().kind).toBe('rain')

    const volume = screen.getByRole('slider', { name: 'Volume' })
    expect(volume.getAttribute('aria-valuetext')).toBe('35 percent')
    fireEvent.change(volume, { target: { value: '60' } })
    expect(sound().volume).toBe(0.6)

    fireEvent.click(screen.getByRole('button', { name: 'Stop sound' }))
    expect(currentSound()).toBe('none')
  })

  it('SoundLab cards pick the kind without starting playback', () => {
    render(<SoundLab />)
    fireEvent.click(screen.getByRole('radio', { name: /Brown noise/ }))
    expect(sound().kind).toBe('brown')
    expect(currentSound()).toBe('none')
    expect(screen.getByRole('button', { name: 'Play brown noise' })).toBeTruthy()
  })

  it('Your test compares ratings once there are enough blocks', () => {
    const { rerender } = render(<SoundLab />)
    expect(screen.getByText(/Rate a few Focus room blocks/)).toBeTruthy()
    const sessions = [session('pink', 4), session('rain', 5), session('brown', 4), session('none', 3), session('none', 3), session('none', 4)]
    act(() => useStore.getState().setAdhd({ sessions }))
    rerender(<SoundLab />)
    expect(screen.getByText('Rated focus with sound 4.3 (3 blocks) vs without 3.3 (3 blocks).')).toBeTruthy()
    expect(screen.getByText('So far, sound seems to suit you better.')).toBeTruthy()
  })
})
