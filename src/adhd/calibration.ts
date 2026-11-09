import type { FocusSession } from './types'

/** Below this many guessed blocks, a personal ratio is noise; say "keep guessing" instead. */
export const MIN_GUESSES = 3

/** How long your blocks take compared with your guesses: the median of actual / guess. */
export interface GuessRatio {
  /** 1.5 means "you usually take 1.5× your guess". */
  ratio: number
  /** Blocks it is based on. */
  n: number
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Personal time-estimate bias from the last `window` guessed blocks, or null until MIN_GUESSES. */
export function guessRatio(sessions: readonly FocusSession[], window = 20): GuessRatio | null {
  const ratios = sessions
    .filter((s) => s.guessMin !== null && s.guessMin > 0 && s.actualMin >= 1)
    .slice(-window)
    .map((s) => s.actualMin / (s.guessMin as number))
  if (ratios.length < MIN_GUESSES) return null
  return { ratio: Math.round(median(ratios) * 10) / 10, n: ratios.length }
}

/** A guess padded by your ratio, rounded to 5 minutes (never below the guess's own rounding). */
export function suggestMinutes(guess: number, ratio: GuessRatio | null): number {
  const raw = ratio ? guess * ratio.ratio : guess
  return Math.max(5, Math.round(raw / 5) * 5)
}

const norm = (title: string): string => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Your previous runs at the same task (same id, or same title for repeats): last and best. */
export function pastRuns(
  sessions: readonly FocusSession[],
  task: { id: string; title: string },
): { last: number; best: number; n: number } | null {
  const key = norm(task.title)
  const runs = sessions.filter((s) => s.actualMin >= 1 && (s.taskId === task.id || (key !== '' && norm(s.title) === key)))
  if (runs.length === 0) return null
  return { last: runs[runs.length - 1].actualMin, best: Math.min(...runs.map((s) => s.actualMin)), n: runs.length }
}
