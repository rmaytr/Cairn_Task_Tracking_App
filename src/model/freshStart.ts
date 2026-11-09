import { addDays, todayISO } from '../lib/dates'
import type { Horizon, Task } from './types'

/** One task's change in a fresh-start move. */
export interface TaskPatch {
  id: string
  patch: { due: string | null; horizon: Horizon }
}

const WEEK_DAYS = 7

/** Open tasks whose date is before today. */
export const overdueTasks = (tasks: readonly Task[], now: Date): Task[] => {
  const today = todayISO(now)
  return tasks.filter((t) => !t.done && t.due !== null && t.due < today)
}

export const moveAllToToday = (tasks: readonly Task[], now: Date): TaskPatch[] =>
  tasks.map((t) => ({ id: t.id, patch: { due: todayISO(now), horizon: 'today' } }))

const weight = (t: Task): number => (t.high ? 0 : t.low ? 2 : 1)

/**
 * Spreads tasks over the next seven days starting today, high priority first, then the
 * oldest date. One a day for a small pile, more per day only when it would not fit.
 */
export const spreadOverWeek = (tasks: readonly Task[], now: Date): TaskPatch[] => {
  const perDay = Math.max(1, Math.ceil(tasks.length / WEEK_DAYS))
  const today = todayISO(now)
  return [...tasks]
    .sort((a, b) => weight(a) - weight(b) || (a.due ?? '').localeCompare(b.due ?? ''))
    .map((t, i) => {
      const day = Math.floor(i / perDay)
      return { id: t.id, patch: { due: addDays(today, day), horizon: day === 0 ? 'today' : 'week' } }
    })
}

/** "Not now": out of sight in Someday, no date. */
export const notNow = (tasks: readonly Task[]): TaskPatch[] =>
  tasks.map((t) => ({ id: t.id, patch: { due: null, horizon: 'someday' } }))
