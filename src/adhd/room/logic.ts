/** Pure rules and copy for the Focus room and Time sense. No React, no store. */
import type { Task } from '../../model/types'
import { localPlan } from '../../plan/lockin'
import { pastRuns, suggestMinutes, type GuessRatio } from '../calibration'
import type { FocusSession } from '../types'

const MIN = 60_000
/** Past this share of its first length, a stretched block gets the soft exit card. */
export const RAMP_STRETCH = 1.5
export const RAMP_MINUTES = 45
const TITLE_MAX = 28

/** Where the room opens: the running timer's task, then the one sent here, then Up next. */
export function pickStartTask(
  tasks: readonly Task[],
  from: { timerTaskId: string | null; roomTaskId: string | null },
  now: Date,
): string | null {
  const open = tasks.filter((t) => !t.done)
  const isOpen = (id: string | null): id is string => id !== null && open.some((t) => t.id === id)
  if (isOpen(from.timerTaskId)) return from.timerTaskId
  if (isOpen(from.roomTaskId)) return from.roomTaskId
  return localPlan(open, now).ids[0] ?? null
}

/** The soft "N minutes left" notice: 5 in the last five (only for blocks of 10+ min), 1 in the last one. */
export function nudgeFor(remainingMs: number, durationMs: number): 5 | 1 | null {
  if (remainingMs <= 0) return null
  if (remainingMs <= MIN) return durationMs > MIN ? 1 : null
  if (remainingMs <= 5 * MIN) return durationMs >= 10 * MIN ? 5 : null
  return null
}

/** Hyperfocus exit ramp: the block was stretched past 1.5x its first length, or ran 45+ minutes. */
export function exitRampDue(b: { startMin: number; durationMs: number; workedMs: number }): boolean {
  return b.durationMs > b.startMin * MIN * RAMP_STRETCH || b.workedMs >= RAMP_MINUTES * MIN
}

/** Cuts a long title at a word boundary, so the companion's line stays one breath long. */
function short(title: string): string {
  if (title.length <= TITLE_MAX) return title
  const cut = title.slice(0, TITLE_MAX - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** What the quiet companion says, by how far through the block you are (0 to 1). */
export function companionLine(title: string, progress: number): string {
  if (progress >= 1) return 'You stayed with it. Well done.'
  if (progress >= 0.5) return `Still on ${short(title)}? Nice.`
  return `Hi. I’ll sit with you while you work on ${short(title)}.`
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** "18 min on Essay. 2 steps done." */
export function summaryText(minutes: number, title: string, stepsDone: number): string {
  const steps = stepsDone > 0 ? ` ${plural(stepsDone, 'step')} done.` : ''
  return `${minutes} min on ${title}.${steps}`
}

/** Within this share of the guess counts as "right on". */
const CLOSE = 0.15

/** A kind comparison of guess and clock; null without a guess. */
export function guessText(guessMin: number | null, actualMin: number): string | null {
  if (guessMin === null) return null
  const head = `You guessed ${guessMin}, it took ${actualMin}.`
  if (Math.abs(actualMin - guessMin) <= Math.max(1, guessMin * CLOSE)) return `${head} Right on.`
  return actualMin > guessMin
    ? `${head} That’s normal; Cairn will remember.`
    : `${head} Quicker than you thought; Cairn will remember.`
}

/** The padded-guess line under the guess chips; null until there is a personal ratio. */
export function ratioHint(guess: number, ratio: GuessRatio | null): string | null {
  if (!ratio) return null
  if (ratio.ratio === 1) return 'Your guesses are usually right on.'
  return `You usually take about ${ratio.ratio}× your guess, so maybe ${suggestMinutes(guess, ratio)} min?`
}

/** Time sense's big line. */
export function ratioHeadline(ratio: GuessRatio): string {
  if (ratio.ratio === 1) return 'Your guesses are usually right on'
  return ratio.ratio > 1 ? `You usually take ${ratio.ratio}× your guess` : `You usually finish in ${ratio.ratio}× your guess`
}

export function ghostText(runs: { last: number; best: number; n: number }): string {
  return runs.n > 1 ? `Last time: ${runs.last} min · best ${runs.best} min` : `Last time: ${runs.last} min`
}

export interface RepeatedTask {
  title: string
  last: number
  best: number
  n: number
}

/** Tasks worked on in more than one block (matched like pastRuns), most recently worked first. */
export function repeatedTasks(sessions: readonly FocusSession[]): RepeatedTask[] {
  const seen = new Set<string>()
  const out: RepeatedTask[] = []
  for (const s of [...sessions].reverse()) {
    const key = s.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    const runs = pastRuns(sessions, { id: s.taskId ?? '', title: s.title })
    if (runs && runs.n > 1) out.push({ title: s.title, ...runs })
  }
  return out
}
