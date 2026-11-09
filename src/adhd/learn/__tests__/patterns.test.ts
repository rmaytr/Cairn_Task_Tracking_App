import { describe, expect, it } from 'vitest'
import type { FocusSession } from '../../types'
import { bandOf, bestTime, formatMinutes, guessLine, MIN_BAND_RATED, MIN_BLOCKS, soundVerdict, weekFocus } from '../patterns'

// Monday 9 Nov 2026, 15:00 local.
const NOW = new Date(2026, 10, 9, 15)
const at = (day: number, hour: number): number => new Date(2026, 10, day, hour).getTime()

let seq = 0
const block = (over: Partial<FocusSession> = {}): FocusSession => ({
  id: `s${seq++}`, taskId: null, title: 'Essay', at: at(9, 9), guessMin: null, actualMin: 25, sound: 'none', companion: false, rating: null,
  ...over,
})

describe('bandOf', () => {
  it('splits the day into local-time bands', () => {
    expect(bandOf(at(9, 5))).toBe('morning')
    expect(bandOf(at(9, 11))).toBe('morning')
    expect(bandOf(at(9, 12))).toBe('afternoon')
    expect(bandOf(at(9, 17))).toBe('evening')
    expect(bandOf(at(9, 22))).toBe('night')
    expect(bandOf(at(9, 3))).toBe('night')
  })
})

describe('bestTime', () => {
  it('is null with no blocks', () => {
    expect(bestTime([])).toEqual({ best: null, n: 0 })
  })

  it('says early days below the minimum, but still counts the blocks', () => {
    const r = bestTime(Array.from({ length: MIN_BLOCKS - 1 }, () => block()))
    expect(r).toEqual({ best: null, n: MIN_BLOCKS - 1 })
  })

  it('ignores blocks under a minute', () => {
    expect(bestTime([block({ actualMin: 0 })]).n).toBe(0)
  })

  it('picks the band with the highest mean rating once two bands have enough ratings', () => {
    const morning = Array.from({ length: MIN_BAND_RATED }, () => block({ at: at(9, 9), rating: 3, actualMin: 60 }))
    const evening = Array.from({ length: MIN_BAND_RATED }, () => block({ at: at(9, 19), rating: 5, actualMin: 10 }))
    expect(bestTime([...morning, ...evening]).best).toEqual({ band: 'evening', by: 'rating', n: MIN_BAND_RATED * 2 })
  })

  it('falls back to most minutes when ratings are thin', () => {
    const blocks = [
      block({ at: at(9, 9), actualMin: 20, rating: 5 }),
      block({ at: at(9, 10), actualMin: 20 }),
      block({ at: at(9, 14), actualMin: 50 }),
      block({ at: at(9, 15), actualMin: 30 }),
      block({ at: at(9, 20), actualMin: 10 }),
    ]
    expect(bestTime(blocks).best).toEqual({ band: 'afternoon', by: 'minutes', n: 5 })
  })

  it('needs a second rated band before comparing ratings', () => {
    const morning = Array.from({ length: MIN_BAND_RATED + 2 }, () => block({ at: at(9, 9), rating: 4, actualMin: 5 }))
    const r = bestTime([...morning, block({ at: at(9, 14), actualMin: 90, rating: 5 })])
    expect(r.best?.by).toBe('minutes')
    expect(r.best?.band).toBe('afternoon')
  })
})

describe('weekFocus', () => {
  it('sums this week from Monday 00:00 local time', () => {
    const blocks = [
      block({ at: at(8, 23), actualMin: 40 }), // Sunday: last week
      block({ at: at(9, 0), actualMin: 15 }), // Monday midnight: this week
      block({ at: at(9, 14), actualMin: 25.4 }),
    ]
    expect(weekFocus(blocks, NOW)).toEqual({ minutes: 40, blocks: 2 })
  })

  it('is zero with no data', () => {
    expect(weekFocus([], NOW)).toEqual({ minutes: 0, blocks: 0 })
  })
})

describe('soundVerdict', () => {
  const side = (mean: number) => ({ mean, n: 3 })
  it('needs both sides', () => {
    expect(soundVerdict({ withSound: side(4), silent: null })).toBeNull()
  })
  it('calls small differences even', () => {
    expect(soundVerdict({ withSound: side(3.8), silent: side(3.6) })).toBe('same')
  })
  it('names the side that rates higher', () => {
    expect(soundVerdict({ withSound: side(4.2), silent: side(3.5) })).toBe('sound')
    expect(soundVerdict({ withSound: side(3), silent: side(4) })).toBe('silent')
  })
})

describe('copy helpers', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatMinutes(0)).toBe('0 min')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(135)).toBe('2 h 15 min')
  })

  it('describes a guess ratio without judging it', () => {
    expect(guessLine(1.4)).toBe('Blocks usually take 1.4× your guess.')
    expect(guessLine(1)).toBe('Your guesses are about right.')
    expect(guessLine(0.7)).toBe('You usually finish in 0.7× your guess.')
  })
})
