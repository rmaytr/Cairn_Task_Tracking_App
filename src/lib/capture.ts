import { REPEAT_LABEL } from '../model/repeat'
import { EFFORT_LABEL, HORIZON_LABEL, HORIZONS } from '../model/types'
import type { Area, Effort, Horizon, Repeat, TaskDraft } from '../model/types'
import { matchAreaHint } from './classify'
import { formatDue, parseDateToken, WEEKDAYS } from './dates'

export interface Chip {
  kind: 'area' | 'due' | 'horizon' | 'high' | 'effort' | 'repeat'
  label: string
}

export interface CaptureResult {
  draft: TaskDraft
  chips: Chip[]
}

/** Maps a `#hint` to the area label to store, or null if the hint is not usable. */
export type HintResolver = (hint: string) => string | null

interface TokenState {
  kept: string[]
  area?: string
  high: boolean
  horizon?: Horizon
  effort?: Effort
}

const AREA_TOKEN = /^#([A-Za-z][\w-]*)$/ // "#1" is never a tag
const HIGH_TOKEN = /^(?:!{1,2}|!high)$/i
const HORIZON_TOKEN = new RegExp(`^@(${HORIZONS.join('|')})$`, 'i')
const EFFORT_TOKEN = /^~(s|small|quick|m|med|medium|l|large|big)$/i
const LEADING_PREPOSITION = /\b(?:on|by|before|until)\s+$/i
const REPEAT_PHRASE = new RegExp(
  `(?<![\\w#@])every\\s+(?:(day|night|morning|evening)|(week)|(month)|(${WEEKDAYS}))(?![\\w'’])`,
  'i',
)
// "2m of fabric" is a length, not a duration.
const DURATION = /(?<![\w#@.])(?:(?:for|takes|about)\s+|~)?(\d{1,3}(?:\.\d+)?)\s*(m|mins?|minutes?|h|hrs?|hours?)(?![\w'’])(?!\s+of\b)/i
const QUICK_WORD = /(?<![\w#@~])quick(?!\w)/i
/** Upper bounds in minutes for quick and medium effort (see EFFORT_MINUTES). */
const QUICK_MAX_MINUTES = 30
const MEDIUM_MAX_MINUTES = 90

const EFFORT_BY_WORD: Record<string, Effort> = {
  s: 's',
  small: 's',
  quick: 's',
  m: 'm',
  med: 'm',
  medium: 'm',
  l: 'l',
  large: 'l',
  big: 'l',
}

/** Longer lines are cut before parsing; no real task title is this long. */
export const MAX_LINE_CHARS = 2000

/** Applies one whitespace-delimited token to the state; unrecognized tokens stay in the title. */
function applyToken(state: TokenState, token: string, resolveHint: HintResolver): TokenState {
  const areaHint = AREA_TOKEN.exec(token)?.[1]
  if (areaHint !== undefined) {
    const label = resolveHint(areaHint)
    if (label !== null) return { ...state, area: state.area ?? label }
  }
  if (HIGH_TOKEN.test(token)) return { ...state, high: true }
  const horizonWord = HORIZON_TOKEN.exec(token)?.[1]
  if (horizonWord !== undefined) {
    return { ...state, horizon: state.horizon ?? (horizonWord.toLowerCase() as Horizon) }
  }
  const effortWord = EFFORT_TOKEN.exec(token)?.[1]
  if (effortWord !== undefined) {
    return { ...state, effort: state.effort ?? EFFORT_BY_WORD[effortWord.toLowerCase()] }
  }
  // Appends in place: `kept` is a fresh array owned by extractCapture, and copying it per
  // word made long lines quadratic (a crafted import line could freeze the tab).
  state.kept.push(token)
  return state
}

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim()

/** Removes `match` from `title` unless that leaves nothing. */
function strip(title: string, match: string, replacement = ''): string {
  const start = title.indexOf(match)
  const stripped = collapse(`${title.slice(0, start)} ${replacement} ${title.slice(start + match.length)}`)
  return stripped === '' ? title : stripped
}

/** "every day/week/month" → repeat; "every Monday" also leaves "Monday" for the date parser. */
function splitRepeat(title: string): { title: string; repeat?: Exclude<Repeat, 'none'> } {
  const m = REPEAT_PHRASE.exec(title)
  if (m === null) return { title }
  const repeat = m[1] ? 'daily' : m[3] ? 'monthly' : 'weekly'
  return { title: strip(title, m[0], m[4] ?? ''), repeat }
}

/** "15 min", "1h", "2 hours" → effort (and removed); a bare "quick" → quick (word kept). */
function splitEffort(title: string): { title: string; effort?: Effort } {
  const m = DURATION.exec(title)
  if (m === null) return QUICK_WORD.test(title) ? { title, effort: 's' } : { title }
  const minutes = Number(m[1]) * (/^h/i.test(m[2] ?? '') ? 60 : 1)
  const effort = minutes <= QUICK_MAX_MINUTES ? 's' : minutes <= MEDIUM_MAX_MINUTES ? 'm' : 'l'
  return { title: strip(title, m[0]), effort }
}

/** Removes the first date phrase (and a directly preceding "on"/"by") unless that empties the title. */
function splitDate(title: string, now: Date): { title: string; due?: string } {
  const hit = parseDateToken(title, now)
  if (hit === null) return { title }
  const start = title.indexOf(hit.match)
  const before = title.slice(0, start).replace(LEADING_PREPOSITION, '')
  const stripped = collapse(`${before} ${title.slice(start + hit.match.length)}`)
  return { title: stripped === '' ? title : stripped, due: hit.due }
}

function buildChips(draft: TaskDraft, now: Date): Chip[] {
  const chips: Chip[] = []
  if (draft.area !== undefined) chips.push({ kind: 'area', label: draft.area })
  if (draft.due) chips.push({ kind: 'due', label: formatDue(draft.due, now) })
  if (draft.horizon !== undefined) chips.push({ kind: 'horizon', label: HORIZON_LABEL[draft.horizon] })
  if (draft.high) chips.push({ kind: 'high', label: 'High priority' })
  if (draft.effort !== undefined) chips.push({ kind: 'effort', label: EFFORT_LABEL[draft.effort] })
  if (draft.repeat !== undefined) chips.push({ kind: 'repeat', label: REPEAT_LABEL[draft.repeat] })
  return chips
}

/**
 * Parses quick-capture tokens out of one line. `resolveHint` decides what a
 * `#word` means: capture resolves it against the user's areas; importers keep
 * the word as written and let the commit step resolve it.
 */
export function extractCapture(input: string, now: Date, resolveHint: HintResolver): CaptureResult {
  const words = input.slice(0, MAX_LINE_CHARS).split(/\s+/).filter((w) => w !== '')
  let state: TokenState = { kept: [], high: false }
  for (const word of words) state = applyToken(state, word, resolveHint)
  const repeated = splitRepeat(state.kept.join(' '))
  const timed = splitEffort(repeated.title)
  const effort = state.effort ?? timed.effort
  const { title, due } = splitDate(timed.title, now)
  const draft: TaskDraft = {
    title,
    ...(state.area !== undefined && { area: state.area }),
    ...(due !== undefined && { due }),
    ...(state.horizon !== undefined && { horizon: state.horizon }),
    ...(state.high && { high: true }),
    ...(effort !== undefined && { effort }),
    ...(repeated.repeat !== undefined && { repeat: repeated.repeat }),
  }
  return { draft, chips: buildChips(draft, now) }
}

/** Quick-capture line parser. `#area` hints must resolve against `areas` or they stay in the title. */
export function parseCapture(input: string, areas: Area[], now: Date): CaptureResult {
  return extractCapture(input, now, (hint) => matchAreaHint(hint, areas)?.name ?? null)
}
