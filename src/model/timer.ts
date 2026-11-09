/**
 * Lock-in focus timer. Time is derived from an end timestamp (or a frozen remainder while
 * paused), so it stays correct when the tab is hidden or throttled.
 */
export interface FocusTimer {
  /** Total length so far, including any "+5 min" additions. */
  durationMs: number
  /** Epoch ms when it finishes; null while paused. */
  endsAt: number | null
  /** Time left while paused; null while running. */
  pausedRemainingMs: number | null
}

const MINUTE = 60_000

export const start = (now: number, minutes: number): FocusTimer => ({
  durationMs: minutes * MINUTE,
  endsAt: now + minutes * MINUTE,
  pausedRemainingMs: null,
})

export const remainingMs = (t: FocusTimer, now: number): number =>
  Math.max(0, t.endsAt === null ? (t.pausedRemainingMs ?? 0) : t.endsAt - now)

export const isFinished = (t: FocusTimer, now: number): boolean => t.endsAt !== null && remainingMs(t, now) === 0

export const isPaused = (t: FocusTimer): boolean => t.endsAt === null

export const pause = (t: FocusTimer, now: number): FocusTimer =>
  t.endsAt === null ? t : { ...t, endsAt: null, pausedRemainingMs: remainingMs(t, now) }

export const resume = (t: FocusTimer, now: number): FocusTimer =>
  t.endsAt !== null ? t : { ...t, endsAt: now + (t.pausedRemainingMs ?? 0), pausedRemainingMs: null }

/** Adds minutes to what is left (a finished timer restarts from now). */
export const extend = (t: FocusTimer, now: number, minutes: number): FocusTimer => ({
  durationMs: t.durationMs + minutes * MINUTE,
  endsAt: (t.endsAt === null ? now + (t.pausedRemainingMs ?? 0) : Math.max(t.endsAt, now)) + minutes * MINUTE,
  pausedRemainingMs: null,
})

/** Epoch ms when it will finish if it keeps running. */
export const finishTime = (t: FocusTimer, now: number): number => now + remainingMs(t, now)

/** Whole minutes actually worked (pauses excluded). */
export const workedMinutes = (t: FocusTimer, now: number): number =>
  Math.round((t.durationMs - remainingMs(t, now)) / MINUTE)
