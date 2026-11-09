import type { FocusSession } from './types'

/** Below this many rated blocks on a side, a comparison is a coin flip; show "keep going" instead. */
export const MIN_RATED = 3

export interface SideStats {
  /** Mean rating, one decimal. */
  mean: number
  n: number
}

/** Mean focus rating with sound vs without, from rated blocks. Each side is null until MIN_RATED. */
export function soundComparison(sessions: readonly FocusSession[]): { withSound: SideStats | null; silent: SideStats | null } {
  const side = (pick: (s: FocusSession) => boolean): SideStats | null => {
    const rated = sessions.filter((s) => s.rating !== null && pick(s)).map((s) => s.rating as number)
    if (rated.length < MIN_RATED) return null
    return { mean: Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10, n: rated.length }
  }
  return { withSound: side((s) => s.sound !== 'none'), silent: side((s) => s.sound === 'none') }
}
