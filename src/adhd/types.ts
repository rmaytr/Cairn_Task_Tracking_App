/** Shared vocabulary for the ADHD toolkit (#adhd). No imports, so the store schema can use it. */

/** Each tool is a sub-page: `#adhd/<tool>`. The hub is `#adhd`. */
export const ADHD_TOOLS = ['room', 'sounds', 'unstuck', 'time', 'treats', 'move', 'learn'] as const
export type AdhdTool = (typeof ADHD_TOOLS)[number]

/** Synthesized focus sounds (no audio files). */
export const NOISE_KINDS = ['white', 'pink', 'brown', 'rain'] as const
export type NoiseKind = (typeof NOISE_KINDS)[number]

/** How a strategy card sits in the user's own playbook. */
export const PLAYBOOK_MARKS = ['helps', 'try', 'nope'] as const
export type PlaybookMark = (typeof PLAYBOOK_MARKS)[number]

/** One finished Focus room block, kept on this device to find personal patterns. */
export interface FocusSession {
  id: string
  /** The task worked on, if it still exists. */
  taskId: string | null
  /** Title at the time, so patterns survive the task being deleted or renamed. */
  title: string
  /** Epoch ms when the block started. */
  at: number
  /** The user's guess in minutes before starting (Time sense), if they made one. */
  guessMin: number | null
  /** Minutes actually worked, pauses excluded. */
  actualMin: number
  /** Sound playing during the block. */
  sound: NoiseKind | 'none'
  /** Whether the quiet companion was on. */
  companion: boolean
  /** "How was your focus?" 1 (scattered) to 5 (locked in); null if skipped. */
  rating: number | null
}

export interface AdhdPrefs {
  sound: { kind: NoiseKind; volume: number }
  /** The quiet companion in the Focus room. */
  companion: boolean
  /** Newest last; capped at MAX_SESSIONS. */
  sessions: FocusSession[]
  /** The user's reward menu. */
  treats: string[]
  /** Strategy card id -> mark. */
  playbook: Record<string, PlaybookMark>
}

export const MAX_SESSIONS = 300
export const MAX_TREATS = 40
export const MAX_TREAT_LENGTH = 80

export const DEFAULT_TREATS: readonly string[] = [
  'A song you love, loud',
  'Two minutes outside',
  'A snack you like',
  'Text a friend',
  'A cup of tea or coffee',
  'One video, then back',
  'Stretch like a cat',
]

export const DEFAULT_ADHD: AdhdPrefs = {
  sound: { kind: 'pink', volume: 0.35 },
  companion: true,
  sessions: [],
  treats: [...DEFAULT_TREATS],
  playbook: {},
}
