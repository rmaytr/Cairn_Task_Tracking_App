import { describe, expect, it } from 'vitest'
import { DEFAULT_TREATS, MAX_TREAT_LENGTH, MAX_TREATS } from '../../types'
import { BLOCKERS, MOVE_FOR, WHY, formatPlan, openersFor } from '../blockers'
import { MOVES, totalSeconds } from '../breakMoves'
import { addTreat, moveTreat, removeTreat, renameTreat, resetTreats, rotateTreats } from '../treats'

describe('openersFor', () => {
  it('suggests keyword openers first', () => {
    expect(openersFor('Write the history essay')[0]).toBe('Open the doc and write the title')
    expect(openersFor('Study for the biology midterm')[0]).toBe('Put your notes on the desk')
  })
  it('falls back to plain openers and respects the limit', () => {
    expect(openersFor('Zzz')).toHaveLength(3)
    expect(openersFor('Write the essay', 2)).toHaveLength(2)
  })
  it('has no duplicates', () => {
    const r = openersFor('write an email report and call')
    expect(new Set(r).size).toBe(r.length)
  })
})

describe('which move fits which blocker', () => {
  it('maps every blocker to a move with a why line and source', () => {
    for (const b of BLOCKERS) {
      const why = WHY[MOVE_FOR[b]]
      expect(why.line.length).toBeGreaterThan(10)
      expect(why.source.length).toBeGreaterThan(3)
    }
    expect(new Set(BLOCKERS.map((b) => MOVE_FOR[b])).size).toBe(BLOCKERS.length)
  })
})

describe('formatPlan', () => {
  it('builds a sentence and tolerates typed prefixes', () => {
    expect(formatPlan('after breakfast', 'open the doc')).toBe('When after breakfast, I will open the doc.')
    expect(formatPlan('When I sit down.', "I'll open the doc!")).toBe('When I sit down, I will open the doc.')
  })
  it('needs both halves', () => {
    expect(formatPlan('', 'x')).toBeNull()
    expect(formatPlan('x', '  ')).toBeNull()
  })
})

describe('treat edits', () => {
  it('adds, trims, caps length and rejects duplicates and empties', () => {
    expect(addTreat(['a'], '  b  ')).toEqual(['a', 'b'])
    expect(addTreat(['a'], 'A')).toEqual(['a'])
    expect(addTreat(['a'], '   ')).toEqual(['a'])
    expect(addTreat([], 'x'.repeat(200))[0]).toHaveLength(MAX_TREAT_LENGTH)
  })
  it('stops at MAX_TREATS', () => {
    const full = Array.from({ length: MAX_TREATS }, (_, i) => `t${i}`)
    expect(addTreat(full, 'more')).toEqual(full)
  })
  it('renames, removes and reorders without mutating', () => {
    const list = ['a', 'b', 'c']
    expect(renameTreat(list, 1, 'B')).toEqual(['a', 'B', 'c'])
    expect(renameTreat(list, 1, ' ')).toEqual(list)
    expect(removeTreat(list, 0)).toEqual(['b', 'c'])
    expect(moveTreat(list, 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveTreat(list, 0, -1)).toEqual(list)
    expect(moveTreat(list, 2, 1)).toEqual(list)
    expect(list).toEqual(['a', 'b', 'c'])
  })
  it('resets to defaults as a copy', () => {
    const r = resetTreats()
    expect(r).toEqual([...DEFAULT_TREATS])
    expect(r).not.toBe(DEFAULT_TREATS)
  })
})

describe('rotateTreats', () => {
  const list = ['a', 'b', 'c', 'd', 'e']
  it('shows the next three each time and wraps', () => {
    expect(rotateTreats(list, 0)).toEqual(['a', 'b', 'c'])
    expect(rotateTreats(list, 3)).toEqual(['d', 'e', 'a'])
    expect(rotateTreats(list, -1)).toEqual(['e', 'a', 'b'])
  })
  it('handles short and empty lists', () => {
    expect(rotateTreats(['a', 'b'], 1)).toEqual(['b', 'a'])
    expect(rotateTreats([], 4)).toEqual([])
  })
})

describe('move break', () => {
  it('is about 90 seconds with a seated alternative for each move', () => {
    expect(totalSeconds()).toBeGreaterThanOrEqual(80)
    expect(totalSeconds()).toBeLessThanOrEqual(100)
    expect(MOVES.every((m) => m.seated.length > 0)).toBe(true)
  })
})
