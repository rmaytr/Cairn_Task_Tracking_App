import type { Area, Task } from '../model/types'
import { THEMES, type ThemeId } from '../model/themes'
import { parseDateToken } from './dates'

/** Where "go to" can land: a view, the settings dialog, or `area:<id>`. */
export type GoTarget = 'home' | 'tasks' | 'focus' | 'reset' | 'settings' | `area:${string}`

export type ActionId = 'new-task' | 'new-area' | 'import' | 'settings' | 'reset' | 'shortcuts' | 'theme' | 'dark-mode' | 'light-mode'

export type Intent =
  | { kind: 'add'; text: string }
  | { kind: 'done'; taskId: string }
  | { kind: 'snooze'; taskId: string }
  | { kind: 'move'; taskId: string; areaId: string }
  | { kind: 'reschedule'; taskId: string; due: string }
  | { kind: 'open'; taskId: string }
  | { kind: 'go'; target: GoTarget }
  | { kind: 'action'; id: ActionId }

export interface IntentContext {
  tasks: readonly Task[]
  areas: readonly Area[]
  now: Date
}

/** Typing one of these words exactly names the action (exact only, so "set up wifi" still adds a task). */
const ACTION_WORDS: Record<ActionId, readonly string[]> = {
  'new-task': ['new task', 'add task'],
  'new-area': ['new area', 'add area'],
  import: ['import'],
  settings: ['settings', 'preferences'],
  reset: ['weekly reset', 'reset'],
  shortcuts: ['shortcuts', 'keyboard shortcuts', 'help'],
  theme: ['theme', 'switch theme'],
  'dark-mode': ['dark mode', 'dark', 'dark theme'],
  'light-mode': ['light mode', 'light', 'light theme'],
}

const GO_WORDS: Record<Exclude<GoTarget, `area:${string}`>, readonly string[]> = {
  home: ['today', 'home'],
  tasks: ['tasks', 'all tasks'],
  focus: ['lock in', 'lockin', 'focus'],
  reset: ['weekly reset', 'reset'],
  settings: ['settings', 'preferences'],
}

/** The theme a palette command switches to; "dark mode" when already dark keeps that theme. */
export function themeForCommand(id: 'theme' | 'dark-mode' | 'light-mode', current: ThemeId): ThemeId {
  const isDark = THEMES.find((t) => t.id === current)?.dark ?? false
  const wantDark = id === 'theme' ? !isDark : id === 'dark-mode'
  if (wantDark === isDark) return current
  return wantDark ? 'night' : 'stone'
}

const STOPWORDS = new Set(['the', 'a', 'an', 'my', 'to', 'of', 'off', 'and'])
const MIN_PREFIX = 3

const normalize = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim()
const tokens = (s: string): string[] => normalize(s).split(' ').filter((w) => w && !STOPWORDS.has(w))

/** Query word matches a title word when equal, or when it is a prefix of at least 3 letters. */
const wordMatches = (q: string, t: string): boolean => q === t || (q.length >= MIN_PREFIX && t.startsWith(q))

/**
 * The open task a phrase most plausibly names, or null. Confident means every word of the phrase
 * matches a word of the title (so "hist ess" finds "Finish the history essay"); several matches go
 * to the title the phrase covers most of, and a tie is not confident (null).
 */
export function matchTask(phrase: string, tasks: readonly Task[]): Task | null {
  return bestMatch(phrase, tasks)?.task ?? null
}

interface Match {
  task: Task
  /** Share of the title's words the phrase covers, 0..1. */
  cover: number
}

function bestMatch(phrase: string, tasks: readonly Task[]): Match | null {
  const q = tokens(phrase)
  if (q.length === 0) return null
  let best: Match | null = null
  let tied = false
  for (const task of tasks) {
    if (task.done) continue
    const t = tokens(task.title)
    if (!q.every((w) => t.some((x) => wordMatches(w, x)))) continue
    const cover = q.length / t.length
    if (best === null || cover > best.cover) {
      best = { task, cover }
      tied = false
    } else if (cover === best.cover) tied = true
  }
  return tied ? null : best
}

function matchArea(phrase: string, areas: readonly Area[]): Area | null {
  const q = normalize(phrase)
  if (!q) return null
  const exact = areas.find((a) => normalize(a.name) === q)
  if (exact) return exact
  if (q.length < MIN_PREFIX) return null
  const prefixed = areas.filter((a) => normalize(a.name).startsWith(q))
  return prefixed.length === 1 ? (prefixed[0] ?? null) : null
}

/** `exact` (no "go to" verb) only accepts a place's full name, so a search for "cla" is still a search. */
function matchGo(phrase: string, areas: readonly Area[], exact = false): GoTarget | null {
  const q = normalize(phrase)
  for (const [target, words] of Object.entries(GO_WORDS)) {
    if (words.includes(q)) return target as GoTarget
  }
  const name = q.replace(/ area$/, '')
  const area = exact ? areas.find((a) => normalize(a.name) === name) : matchArea(name, areas)
  return area ? `area:${area.id}` : null
}

function matchAction(q: string): ActionId | null {
  for (const [id, words] of Object.entries(ACTION_WORDS)) {
    if (words.includes(q)) return id as ActionId
  }
  return null
}

const DONE_VERB = /^(?:done|finish|finished|complete|completed|check|tick)\s+(?:off\s+)?(.+)$/
const SNOOZE_VERB = /^(?:snooze|later|postpone|defer)\s+(.+)$/
const GO_VERB = /^(?:go\s+to|goto|open|show)\s+(.+)$/

function verbIntent(q: string, ctx: IntentContext): Intent | null {
  const { tasks, areas } = ctx
  const go = GO_VERB.exec(q)
  if (go?.[1]) {
    const target = matchGo(go[1], areas)
    if (target) return { kind: 'go', target }
    const task = /^(?:open|show)\s/.test(q) ? matchTask(go[1], tasks) : null
    if (task) return { kind: 'open', taskId: task.id }
  }
  const done = DONE_VERB.exec(q)
  const doneTask = done?.[1] ? bestMatch(done[1], tasks) : null
  if (doneTask) return titleWithVerb(q, doneTask, tasks) ?? { kind: 'done', taskId: doneTask.task.id }
  const snooze = SNOOZE_VERB.exec(q)
  const snoozeTask = snooze?.[1] ? bestMatch(snooze[1], tasks) : null
  if (snoozeTask) return titleWithVerb(q, snoozeTask, tasks) ?? { kind: 'snooze', taskId: snoozeTask.task.id }
  return null
}

/** "check email" is a search for the task "Check email" when the verb is part of its title. */
function titleWithVerb(q: string, withoutVerb: Match, tasks: readonly Task[]): Intent | null {
  const whole = bestMatch(q, tasks)
  return whole && whole.cover >= withoutVerb.cover ? { kind: 'open', taskId: whole.task.id } : null
}

/** No verb: a place named exactly, else the open task the words name. */
function plainIntent(q: string, ctx: IntentContext): Intent | null {
  const target = matchGo(q, ctx.areas, true)
  if (target) return { kind: 'go', target }
  const task = matchTask(q, ctx.tasks)
  return task ? { kind: 'open', taskId: task.id } : null
}

/** "move X to <area|date>" or "X to <area>". */
function moveIntent(raw: string, q: string, ctx: IntentContext): Intent | null {
  const m = /^(?:move\s+)?(.+?)\s+to\s+(.+)$/.exec(q)
  if (!m?.[1] || !m[2]) return null
  const task = matchTask(m[1], ctx.tasks)
  if (!task) return null
  const area = matchArea(m[2], ctx.areas)
  if (area) return { kind: 'move', taskId: task.id, areaId: area.id }
  const date = parseDateToken(raw, ctx.now)
  if (date && normalize(date.match) === normalize(m[2])) return { kind: 'reschedule', taskId: task.id, due: date.due }
  return null
}

/** "X tomorrow": a date phrase after words that name an existing open task. */
function rescheduleIntent(raw: string, ctx: IntentContext): Intent | null {
  const date = parseDateToken(raw, ctx.now)
  if (!date) return null
  const rest = raw.replace(date.match, ' ').replace(/\b(?:on|by|for|until|due)\s*$/i, ' ')
  const task = matchTask(rest, ctx.tasks)
  return task ? { kind: 'reschedule', taskId: task.id, due: date.due } : null
}

/**
 * Ranked guesses at what a palette query means, best first. A task-changing intent only appears
 * when the words match an open task confidently; words that name a task or place without a verb
 * open it; "add" is always present as the last resort.
 */
export function guessIntents(query: string, ctx: IntentContext): Intent[] {
  const text = query.trim()
  if (!text) return []
  const q = normalize(text)
  const add: Intent = { kind: 'add', text }
  const action = matchAction(q)
  const guess = action
    ? ({ kind: 'action', id: action } as Intent)
    : (verbIntent(q, ctx) ?? moveIntent(text, q, ctx) ?? rescheduleIntent(text, ctx) ?? plainIntent(q, ctx))
  return guess ? [guess, add] : [add]
}
