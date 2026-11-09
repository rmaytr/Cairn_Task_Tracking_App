import { afterEach, describe, expect, it, vi } from 'vitest'
import { chime, tock } from '../feedback'

afterEach(() => vi.unstubAllGlobals())

describe('feedback', () => {
  it('never throws without AudioContext or vibrate', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(() => tock({ sound: true, haptics: true })).not.toThrow()
    expect(() => chime()).not.toThrow()
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
