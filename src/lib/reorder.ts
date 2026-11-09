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

/** Ranks for `k` items that sit between `prev` and `next` (either may be missing), or null if too tight. */
function spread(prev: number | undefined, next: number | undefined, k: number): number[] | null {
  if (prev === undefined && next === undefined) return Array.from({ length: k }, (_, j) => j * STEP)
  if (prev === undefined) return Array.from({ length: k }, (_, j) => (next as number) - STEP * (k - j))
  if (next === undefined) return Array.from({ length: k }, (_, j) => prev + STEP * (j + 1))
  const step = (next - prev) / (k + 1)
  return step > MIN_GAP ? Array.from({ length: k }, (_, j) => prev + step * (j + 1)) : null
}

/**
 * New ranks so that `ordered` (one group, first to last, as the user wants it) holds, after the
 * user put `movedId` where it is now. Returns only the ranks that change: when the ranked tasks
 * are already in order, that is just the moved task and any task that never had a rank, because
 * sync is whole-task last-writer-wins and re-stamping the group would clobber other devices' edits.
 */
export function rerank(ordered: readonly Ranked[], movedId: string): Map<string, number> {
  const ranked = ordered.filter((i) => i.id !== movedId && i.rank !== undefined)
  if (ranked.every((i, n) => n === 0 || (i.rank as number) > (ranked[n - 1]?.rank as number))) {
    // Walk the group; items that keep their rank are anchors, the rest get ranks between anchors.
    const keeps = (n: number, prev: number | undefined): boolean => {
      const item = ordered[n] as Ranked
      if (item.rank === undefined) return false
      if (item.id !== movedId) return true
      const next = ordered.slice(n + 1).find((i) => i.id !== movedId && i.rank !== undefined)?.rank
      return (prev === undefined || item.rank > prev) && (next === undefined || item.rank < next)
    }
    const changes = new Map<string, number>()
    let prev: number | undefined
    let n = 0
    let ok = true
    while (ok && n < ordered.length) {
      if (keeps(n, prev)) {
        prev = (ordered[n] as Ranked).rank
        n++
        continue
      }
      let end = n
      while (end < ordered.length && !keeps(end, prev)) end++
      const next = ordered[end]?.rank
      const run = spread(prev, next, end - n)
      if (!run) ok = false
      else run.forEach((rank, j) => changes.set((ordered[n + j] as Ranked).id, rank))
      prev = run?.[run.length - 1]
      n = end
    }
    if (ok) return changes
  }
  return new Map(ordered.flatMap((i, n) => (i.rank === n * STEP ? [] : [[i.id, n * STEP] as const])))
}
