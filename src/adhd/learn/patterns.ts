import { startOfWeek } from '../../model/derive'
import type { soundComparison } from '../stats'
import type { FocusSession } from '../types'

/** Parts of the day, by local hour. */
export const BANDS = ['morning', 'afternoon', 'evening', 'night'] as const
export type Band = (typeof BANDS)[number]

export const BAND_LABEL: Record<Band, string> = {
  morning: 'Mornings',
  afternoon: 'Afternoons',
  evening: 'Evenings',
  night: 'Late nights',
}

/** Below this many blocks, any "best time" is noise: say "early days". */
export const MIN_BLOCKS = 5
/** Rated blocks a band needs before its mean rating is compared. */
export const MIN_BAND_RATED = 3
/** Rating gap (on 1 to 5) below which sound and silence count as even. */
export const SOUND_EVEN = 0.3

export function bandOf(at: number): Band {
  const h = new Date(at).getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 22) return 'evening'
  return 'night'
}

const counted = (sessions: readonly FocusSession[]): FocusSession[] => sessions.filter((s) => s.actualMin >= 1)

export interface BestTime {
  best: { band: Band; by: 'rating' | 'minutes'; n: number } | null
  /** Blocks looked at. */
  n: number
}

/**
 * Your best part of the day for focus: highest mean rating once two bands have enough ratings,
 * otherwise the band with the most minutes, and nothing until MIN_BLOCKS.
 */
export function bestTime(sessions: readonly FocusSession[]): BestTime {
  const blocks = counted(sessions)
  if (blocks.length < MIN_BLOCKS) return { best: null, n: blocks.length }
  const stats = BANDS.map((band) => {
    const mine = blocks.filter((s) => bandOf(s.at) === band)
    const ratings = mine.flatMap((s) => (s.rating === null ? [] : [s.rating]))
    return {
      band,
      minutes: mine.reduce((sum, s) => sum + s.actualMin, 0),
      rated: ratings.length,
      mean: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    }
  })
  const rated = stats.filter((b) => b.rated >= MIN_BAND_RATED)
  if (rated.length >= 2) {
    const top = rated.reduce((a, b) => (b.mean > a.mean || (b.mean === a.mean && b.minutes > a.minutes) ? b : a))
    return { best: { band: top.band, by: 'rating', n: rated.reduce((sum, b) => sum + b.rated, 0) }, n: blocks.length }
  }
  const top = stats.reduce((a, b) => (b.minutes > a.minutes ? b : a))
  return { best: { band: top.band, by: 'minutes', n: blocks.length }, n: blocks.length }
}

/** Focused minutes and blocks since Monday 00:00 local time. */
export function weekFocus(sessions: readonly FocusSession[], now: Date): { minutes: number; blocks: number } {
  const since = startOfWeek(now)
  const week = counted(sessions).filter((s) => s.at >= since)
  return { minutes: Math.round(week.reduce((sum, s) => sum + s.actualMin, 0)), blocks: week.length }
}

/** Which side rates higher, or null until both sides have enough rated blocks. */
export function soundVerdict(cmp: ReturnType<typeof soundComparison>): 'sound' | 'silent' | 'same' | null {
  const { withSound, silent } = cmp
  if (!withSound || !silent) return null
  const gap = withSound.mean - silent.mean
  if (Math.abs(gap) < SOUND_EVEN) return 'same'
  return gap > 0 ? 'sound' : 'silent'
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** One plain sentence about a guess ratio; neither direction is "bad". */
export function guessLine(ratio: number): string {
  if (Math.abs(ratio - 1) < 0.15) return 'Your guesses are about right.'
  return ratio > 1 ? `Blocks usually take ${ratio}× your guess.` : `You usually finish in ${ratio}× your guess.`
}
