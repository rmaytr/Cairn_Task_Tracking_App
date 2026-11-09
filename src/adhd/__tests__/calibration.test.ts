import { describe, expect, it } from 'vitest'
import { guessRatio, pastRuns, suggestMinutes } from '../calibration'
import type { FocusSession } from '../types'

const s = (over: Partial<FocusSession>): FocusSession => ({
  id: Math.random().toString(36),
  taskId: null,
  title: 'Essay',
  at: 0,
  guessMin: null,
  actualMin: 10,
  sound: 'none',
  companion: false,
  rating: null,
  ...over,
})

describe('calibration', () => {
  it('needs three guessed blocks before it claims a ratio', () => {
    expect(guessRatio([s({ guessMin: 10, actualMin: 20 }), s({ guessMin: 10, actualMin: 20 })])).toBeNull()
  })

  it('uses the median, so one wild block does not swing it', () => {
    const r = guessRatio([
      s({ guessMin: 10, actualMin: 15 }),
      s({ guessMin: 10, actualMin: 15 }),
      s({ guessMin: 10, actualMin: 120 }),
      s({ guessMin: 20, actualMin: 30 }),
      s({ actualMin: 50 }), // no guess: ignored
    ])
    expect(r).toEqual({ ratio: 1.5, n: 4 })
  })

  it('pads a guess by the ratio to the nearest 5 minutes', () => {
    expect(suggestMinutes(10, { ratio: 1.6, n: 5 })).toBe(15)
    expect(suggestMinutes(10, null)).toBe(10)
    expect(suggestMinutes(2, null)).toBe(5)
  })

  it('finds past runs by task id or by the same title', () => {
    const runs = [s({ taskId: 'a', actualMin: 20 }), s({ title: 'essay!', actualMin: 12 }), s({ title: 'Other', actualMin: 3 })]
    expect(pastRuns(runs, { id: 'a', title: 'Essay' })).toEqual({ last: 12, best: 12, n: 2 })
    expect(pastRuns(runs, { id: 'z', title: 'Nothing' })).toBeNull()
  })
})
