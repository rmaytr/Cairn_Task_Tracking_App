import type { AdhdTool } from '../types'

/** How sure the research is, said plainly on each card. */
export type Evidence = 'strong' | 'moderate' | 'early'
export type Topic = 'starting' | 'time' | 'focus' | 'rewards' | 'feelings' | 'body' | 'planning' | 'myths'

export interface Source {
  author: string
  year: string
  venue?: string
}

export interface Fact {
  id: string
  title: string
  /** Under MAX_BODY_WORDS words. */
  body: string
  /** Usually one; a card can rest on two studies. */
  sources: readonly Source[]
  evidence: Evidence
  topic: Topic
  tryIt?: { label: string; tool: AdhdTool }
}

export const MAX_BODY_WORDS = 30

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  strong: 'Strong evidence',
  moderate: 'Some evidence',
  early: 'Early research',
}

export const EVIDENCE_MEANING: Record<Evidence, string> = {
  strong: 'Many studies, or a large review, point the same way.',
  moderate: 'Good studies agree, but effects are small or the research is narrower.',
  early: 'Only a few small studies, or none yet.',
}

/** Filter chip order. */
export const TOPIC_LABEL: Record<Topic, string> = {
  starting: 'Starting',
  time: 'Time',
  focus: 'Focus',
  rewards: 'Rewards',
  feelings: 'Feelings',
  body: 'Body',
  planning: 'Planning',
  myths: 'Myths',
}

export const FACTS: readonly Fact[] = [
  {
    id: 'if-then',
    title: 'If-then plans help you start',
    body: 'Research suggests “if-then” plans (“When I sit down, I’ll open the doc”) help people follow through more than goals alone.',
    sources: [{ author: 'Gollwitzer & Sheeran', year: '2006', venue: 'Advances in Experimental Social Psychology' }],
    evidence: 'strong',
    topic: 'starting',
    tryIt: { label: 'Try I’m stuck', tool: 'unstuck' },
  },
  {
    id: 'if-then-kids',
    title: 'If-then plans may help kids hold back',
    body: 'Small studies in children with ADHD found if-then plans helped them stop unwanted responses and wait for a bigger reward.',
    sources: [
      { author: 'Gawrilow & Gollwitzer', year: '2008', venue: 'Cognitive Therapy and Research' },
      { author: 'Gawrilow, Gollwitzer & Oettingen', year: '2011', venue: 'Cognitive Therapy and Research' },
    ],
    evidence: 'early',
    topic: 'planning',
  },
  {
    id: 'planning-fallacy',
    title: 'Look back before you guess',
    body: 'Many people underestimate how long tasks take. Linking a guess to how long similar tasks really took made guesses more realistic in studies.',
    sources: [{ author: 'Buehler, Griffin & Ross', year: '1994', venue: 'Journal of Personality and Social Psychology' }],
    evidence: 'moderate',
    topic: 'time',
    tryIt: { label: 'Try Time sense', tool: 'time' },
  },
  {
    id: 'visible-time',
    title: 'Make time visible',
    body: 'Research links ADHD with differences in judging time. Seeing time on screen is a common workaround, though it hasn’t been tested directly.',
    sources: [{ author: 'Marx et al.', year: '2022', venue: 'JAACAP' }],
    evidence: 'early',
    topic: 'time',
    tryIt: { label: 'Open the Focus room', tool: 'room' },
  },
  {
    id: 'noise',
    title: 'Noise helps some people a little',
    body: 'In studies of young people with ADHD, white or pink noise gave a small boost on short tasks. For people without ADHD it slightly hurt. Try it and see.',
    sources: [{ author: 'Nigg et al.', year: '2024', venue: 'JAACAP' }],
    evidence: 'moderate',
    topic: 'focus',
    tryIt: { label: 'Try Focus sounds', tool: 'sounds' },
  },
  {
    id: 'brown-noise',
    title: 'Brown noise and binaural beats',
    body: 'There’s no good research yet on brown noise or binaural beats for ADHD focus. If you like them, that’s fine.',
    sources: [
      { author: 'Nigg et al.', year: '2024', venue: 'JAACAP' },
      { author: 'Kennel et al.', year: '2010', venue: 'Journal of Pediatric Nursing' },
    ],
    evidence: 'early',
    topic: 'myths',
  },
  {
    id: 'park-it',
    title: 'Park the thought, with a plan',
    body: 'Writing down a specific plan for an unfinished task can quiet the nagging thoughts about it.',
    sources: [{ author: 'Masicampo & Baumeister', year: '2011', venue: 'Journal of Personality and Social Psychology' }],
    evidence: 'moderate',
    topic: 'focus',
    tryIt: { label: 'Open the Focus room', tool: 'room' },
  },
  {
    id: 'fresh-start',
    title: 'Fresh starts give a boost',
    body: 'People are more likely to pursue goals at the start of a week, a month or a new chapter.',
    sources: [{ author: 'Dai, Milkman & Riis', year: '2014', venue: 'Management Science' }],
    evidence: 'moderate',
    topic: 'starting',
  },
  {
    id: 'self-kindness',
    title: 'Be kind to yourself',
    body: 'In a large survey, adults with ADHD who were kinder to themselves reported better wellbeing. You don’t have to be hard on yourself to get things done.',
    sources: [{ author: 'Beaton, Sirois & Milne', year: '2022', venue: 'Journal of Clinical Psychology' }],
    evidence: 'early',
    topic: 'feelings',
    tryIt: { label: 'Try I’m stuck', tool: 'unstuck' },
  },
  {
    id: 'broken-streak',
    title: 'A missed day is not a verdict',
    body: 'Seeing a broken streak made people less likely to keep going, even when their real effort was the same. A missed day doesn’t erase what you did.',
    sources: [{ author: 'Silverman & Barasch', year: '2023', venue: 'Journal of Consumer Research' }],
    evidence: 'moderate',
    topic: 'feelings',
  },
  {
    id: 'move',
    title: 'Move a little, focus a little better',
    body: 'In children with ADHD, 15–30 minutes of brisk exercise briefly helped focus. Shorter breaks are less tested, but moving is a cheap thing to try.',
    sources: [{ author: 'Chueh et al.', year: '2022', venue: 'Psychology of Sport and Exercise' }],
    evidence: 'moderate',
    topic: 'body',
    tryIt: { label: 'Take a move break', tool: 'move' },
  },
  {
    id: 'rewards-close',
    title: 'Rewards are easier up close',
    body: 'Waiting for rewards is often harder with ADHD. That’s why many people find small rewards soon after the effort easier to work for.',
    sources: [{ author: 'Marx et al.', year: '2021', venue: 'Journal of Attention Disorders' }],
    evidence: 'moderate',
    topic: 'rewards',
    tryIt: { label: 'Open your reward menu', tool: 'treats' },
  },
  {
    id: 'one-task',
    title: 'One thing at a time',
    body: 'Switching between tasks costs everyone a little time and accuracy, so one task at a time is often easier.',
    sources: [{ author: 'Monsell', year: '2003', venue: 'Trends in Cognitive Sciences' }],
    evidence: 'moderate',
    topic: 'focus',
    tryIt: { label: 'Open the Focus room', tool: 'room' },
  },
  {
    id: 'choices',
    title: 'Fewer choices, easier start',
    body: 'Too many options can make starting harder, especially when choices feel complex. Picking three for today is enough.',
    sources: [{ author: 'Chernev, Böckenholt & Goodman', year: '2015', venue: 'Journal of Consumer Psychology' }],
    evidence: 'moderate',
    topic: 'starting',
  },
  {
    id: 'skills',
    title: 'Planning skills can be learned',
    body: 'Skills-based therapy that includes planning and breaking tasks down has helped adults with ADHD in clinical trials.',
    sources: [
      { author: 'Safren et al.', year: '2010', venue: 'JAMA' },
      { author: 'Solanto et al.', year: '2010', venue: 'American Journal of Psychiatry' },
    ],
    evidence: 'moderate',
    topic: 'planning',
    tryIt: { label: 'Try I’m stuck', tool: 'unstuck' },
  },
  {
    id: 'sugar',
    title: 'Sugar and hyperactivity',
    body: 'Studies don’t support the idea that sugar causes hyperactivity in children on average.',
    sources: [{ author: 'Wolraich et al.', year: '1995', venue: 'JAMA' }],
    evidence: 'strong',
    topic: 'myths',
  },
  {
    id: 'routine-hook',
    title: 'Hook it onto a routine',
    body: 'Tying a new habit to something you already do daily, like breakfast, gives it a cue. With repetition it gets more automatic.',
    sources: [{ author: 'Lally et al.', year: '2010', venue: 'European Journal of Social Psychology' }],
    evidence: 'moderate',
    topic: 'planning',
  },
]

export const factById = (id: string): Fact | undefined => FACTS.find((f) => f.id === id)

export const formatSources = (sources: readonly Source[]): string =>
  sources.map((s) => [`${s.author} (${s.year})`, s.venue].filter(Boolean).join(', ')).join('; ')

const DAY_MS = 86_400_000

/** One card per local calendar day, the same for everyone on that date, cycling through all of them. */
export function factOfDay(now: Date): Fact {
  const day = Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS)
  return FACTS[day % FACTS.length]
}
