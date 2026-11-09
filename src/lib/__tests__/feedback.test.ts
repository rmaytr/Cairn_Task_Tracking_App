import { afterEach, describe, expect, it, vi } from 'vitest'
import { chime, tock, warmAudio } from '../feedback'

afterEach(() => vi.unstubAllGlobals())

describe('feedback', () => {
  it('never throws without AudioContext or vibrate', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(() => tock({ sound: true, haptics: true })).not.toThrow()
    expect(() => chime()).not.toThrow()
    expect(() => warmAudio()).not.toThrow()
  })

  it('warmAudio resumes a suspended context (iOS needs it in a tap)', () => {
    const resume = vi.fn(() => Promise.resolve())
    vi.stubGlobal('AudioContext', function () {
      return { state: 'suspended', resume }
    })
    vi.resetModules()
    return import('../feedback').then(({ warmAudio: warm }) => {
      warm()
      expect(resume).toHaveBeenCalled()
    })
  })

  it('vibrates only when haptics is on', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    tock({ sound: false, haptics: false })
    expect(vibrate).not.toHaveBeenCalled()
    tock({ sound: false, haptics: true })
    expect(vibrate).toHaveBeenCalledWith(12)
  })

  it('swallows an AudioContext that throws', () => {
    vi.stubGlobal('AudioContext', function () {
      throw new Error('blocked')
    })
    expect(() => tock({ sound: true, haptics: false })).not.toThrow()
  })
})
