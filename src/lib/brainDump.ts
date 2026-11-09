/**
 * Brain-dump helpers for capture: split pasted lists into tasks, guess when one sentence is
 * really several tasks, and spot near-duplicates of open tasks. Pure and local; no AI.
 */

const MARKER = /^(?:[-*+•–—]|\d{1,3}[.)])(?:\s+|$)/
const CHECKBOX = /^\[([ xX]?)\](?:\s+|$)/
const HEADING = /^#{1,6}\s|:$/

/** One pasted line (without list marker or checkbox), or null when it is not a task. */
function cleanLine(raw: string): string | null {
  const line = raw.trim().replace(MARKER, '')
  const box = CHECKBOX.exec(line)
  // A checked box is already done; there is nothing to add.
  if (box && box[1]?.toLowerCase() === 'x') return null
  const text = (box ? line.slice(box[0].length) : line).trim()
  return text === '' || HEADING.test(text) ? null : text
}

/**
 * Splits typed or pasted text into task lines: one per line, bullet, number, open checkbox or
 * semicolon. Headings ("Groceries:", "## This week") and checked boxes are dropped, except
 * that one typed line is always kept: it is what the person meant to add.
 */
export function splitLines(text: string): string[] {
  const pieces = text.split(/\r?\n|;/)
  const lines = pieces.map(cleanLine).filter((line): line is string => line !== null)
  const typed = text.trim()
  return pieces.length === 1 && lines.length === 0 && typed !== '' ? [typed] : lines
}

/* ------------------------------ one line, many tasks ------------------------------ */

/** Words a to-do usually starts with. Only used to decide whether to *offer* a split. */
const VERBS = new Set(
  `add apply ask attend back bake book bring buy call cancel change charge check choose clean clear
  collect come confirm contact cook copy create cut decide delete deliver do download drop email
  empty fill finish fix follow get give go grab hand help hire install invite iron learn leave look
  mail make meet message mop move order organize organise pack paint pay phone pick plan post
  practice practise prep prepare print put read record register remember remind renew rent repair
  reply research reschedule respond return review ring run schedule see sell send set ship shop
  sign sort start study submit take talk text think tidy tell top transfer try turn unpack update
  upload vacuum visit wash watch water walk wrap write feed file fold dm`.split(/\s+/),
)

const FILLER = /^(?:(?:i\s+)?(?:need|have|got|want)\s+to|gotta|remember\s+to|don'?t\s+forget\s+to|todo:?)\s+/i

// Longer alternatives first so ", and also" is not read as ",".
const SEPARATOR =
  /(\s*;\s*|,\s*and\s+also\s+|,\s*(?:and\s+)?then\s+|,\s*(?:and|or)\s+|,\s*|\s+and\s+also\s+|\s+and\s+then\s+|\s+then\s+|\s+and\s+)/i

const words = (s: string): string[] => s.split(/\s+/).filter((w) => w !== '')
const startsWithVerb = (s: string): boolean => VERBS.has((words(s)[0] ?? '').toLowerCase().replace(/[^a-z]/g, ''))

/**
 * For one line that lists several separate things ("call mom, buy milk and finish the essay"),
 * returns the parts; null unless confident. Confident means every part starts with a verb, or
 * there are 2+ commas and every part has 2+ words. A bare "and"/"then" only splits when a verb
 * follows and the left side is more than one word, so "salt and pepper", "Read chapters 3 and
 * 4" and "Write and submit the essay" stay whole.
 */
export function guessSplit(line: string): string[] | null {
  const tokens = line.trim().replace(FILLER, '').split(SEPARATOR)
  const parts: string[] = [tokens[0]?.trim() ?? '']
  let commas = 0
  for (let i = 1; i < tokens.length; i += 2) {
    const sep = tokens[i] ?? ''
    const right = (tokens[i + 1] ?? '').trim()
    const strong = /[,;]|also/i.test(sep)
    const last = parts.length - 1
    if (strong || (startsWithVerb(right) && words(parts[last] ?? '').length > 1)) {
      if (sep.includes(',')) commas++
      parts.push(right)
    } else {
      parts[last] = `${parts[last] ?? ''}${sep}${right}`
    }
  }
  const kept = parts.filter((p) => p !== '')
  if (kept.length < 2) return null
  const allVerbs = kept.every(startsWithVerb)
  const listOfPhrases = commas >= 2 && kept.every((p) => words(p).length > 1)
  return allVerbs || listOfPhrases ? kept : null
}

/* ---------------------------------- near-duplicates ---------------------------------- */

const STOPWORDS = new Set(['the', 'a', 'an', 'to', 'my', 'for', 'of', 'and', 'on', 'at', 'in'])
const SIMILAR = 0.8
/** Edit distance is quadratic; only compare short titles with it (token overlap covers the rest). */
const MAX_EDIT_CHARS = 60

const tokensOf = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w !== '' && !STOPWORDS.has(w))

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length] ?? 0
}

/** 0..1: the better of word overlap (Dice) and edit-distance ratio, ignoring case, punctuation and filler words. */
export function similarity(a: string, b: string): number {
  const ta = tokensOf(a)
  const tb = tokensOf(b)
  if (ta.length === 0 || tb.length === 0) return 0
  const setB = new Set(tb)
  const setA = new Set(ta)
  const shared = [...setA].filter((w) => setB.has(w)).length
  const dice = (2 * shared) / (setA.size + setB.size)
  const sa = ta.join(' ')
  const sb = tb.join(' ')
  if (sa.length > MAX_EDIT_CHARS || sb.length > MAX_EDIT_CHARS) return dice
  return Math.max(dice, 1 - levenshtein(sa, sb) / Math.max(sa.length, sb.length))
}

interface TitledTask {
  id: string
  title: string
  done: boolean
}

/** The open task whose title is most like `title`, if it is very similar. */
export function findSimilar<T extends TitledTask>(title: string, tasks: readonly T[]): T | null {
  if (tokensOf(title).join(' ').length < 3) return null
  let best: T | null = null
  let bestScore = SIMILAR
  for (const task of tasks) {
    if (task.done) continue
    const score = similarity(title, task.title)
    if (score >= bestScore) {
      best = task
      bestScore = score
    }
  }
  return best
}
