/** Pure logic for "I'm stuck": the blockers, which move fits each, and 2-minute step openers. */

export const BLOCKERS = ['big', 'start', 'boring', 'bad', 'many', 'energy'] as const
export type Blocker = (typeof BLOCKERS)[number]

export const BLOCKER_LABEL: Record<Blocker, string> = {
  big: 'It’s too big',
  start: 'I don’t know where to start',
  boring: 'It’s boring',
  bad: 'It feels bad / I’m avoiding it',
  many: 'Too many things, can’t choose',
  energy: 'Low energy today',
}

/** The one move that fits each blocker (the step-3 screen). */
export type MoveId = 'tiny-step' | 'if-then' | 'less-boring' | 'be-kind' | 'pick-one' | 'small-things'
export const MOVE_FOR: Record<Blocker, MoveId> = {
  big: 'tiny-step',
  start: 'if-then',
  boring: 'less-boring',
  bad: 'be-kind',
  many: 'pick-one',
  energy: 'small-things',
}

export interface Why {
  line: string
  source: string
}

/** One line on why each move works, with a small source. No overclaiming. */
export const WHY: Record<MoveId, Why> = {
  'tiny-step': { line: 'A first step this small is easy to begin, and starting is usually the hard part.', source: 'Small steps, as used in CBT for adult ADHD (Safren et al. 2010)' },
  'if-then': { line: 'Deciding when and where you will start helps people follow through more than a goal alone.', source: 'Gollwitzer & Sheeran 2006' },
  'less-boring': { line: 'Adding something you like, a reward, or a change of scene can make dull work easier to begin.', source: 'Waiting is harder with ADHD (Marx et al. 2021)' },
  'be-kind': { line: 'Being kind to yourself is linked with better wellbeing in adults with ADHD.', source: 'Beaton et al. 2022' },
  'pick-one': { line: 'Fewer choices means less to carry. One thing is enough for now.', source: 'Cairn’s own rule: one thing at a time' },
  'small-things': { line: 'Exercise briefly helped focus in studies of children with ADHD. A short move is a cheap thing to try.', source: 'Chueh et al. 2022' },
}

export const WHEN_CHIPS = ['after breakfast', 'when I sit at my desk', 'at 4pm', 'right after class'] as const

const GENERIC_OPENERS = [
  'Put everything you need in one spot',
  'Set a 2-minute timer and just open it',
  'Write the first word, even a bad one',
]

const OPENERS: { match: RegExp; steps: string[] }[] = [
  { match: /\b(write|essay|paper|report|draft|blog|about page|cover letter)\b/i, steps: ['Open the doc and write the title', 'Write one sentence, any sentence'] },
  { match: /\b(email|e-mail|message|reply|respond|text|dm)\b/i, steps: ['Open a blank message and type who it’s to'] },
  { match: /\b(call|phone|ring)\b/i, steps: ['Find the number and put the phone next to you'] },
  { match: /\b(read|chapter|chapters|book|article)\b/i, steps: ['Open the book to the right page'] },
  { match: /\b(study|exam|midterm|test|quiz|revise|revision)\b/i, steps: ['Put your notes on the desk', 'Read just the first heading'] },
  { match: /\b(apply|application|resume|cv|internship|form)\b/i, steps: ['Open the form and fill in just your name'] },
  { match: /\b(slides|deck|presentation|talk)\b/i, steps: ['Open a blank deck and name it'] },
  { match: /\b(code|build|ship|site|prototype|app|bug|fix)\b/i, steps: ['Open the project and read the last thing you wrote'] },
  { match: /\b(pay|bill|renew|passport|register|sign up)\b/i, steps: ['Open the website and log in'] },
  { match: /\b(clean|tidy|laundry|dishes|organi[sz]e|pack)\b/i, steps: ['Put one thing where it belongs'] },
  { match: /\b(folder|files?|paperwork)\b/i, steps: ['Put the folder on the desk'] },
  { match: /\b(problem set|homework|assignment|worksheet|calculus|math)\b/i, steps: ['Open the problem set and read question 1'] },
]

/** Up to `limit` 2-minute openers for a task title: keyword matches first, then plain ones. */
export function openersFor(title: string, limit = 3): string[] {
  const picked: string[] = []
  for (const o of OPENERS) if (o.match.test(title)) for (const s of o.steps) if (!picked.includes(s)) picked.push(s)
  for (const s of GENERIC_OPENERS) if (!picked.includes(s)) picked.push(s)
  return picked.slice(0, limit)
}

const clean = (text: string): string => text.trim().replace(/[.!\s]+$/, '')

/** "When ___, I will ___" as one sentence for `task.plan`; null if either half is empty. */
export function formatPlan(when: string, will: string): string | null {
  const w = clean(when).replace(/^when\s+/i, '')
  const d = clean(will).replace(/^i(?:’ll|'ll| will)\s+/i, '')
  if (!w || !d) return null
  return `When ${w}, I will ${d}.`
}
