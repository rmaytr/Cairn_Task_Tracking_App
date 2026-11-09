import { describe, expect, it } from 'vitest'
import type { Task } from '../../../model/types'
import type { FocusSession } from '../../types'
import {
  companionLine,
  exitRampDue,
  ghostText,
  guessText,
  nudgeFor,
  pickStartTask,
  ratioHeadline,
  ratioHint,
  repeatedTasks,
  summaryText,
} from '../logic'

const MIN = 60_000
const now = new Date(2026, 10, 9, 10)

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: id,
  notes: '',
  areaId: 'classes',
  horizon: 'week',
  due: null,
  high: false,
  effort: 'm',
  waiting: null,
  plan: null,
  steps: [],
  done: false,
  doneAt: null,
  createdAt: 1,
  updatedAt: 1,
  spentMinutes: 0,
  ...over,
})

const s = (over: Partial<FocusSession>): FocusSession => ({
  id: Math.random().toString(36),
  taskId: null,
  title: 'Essay',
  at: 0,
  guessMin: null,
  actualMin: 10,
  sound: 'none',
  companion: false,
  rating: null,
  ...over,
})

describe('pickStartTask', () => {
  const tasks = [task('a', { horizon: 'later' }), task('b', { horizon: 'today', high: true }), task('c', { done: true })]

  it('resumes the task a running timer belongs to first', () => {
    expect(pickStartTask(tasks, { timerTaskId: 'a', roomTaskId: 'b' }, now)).toBe('a')
  })

  it('opens on the task sent to the room when no timer runs', () => {
    expect(pickStartTask(tasks, { timerTaskId: null, roomTaskId: 'a' }, now)).toBe('a')
  })

  it('falls back to Up next, skipping done or missing tasks', () => {
    expect(pickStartTask(tasks, { timerTaskId: 'gone', roomTaskId: 'c' }, now)).toBe('b')
  })

  it('returns null when nothing is open', () => {
    expect(pickStartTask([task('c', { done: true })], { timerTaskId: null, roomTaskId: null }, now)).toBeNull()
  })
})

describe('nudgeFor', () => {
  it('says 5 minutes left in the last five, then 1 in the last one', () => {
    expect(nudgeFor(6 * MIN, 25 * MIN)).toBeNull()
    expect(nudgeFor(5 * MIN, 25 * MIN)).toBe(5)
    expect(nudgeFor(2 * MIN, 25 * MIN)).toBe(5)
    expect(nudgeFor(MIN, 25 * MIN)).toBe(1)
    expect(nudgeFor(1000, 25 * MIN)).toBe(1)
  })

  it('stays quiet once time is up', () => {
    expect(nudgeFor(0, 25 * MIN)).toBeNull()
  })

  it('skips the 5-minute notice for blocks that are short to begin with', () => {
    expect(nudgeFor(5 * MIN, 5 * MIN)).toBeNull()
    expect(nudgeFor(4 * MIN, 9 * MIN)).toBeNull()
    expect(nudgeFor(MIN, 5 * MIN)).toBe(1)
  })
})

describe('exitRampDue', () => {
  it('shows once a block has been stretched past 1.5x its first length', () => {
    expect(exitRampDue({ startMin: 20, durationMs: 30 * MIN, workedMs: 25 * MIN })).toBe(false)
    expect(exitRampDue({ startMin: 20, durationMs: 35 * MIN, workedMs: 25 * MIN })).toBe(true)
  })

  it('shows after 45 minutes of work whatever the plan was', () => {
    expect(exitRampDue({ startMin: 60, durationMs: 60 * MIN, workedMs: 44 * MIN })).toBe(false)
    expect(exitRampDue({ startMin: 60, durationMs: 60 * MIN, workedMs: 45 * MIN })).toBe(true)
  })
})

describe('companionLine', () => {
  it('greets at the start, checks in from halfway, and stays silent when off', () => {
    expect(companionLine('Essay', 0.1)).toBe('Hi. I’ll sit with you while you work on Essay.')
    expect(companionLine('Essay', 0.6)).toBe('Still on Essay? Nice.')
    expect(companionLine('Essay', 1)).toBe('You stayed with it. Well done.')
  })

  it('shortens long titles', () => {
    expect(companionLine('A really very long task title that keeps going', 0.6)).toBe('Still on A really very long task…? Nice.')
  })
})

describe('summaryText', () => {
  it('says the time and the steps, in plain words', () => {
    expect(summaryText(18, 'Essay', 2)).toBe('18 min on Essay. 2 steps done.')
    expect(summaryText(1, 'Essay', 1)).toBe('1 min on Essay. 1 step done.')
    expect(summaryText(7, 'Essay', 0)).toBe('7 min on Essay.')
  })
})

describe('guessText', () => {
  it('compares kindly in either direction', () => {
    expect(guessText(10, 18)).toBe('You guessed 10, it took 18. That’s normal; Cairn will remember.')
    expect(guessText(25, 15)).toBe('You guessed 25, it took 15. Quicker than you thought; Cairn will remember.')
    expect(guessText(10, 11)).toBe('You guessed 10, it took 11. Right on.')
    expect(guessText(null, 11)).toBeNull()
  })
})

describe('ratio copy', () => {
  it('pads the guess with the personal ratio', () => {
    expect(ratioHint(10, { ratio: 1.4, n: 5 })).toBe('You usually take about 1.4× your guess, so maybe 15 min?')
    expect(ratioHint(10, null)).toBeNull()
    expect(ratioHint(10, { ratio: 1, n: 5 })).toBe('Your guesses are usually right on.')
  })

  it('headlines the ratio for Time sense', () => {
    expect(ratioHeadline({ ratio: 1.4, n: 5 })).toBe('You usually take 1.4× your guess')
    expect(ratioHeadline({ ratio: 0.8, n: 5 })).toBe('You usually finish in 0.8× your guess')
    expect(ratioHeadline({ ratio: 1, n: 5 })).toBe('Your guesses are usually right on')
  })

  it('writes the ghost pace line', () => {
    expect(ghostText({ last: 14, best: 11, n: 3 })).toBe('Last time: 14 min · best 11 min')
    expect(ghostText({ last: 14, best: 14, n: 1 })).toBe('Last time: 14 min')
  })
})

describe('repeatedTasks', () => {
  it('lists tasks done more than once, newest first, with last and best', () => {
    const list = repeatedTasks([
      s({ title: 'Essay', actualMin: 20 }),
      s({ title: 'Dishes', actualMin: 8 }),
      s({ title: 'essay', actualMin: 14 }),
      s({ title: 'Once', actualMin: 5 }),
      s({ title: 'Dishes', actualMin: 10 }),
    ])
    expect(list).toEqual([
      { title: 'Dishes', last: 10, best: 8, n: 2 },
      { title: 'essay', last: 14, best: 14, n: 2 },
    ])
  })
})
