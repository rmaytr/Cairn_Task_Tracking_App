import { describe, expect, it } from 'vitest'
import { makeTask, NOW } from '../../plan/__tests__/fixtures'
import { guessIntents, themeForCommand, type Intent } from '../intent'
import { DEFAULT_AREAS } from './areas'

const tasks = [
  makeTask('laundry', { title: 'Do laundry' }),
  makeTask('essay', { title: 'Finish the history essay', areaId: 'classes' }),
  makeTask('mom', { title: 'Call mom' }),
  makeTask('old', { title: 'Do laundry', done: true }),
  makeTask('lab', { title: 'CS303 lab report', areaId: 'classes' }),
]
const ctx = { tasks, areas: DEFAULT_AREAS, now: NOW }
const best = (q: string): Intent | undefined => guessIntents(q, ctx)[0]

describe('guessIntents', () => {
  it('returns nothing for an empty query', () => {
    expect(guessIntents('   ', ctx)).toEqual([])
  })

  it('falls back to add for plain text that matches nothing', () => {
    expect(best('buy oat milk')).toEqual({ kind: 'add', text: 'buy oat milk' })
  })

  it('adds text that only loosely resembles a task (no confident match)', () => {
    expect(best('call the dentist')).toEqual({ kind: 'add', text: 'call the dentist' })
  })

  it.each(['done laundry', 'finished laundry', 'complete laundry', 'check laundry', 'Finish: laundry!'])(
    '%s marks the open task done',
    (q) => {
      expect(best(q)).toEqual({ kind: 'done', taskId: 'laundry' })
    },
  )

  it('never targets an already-done task', () => {
    expect(guessIntents('done laundry', ctx).some((i) => i.kind === 'done' && i.taskId === 'old')).toBe(false)
  })

  it('matches by prefix and ignores case', () => {
    expect(best('DONE hist ess')).toEqual({ kind: 'done', taskId: 'essay' })
  })

  it('keeps add as the last-resort alternative after a changing intent', () => {
    const list = guessIntents('done laundry', ctx)
    expect(list[list.length - 1]).toEqual({ kind: 'add', text: 'done laundry' })
  })

  it('does not mark done when nothing matches confidently', () => {
    expect(best('done flying a kite')).toEqual({ kind: 'add', text: 'done flying a kite' })
  })

  it.each(['snooze essay', 'later essay', 'postpone the essay'])('%s snoozes', (q) => {
    expect(best(q)).toEqual({ kind: 'snooze', taskId: 'essay' })
  })

  it('moves a task to an area', () => {
    expect(best('move laundry to classes')).toEqual({ kind: 'move', taskId: 'laundry', areaId: 'classes' })
  })

  it('moves with the short form "X to <area>"', () => {
    expect(best('call mom to life')).toEqual({ kind: 'move', taskId: 'mom', areaId: 'life' })
  })

  it('does not move to an unknown area', () => {
    expect(best('move essay to narnia')).toEqual({ kind: 'add', text: 'move essay to narnia' })
  })

  it('reschedules an existing task when a date word follows', () => {
    expect(best('essay tomorrow')).toEqual({ kind: 'reschedule', taskId: 'essay', due: '2026-10-22' })
  })

  it('reschedules with "move X to friday"', () => {
    expect(best('move essay to friday')).toEqual({ kind: 'reschedule', taskId: 'essay', due: '2026-10-23' })
  })

  it('adds when the text before the date matches no task', () => {
    expect(best('call grandma tomorrow')).toEqual({ kind: 'add', text: 'call grandma tomorrow' })
  })

  it('goes to places', () => {
    expect(best('go to today')).toEqual({ kind: 'go', target: 'home' })
    expect(best('open lock in')).toEqual({ kind: 'go', target: 'focus' })
    expect(best('go to settings')).toEqual({ kind: 'go', target: 'settings' })
    expect(best('open classes')).toEqual({ kind: 'go', target: 'area:classes' })
  })

  it('opens a task with "open X"', () => {
    expect(best('open lab report')).toEqual({ kind: 'open', taskId: 'lab' })
  })

  it('suggests an action when the query names one', () => {
    expect(best('import')).toEqual({ kind: 'action', id: 'import' })
    expect(best('new area')).toEqual({ kind: 'action', id: 'new-area' })
  })

  it('opens the task a plain search names instead of adding a copy', () => {
    expect(best('lab report')).toEqual({ kind: 'open', taskId: 'lab' })
    expect(best('call mom')).toEqual({ kind: 'open', taskId: 'mom' })
  })

  it('goes to a place named exactly, without a verb', () => {
    expect(best('today')).toEqual({ kind: 'go', target: 'home' })
    expect(best('focus')).toEqual({ kind: 'go', target: 'focus' })
    expect(best('Classes')).toEqual({ kind: 'go', target: 'area:classes' })
  })

  it('opens a task whose title starts with a done-verb instead of marking it done', () => {
    const own = [makeTask('email', { title: 'Check email' }), ...tasks]
    const c = { ...ctx, tasks: own }
    expect(guessIntents('check email', c)[0]).toEqual({ kind: 'open', taskId: 'email' })
    expect(best('finish history essay')).toEqual({ kind: 'open', taskId: 'essay' })
    // Without the verb in the title, the verb still means done.
    expect(best('done history essay')).toEqual({ kind: 'done', taskId: 'essay' })
  })

  it('reads "dark mode" and "light mode" as setting a side, "theme" as switching', () => {
    expect(best('dark mode')).toEqual({ kind: 'action', id: 'dark-mode' })
    expect(best('light')).toEqual({ kind: 'action', id: 'light-mode' })
    expect(best('theme')).toEqual({ kind: 'action', id: 'theme' })
  })

  it('does not guess between two tasks that match equally well', () => {
    const twins = [
      makeTask('hist', { title: 'Finish the history essay' }),
      makeTask('eng', { title: 'Finish the english essay' }),
    ]
    expect(guessIntents('done essay', { ...ctx, tasks: twins })[0]).toEqual({ kind: 'add', text: 'done essay' })
  })
})

describe('themeForCommand', () => {
  it('keeps the current theme when it is already the asked-for side', () => {
    expect(themeForCommand('dark-mode', 'dusk')).toBe('dusk')
    expect(themeForCommand('light-mode', 'notes')).toBe('notes')
  })

  it('switches to the default theme of the other side', () => {
    expect(themeForCommand('dark-mode', 'notes')).toBe('night')
    expect(themeForCommand('light-mode', 'ink')).toBe('stone')
  })

  it('toggles for "theme"', () => {
    expect(themeForCommand('theme', 'moss')).toBe('night')
    expect(themeForCommand('theme', 'dusk')).toBe('stone')
  })
})
