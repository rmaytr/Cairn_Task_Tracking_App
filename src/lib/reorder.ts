/**
 * "My order": tasks carry a fractional `rank`. A move gives the moved task a rank between its
 * new neighbours, so only one task changes (and syncs); the whole list is re-stamped only when
 * it has no usable ranks yet or the gap got too small to split.
 */

const STEP = 1024
/** Below this a midpoint stops being distinguishable in practice; re-stamp instead. */
const MIN_GAP = 1e-6

export interface Ranked {
  id: string
  rank?: number
}

/** A copy of `list` with the item at `from` moved to `to` (clamped). */
export function applyMove<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return [...list]
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item as T)
  return next
}

/** A rank between two neighbours (either may be missing), or null when they are too close. */
export function rankBetween(prev: number | undefined, next: number | undefined): number | null {
  if (prev === undefined && next === undefined) return 0
  if (prev === undefined) return (next as number) - STEP
  if (next === undefined) return prev + STEP
  return next - prev > MIN_GAP ? prev + (next - prev) / 2 : null
}

/** Ranked items first by rank, then unranked ones in the order given (the planner's). Stable. */
export function sortByRank<T>(items: readonly T[], rankOf: (item: T) => number | undefined): T[] {
  const key = (item: T): number => rankOf(item) ?? Number.MAX_VALUE
  return [...items].sort((a, b) => key(a) - key(b))
}

/**
 * Where the drop gap goes in a rendered list: before the `index`-th movable item, or right after
 * the last movable one (so it stays above done tasks). `movable[i]` is false for the dragged item.
 */
export function gapPosition(movable: readonly boolean[], index: number): number {
  const at = movable.flatMap((m, i) => (m ? [i] : []))
  return at[index] ?? (at.length ? (at[at.length - 1] as number) + 1 : 0)
}

/**
 * New ranks so that `ordered` (one group, first to last, as the user wants it) holds, after the
 * user put `movedId` where it is now. Returns only the ranks that change.
 */
export function rerank(ordered: readonly Ranked[], movedId: string): Map<string, number> {
  const at = ordered.findIndex((i) => i.id === movedId)
  const others = ordered.filter((i) => i.id !== movedId)
  const othersHold = others.every((i, n) => i.rank !== undefined && (n === 0 || i.rank > (others[n - 1]?.rank as number)))
  if (at >= 0 && othersHold) {
    const moved = ordered[at] as Ranked
    const prev = ordered[at - 1]?.rank
    const next = ordered[at + 1]?.rank
    const fits = moved.rank !== undefined && (prev === undefined || moved.rank > prev) && (next === undefined || moved.rank < next)
    if (fits) return new Map()
    const rank = rankBetween(prev, next)
    if (rank !== null) return new Map([[movedId, rank]])
  }
  return new Map(ordered.flatMap((i, n) => (i.rank === n * STEP ? [] : [[i.id, n * STEP] as const])))
}
