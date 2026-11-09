import { describe, expect, it } from 'vitest'
import { soundComparison } from '../stats'
import type { FocusSession } from '../types'

const s = (sound: FocusSession['sound'], rating: number | null): FocusSession => ({
  id: 'x', taskId: null, title: 't', at: 0, guessMin: null, actualMin: 10, sound, companion: false, rating,
})

describe('soundComparison', () => {
  it('compares mean ratings once each side has enough rated blocks', () => {
    const r = soundComparison([s('pink', 4), s('brown', 5), s('rain', 3), s('none', 2), s('none', 3), s('none', 3), s('none', null)])
    expect(r).toEqual({ withSound: { mean: 4, n: 3 }, silent: { mean: 2.7, n: 3 } })
  })

  it('says nothing about a side with too few ratings', () => {
    expect(soundComparison([s('pink', 4), s('none', 2)])).toEqual({ withSound: null, silent: null })
  })
})
