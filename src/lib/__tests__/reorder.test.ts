import { describe, expect, it } from 'vitest'
import { applyMove, gapPosition, rankBetween, rerank, sortByRank } from '../reorder'

describe('applyMove', () => {
  it('moves an item down and up without touching the input', () => {
    const list = ['a', 'b', 'c', 'd']
    expect(applyMove(list, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(applyMove(list, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(list).toEqual(['a', 'b', 'c', 'd'])
  })

  it('clamps the target and ignores a bad source index', () => {
    expect(applyMove(['a', 'b'], 0, 9)).toEqual(['b', 'a'])
    expect(applyMove(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
  })
})

describe('rankBetween', () => {
  it('splits the gap between neighbours', () => {
    expect(rankBetween(1024, 2048)).toBe(1536)
  })

  it('steps past an open end, and starts at zero when alone', () => {
    expect(rankBetween(undefined, 0)).toBeLessThan(0)
    expect(rankBetween(4096, undefined)).toBeGreaterThan(4096)
    expect(rankBetween(undefined, undefined)).toBe(0)
  })

  it('gives up (null) when the gap is too small to split', () => {
    expect(rankBetween(1, 1 + 1e-9)).toBeNull()
    expect(rankBetween(5, 5)).toBeNull()
    expect(rankBetween(6, 5)).toBeNull()
  })
})

describe('sortByRank', () => {
  it('puts ranked items first by rank, then unranked ones in their given order', () => {
    const items = [{ id: 'p1' }, { id: 'r2', rank: 20 }, { id: 'p2' }, { id: 'r1', rank: 10 }]
    expect(sortByRank(items, (i) => i.rank).map((i) => i.id)).toEqual(['r1', 'r2', 'p1', 'p2'])
  })
})

describe('rerank', () => {
  it('only re-ranks the moved item when its neighbours are already in order', () => {
    const changes = rerank(
      [
        { id: 'a', rank: 0 },
        { id: 'c', rank: 2048 },
        { id: 'b', rank: 1024 },
      ],
      'c',
    )
    expect([...changes.keys()]).toEqual(['c'])
    expect(changes.get('c')).toBeGreaterThan(0)
    expect(changes.get('c')).toBeLessThan(1024)
  })

  it('stamps the whole order when some items have no rank yet', () => {
    const changes = rerank([{ id: 'a' }, { id: 'b', rank: 5 }, { id: 'c' }], 'a')
    const ranks = ['a', 'b', 'c'].map((id) => changes.get(id) ?? 5)
    expect(ranks[0]).toBeLessThan(ranks[1])
    expect(ranks[1]).toBeLessThan(ranks[2])
  })

  it('leaves ranked tasks alone when new unranked tasks join a drag', () => {
    // a,b,c are ranked; n1, n2 are new tasks without a rank; the user drags c above b.
    const order = [
      { id: 'a', rank: 0 },
      { id: 'n1' },
      { id: 'c', rank: 2048 },
      { id: 'b', rank: 1024 },
      { id: 'n2' },
    ]
    const changes = rerank(order, 'c')
    expect([...changes.keys()].sort()).toEqual(['c', 'n1', 'n2'])
    const rank = (id: string): number => changes.get(id) ?? (order.find((i) => i.id === id)!.rank as number)
    const ranks = order.map((i) => rank(i.id))
    expect(ranks.every((r, i) => i === 0 || r > ranks[i - 1]!)).toBe(true)
  })

  it('only gives unranked tasks a rank when the moved task already fits', () => {
    const changes = rerank([{ id: 'a', rank: 0 }, { id: 'n' }, { id: 'b', rank: 10 }], 'a')
    expect([...changes.keys()]).toEqual(['n'])
    expect(changes.get('n')).toBeGreaterThan(0)
    expect(changes.get('n')).toBeLessThan(10)
  })

  it('stamps the order the user saw when old ranks disagree with it', () => {
    const changes = rerank(
      [
        { id: 'a', rank: 300 },
        { id: 'b', rank: 100 },
        { id: 'c', rank: 200 },
      ],
      'a',
    )
    const after = (id: string, old: number): number => changes.get(id) ?? old
    expect(after('a', 300)).toBeLessThan(after('b', 100))
    expect(after('b', 100)).toBeLessThan(after('c', 200))
  })

  it('renormalizes when the gap gets too small to split', () => {
    const changes = rerank(
      [
        { id: 'a', rank: 1 },
        { id: 'c', rank: 3 },
        { id: 'b', rank: 1 + 1e-9 },
      ],
      'c',
    )
    expect(changes.size).toBe(3)
    expect(changes.get('a')!).toBeLessThan(changes.get('c')!)
    expect(changes.get('c')!).toBeLessThan(changes.get('b')!)
  })

  it('returns nothing to change when the order already holds', () => {
    expect(
      rerank(
        [
          { id: 'a', rank: 1 },
          { id: 'b', rank: 2 },
        ],
        'a',
      ).size,
    ).toBe(0)
  })

  it('keeps repeated drags stable for many moves (no NaN, strictly increasing)', () => {
    let items = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, rank: i * 1024 }))
    for (let n = 0; n < 80; n++) {
      // Keep dropping the last item between the first two.
      const moved = items[items.length - 1]
      const order = [items[0], moved, ...items.slice(1, -1)]
      const changes = rerank(order, moved.id)
      items = order.map((i) => ({ ...i, rank: changes.get(i.id) ?? i.rank }))
      const ranks = items.map((i) => i.rank)
      expect(ranks.every(Number.isFinite)).toBe(true)
      expect(ranks.every((r, i) => i === 0 || r > ranks[i - 1])).toBe(true)
    }
  })
})

describe('gapPosition', () => {
  // true = an item that can move; false = the dragged item itself or a done task.
  it('sits before the index-th movable item', () => {
    expect(gapPosition([true, false, true, true], 0)).toBe(0)
    expect(gapPosition([true, false, true, true], 1)).toBe(2)
  })

  it('sits after the last movable item (before done tasks) at the end', () => {
    expect(gapPosition([true, true, false, false], 2)).toBe(2)
  })

  it('starts an empty group', () => {
    expect(gapPosition([], 0)).toBe(0)
    expect(gapPosition([false], 0)).toBe(0)
  })
})